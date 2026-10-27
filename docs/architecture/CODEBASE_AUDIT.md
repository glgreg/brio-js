# Auditoria Tecnica e Diagnostico da Base de Codigo (Estado Inicial)

Este documento registra o diagnostico tecnico detalhado do diretorio `./src/` e dos arquivos de configuracao da raiz antes do inicio da refatoracao arquitetural na branch `refactor`.

---

## 1. Visao Geral do Estado Encontrado

A versao inicial da BrioJS (~3.000 linhas escritas manualmente em TypeScript) estabeleceu com sucesso a prova de conceito do ciclo de vida (`preload -> load -> update`), encapsulamento de campos privados ES (`#`), manipulacao de Canvas 2D, audio HTML5, teclado e colisoes basicas. Contudo, o crescimento organico gerou acoplamento na classe central, gargalos de alocacao de memoria no Game Loop e modulos inacabados.

### Mapa de Modulos Analisados em `./src/`

| Modulo / Arquivo | Status Encontrado | Diagnostico Resumido |
| :--- | :--- | :--- |
| `./src/index.ts` | Funcional com desvios | Exporta alias semanticos inconsistentes (`BrioAtlas as BrioSpriteAtlas`, `BrioConsole as BrioLogger`) e reexporta classes vazias de `./src/not-implemented/`. |
| `./src/game/BrioGame.ts` | Acoplado (God Object) | Concentra 827 linhas gerenciando DOM, Canvas, Loop, Assets, Input, Colisao, Instanciacao e Snapshots quebrados. |
| `./src/game/BrioSpriteRenderer.ts` | Funcional com bugs | Ignora `transform.renderSize`, nao aplica `pivot` no `skew`, limpa objetos individualmente antes do redesenho e reconfigura `imageSmoothingEnabled` a cada sprite. |
| `./src/game/BrioUpdater.ts` | Conflito de Dominio | Possui metodos `animate*` que apenas invocam `renderObject`, duplicando a renderizacao automatica que ja ocorre em `BrioGame.update`. |
| `./src/game/BrioAssetManager.ts` | Incompleto | Atua apenas como um agregador passivo de `Map`s, com inconsistencia de nomenclatura (`#spritesheet` vs getter `spritesheets`). |
| `./src/game/BrioCanvasBackground.ts` | Funcional | Manipula CSS inline do elemento `<canvas>`, mas sobrescreve `style.background` ao alternar entre `color` e `image`. |
| `./src/objects/BrioObject.ts` | Acoplado a 2D / OOP | Armazena estado diretamente na instancia (AoS), usa flag estatica global mutavel `instanceOfObject` e restringe nomes com sufixo `-[0-9]+`. |
| `./src/base/BrioTransform.ts` | Parcialmente quebrado | Mutacoes em subpropriedades (`scale.x = 2`, `size.x = 64`) nao disparam setters, deixando `#renderSize` e `#flip` dessincronizados. Sem suporte a hierarquia local (`localTransform`). |
| `./src/assets/BrioAtlas.ts` | Prototipo inacabado | Contem URL externa hardcoded no construtor e metodo `mount()` que nao aguarda a Promise de `decode()` antes de chamar `createImageBitmap()`. |
| `./src/assets/BrioSprite.ts` | Funcional / Legado | Cria um `HTMLImageElement` por instancia; JSDoc ainda menciona nomes legados (`GameSprite`, `GLS.GameSprite`). |
| `./src/assets/BrioAudio.ts` | Limitado (`HTMLAudioElement`) | Baseado em `<audio>` e `cloneNode(true)`, sujeito a latencia em efeitos repetidos, vazamento de listeners em `playMany` com delay e bloqueio de autoplay mobile. |
| `./src/input/BrioKeyboard.ts` | Funcional com efeitos colaterais | Registra listeners por instancia e chama `event.preventDefault()` em todas as teclas do navegador (bloqueando `F5`, `F12`, etc.). |
| `./src/math/BrioCollision.ts` | Bug logico assimetrico | No teste Circulo-Retangulo (`lines 31-70`), assume sempre que `two` e o circulo e `one` e o retangulo; se a ordem dos argumentos for invertida, o calculo falha. |
| `./src/math/vec2.ts` | Bugs matematicos | `normalize(out, v)` calcula a magnitude usando `out` em vez de `v`; `distanceTo(out, target)` calcula diferenca absoluta por eixo em vez da distancia euclidiana e sobrescreve `out`. |
| `./src/debugging/BrioDebugger.ts` | Alocacao por acesso | Os getters `console`, `render`, `#grid` e `#fpsOverlay` alocam novos objetos literais e closures a cada leitura (inclusive dentro do Game Loop). |
| `./src/debugging/BrioConsole.ts` | Bugs em metodos de ID | `#storedErrors` e `#storedExceptions` nunca sao inicializados (`undefined`), fazendo `error(id)` e `exception(id)` retornarem silenciosamente na guarda inicial; `if (isFound) true;` na linha 121 nao faz `return`. |
| `./src/tools/BrioUtils.ts` | Anti-patterns | `addProperty` usa `Object.defineProperty` em runtime sem seguranca de tipos TS; `timedAnimation` e `wait` usam `requestAnimationFrame`/`setTimeout` fora do controle de `pause()` do jogo. |
| `./src/not-implemented/*` | Esqueletos vazios | `BrioScene`, `BrioMouse`, `BrioGamepad` estao vazios; `BrioStorage` retorna `{}`; `BrioCamera` recria closures nos getters `pos`/`size` e exige `BrioMap`; `BrioMap` aceita apenas 1 sprite unico. |

---

## 2. Detalhamento dos Bugs Criticos e Gargalos de Performance

### 2.1. Gargalos no Game Loop e Pressao no Garbage Collector
1. **Alocacao e Ordenacao de Array por Frame (`BrioGame.ts:480-485`)**:
   - Em todo tick do `requestAnimationFrame`, executa-se `const objects = Array.from(this.#assets.objects.values()); objects.sort(...)`.
   - Em cenas com centenas de entidades, isso aloca arrays descartaveis 60 vezes por segundo e reexecuta ordenacao $O(N \log N)$ mesmo quando nenhuma camada mudou.
2. **Alocacao de Closures no Render Loop (`BrioDebugger.ts:67-196` e `BrioGame.ts:512-540`)**:
   - `#renderDebuggingGrid()` e `#renderDebuggingHelpers()` acessam `this.#debugger.render` e `renderConfig.grid` em todo frame. Cada acesso a esses getters instancia um novo objeto com multiplos getters/setters e closures.
   - Em `BrioDebugger.ts:119`, `get fpsOverlay()` retorna `self.#renderConfig.fpsOverlay` diretamente, deixando o getter privado `get #fpsOverlay()` (linhas 155-196) como codigo morto.
3. **Clonagem de Posicoes de Teclado por Frame (`BrioGame.ts:491-494`)**:
   - `this.#keyboardPrevState.clear()` seguido de loop copiando `this.#keyboardState` ocorre dentro de `BrioGame`, acoplando o gerenciamento interno do teclado ao loop principal.
4. **DeltaTime Inicial Invalido no Primeiro Frame (`BrioGame.ts:469`)**:
   - No primeiro frame do `requestAnimationFrame`, `#deltaTimePreviousTime` vale `0`, fazendo `deltaTime = currentTime / 1000` (que pode ser dezenas de segundos caso o preload demore), causando um salto brusco no primeiro tick.

### 2.2. Bugs de Renderizacao, Transformacao e Escala
1. **Escala Global (`BrioGame.scale`) e Escala do Objeto (`BrioTransform.scale`)**:
   - `BrioSpriteRenderer` recebe `this.#scale` por valor (primitivo `number`) no construtor (`BrioGame.ts:185`). Quando o usuario altera `game.scale = 2` apos instanciar `BrioGame`, `this.#renderer.#gameScale` permanece `1`!
   - Em `BrioSpriteRenderer.ts:108-109`, o `drawImage` utiliza `object.transform.size.x` e `object.transform.size.y` em vez de `object.transform.renderSize` (ou de aplicar `object.transform.scale` no contexto), ignorando a propriedade `transform.scale`.
2. **Setters Individuais de Vetores (`BrioTransform.ts`)**:
   - Como `position`, `size`, `scale`, `pivot` e `skew` retornam referencias a objetos literais `{ x, y }`, fazer `obj.transform.scale.x = 2` ou `obj.transform.size.x = 64` muta a propriedade interna sem invocar o `set scale` ou `set size`, nao atualizando `#renderSize` nem `#flip`.
3. **Inconsistencia de Unidades e Pivo no `skew` (`BrioSpriteRenderer.ts:84-97` vs `BrioTransform.ts:102`)**:
   - O JSDoc de `BrioTransform.skew` diz *"Uses radians for skewing the sprite"*, mas `BrioSpriteRenderer.ts:90-91` converte o valor multiplicando por `Math.PI / 180` (assumindo graus) e usa `Math.tan` ausente (passando o angulo direto na matriz de cisalhamento) alem de fixar a translacao em `size.x / 2, size.y / 2` em vez de respeitar `object.transform.pivot`.
4. **Limpeza Parcial de Objetos (`BrioGame.ts:465-467` e `BrioSpriteRenderer.ts:117-133`)**:
   - `clearObject` executa `clearRect(pos.x, pos.y, size.x, size.y)` sem considerar rotacao, skew ou pivo. Se um objeto estiver rotacionado ou escalado, restam artefatos visuais ("rastros") no canvas.

### 2.3. Bugs de Ciclo de Vida, Instanciacao, Destruicao e Colisao
1. **Destruicao Acidental de Sprites (`BrioGame.ts:753-761`)**:
   - No metodo `destroy(targetObject)`, a linha 757 verifica `if (this.#assets.sprites.has(targetObject.sprite))` e tenta deletar do mapa de sprites, misturando o ciclo de vida da entidade com o ciclo de vida do asset grafico.
2. **Instanciacao Fragil de Clones (`BrioGame.ts:710-751` e `BrioObject.ts:93-101`)**:
   - Usa a variavel estatica `BrioObject.instanceOfObject = true` para liberar o setter `clonesInstantiatedValue`.
   - `newObject.instanceId = targetObject.clonesInstantiatedValue` usa `targetObject` em vez de `registeredObject`, gerando IDs incorretos se o usuario passar uma referencia diferente.
   - `BrioObject.clone()` (`BrioObject.ts:141-178`) cria um novo `BrioObject` sem copiar `collision` antes do `if (object.collision)` (que sera sempre `undefined` na linha 148, tornando o bloco `switch` das linhas 148-175 inalcancavel!).
3. **Calculo de `outbound` Incorreto (`BrioGame.ts:690-698`)**:
   - A linha 691 define `let auxHeight = screenThreshold !== 1 ? this.#width : 0;` (usando `#width` em vez de `#height`), e nas linhas 695 e 698 multiplica `0 * auxWidth * screenThreshold` (que resulta sempre em `0`).
4. **Snapshots Inoperantes (`BrioGame.ts:546-581`)**:
   - `JSON.stringify(object)` em `BrioObject` e `BrioSprite` serializa `"{}"` porque todos os atributos sao privados (`#`).
5. **Duplicacao e Assimetria em Colisoes (`BrioGame.ts:763-781` e `BrioCollision.ts:25-126`)**:
   - `BrioGame.isColliding` ignora `collision.pos` (offset do collider) e ignora circulos.
   - `BrioCollision.isColliding` assume no teste Circulo-Retangulo que `one` e sempre o retangulo e `two` e sempre o circulo, e trata `collision.pos` do circulo como centro em um trecho e como canto superior esquerdo no `BrioSpriteRenderer.renderCollisions` (`lines 153-161`).

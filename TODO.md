# BrioJS - Roadmap e Checklist de Engenharia

Este arquivo consolida todas as funcionalidades, correcoes de bugs, refatoracoes arquiteturais e melhorias de desempenho mapeadas durante a auditoria tecnica do projeto.

> Legenda: `[ ]` Pendente | `[x]` Concluido

---

## 1.historico Concluido (Legado)

- [x] Add grid logic to the render and debugging render
- [x] Fix pivot logic in rendering
- [x] Fix rotation logic when self increasing (`+=` operator): changed from deg to rad
- [x] Change logs for a better use: logs should be shown with no archives traces, or with only the user traces, or with user and brio classes traces
- [x] Change `BrioLogger` name to `BrioConsole`
- [x] Refactors the Sprite cloning to use a `SpriteRegistry` approach

---

## 2. Correcoes de Bugs Criticos (BugFixes)

### 2.1. Ciclo de Vida, Loop e Destruicao
- [x] Corrigir calculo inicial de `deltaTime` no primeiro frame de `BrioGame.update` (inicializar `#deltaTimePreviousTime` com o timestamp inicial do `requestAnimationFrame` para evitar salto brusco no primeiro tick)
- [x] Corrigir bug destrutivo em `BrioGame.destroy` que deleta indevidamente a chave do `BrioSprite` de `#assets.sprites` ao destruir um objeto
- [x] Corrigir logica de `BrioGame.outbound` (linha 691 usa `this.#width` para `auxHeight` e multiplica `0 * auxWidth * screenThreshold`)
- [x] Corrigir `BrioObject.clone` (bloco `if (object.collision)` nunca executa porque `object` acabou de ser instanciado sem copiar `gameObject.collision`)
- [x] Corrigir atribuicao incorreta `newObject.instanceId = targetObject.clonesInstantiatedValue` em `BrioGame.instantiate` (deve referenciar o prefab/template registrado)
- [x] Remover metodos `animate`, `animateFromName`, `animateMany` e `animateInstancesOf` de `BrioUpdater` que causam dupla renderizacao no Game Loop

### 2.2. Transformacao, Escala e Renderizacao 2D
- [x] Corrigir propagacao de `BrioGame.scale` para o renderer (atualmente passado por valor primitivo no construtor de `BrioSpriteRenderer`, ignorando alteracoes posteriores em `game.scale`)
- [x] Corrigir `BrioSpriteRenderer.renderObject` para utilizar `transform.renderSize` (ou aplicar `transform.scale`) em vez de desenhar sempre com `transform.size` bruto
- [x] Corrigir setters individuais de vetores em `BrioTransform` (`position.x`, `scale.x`, `size.x`, `pivot.x`, `skew.x`) usando classes atomicas reativas (`BrioVec2` / `BrioVec3`)
- [x] Corrigir calculo de `skew` em `BrioSpriteRenderer` (respeitar `transform.pivot` em vez de fixar `size / 2`, padronizar unidade em radianos e usar `Math.tan` na matriz de cisalhamento)
- [x] Corrigir artefatos de limpeza (`clearObject`) em objetos rotacionados/escalados e artefatos de movimento em navegadores baseados em Chromium (limpeza por camada/frame e alinhamento sub-pixel opcional para pixel art)
- [x] Evitar reconfiguracao redundante de `ctx.imageSmoothingEnabled` e `ctx.imageSmoothingQuality` a cada objeto desenhado no mesmo frame

### 2.3. Matematica, Colisao, Audio e Console
- [x] Corrigir `vec2.normalize(out, v)` em `./src/math/vec2.ts` (atualmente calcula a magnitude lendo `out` em vez do vetor de entrada `v`)
- [x] Corrigir `vec2.distanceTo(a, b)` em `./src/math/vec2.ts` (retornar a distancia euclidiana escalar `number` via `Math.hypot` sem sobrescrever o vetor de origem, criando funcao separada se necessario vetor de diferenca)
- [x] Corrigir assimetria no teste Circulo-Retangulo em `BrioCollision.isColliding` (atualmente falha quando `one` e `"circle"` e `two` e `"rectangle"` ou `"square"`)
- [x] Unificar a convencao de coordenadas de `collision.pos` para circulos entre `BrioCollision.isColliding` e `BrioSpriteRenderer.renderCollisions`
- [x] Remover metodo duplicado e incompleto `BrioGame.isColliding` em favor do subsistema unificado `BrioCollision`
- [x] Inicializar `#storedErrors` e `#storedExceptions` em `BrioConsole.ts` e corrigir o statement `if (isFound) true;` na linha 121 para `if (isFound) return;`
- [x] Corrigir vazamento de `EventListener` no metodo `BrioAudio.playMany` quando utilizado com `delay` (funcao anonima criada no `addEventListener("ended", ...)` nunca e removida)
- [x] Remover URL externa hardcoded e corrigir encadeamento assincrono de `decode()` + `createImageBitmap()` em `BrioAtlas.mount()`

---

## 3. Refatoracoes Arquiteturais e Desempenho (Refactors & Performance)

### 3.1. Linguagem Ubiqua Estrita e Modularizacao da API Publica
- [x] Aplicar a regra de Linguagem Ubiqua Estrita em toda a base: remover aliases semanticos (`BrioSpriteAtlas`, `BrioLogger`, `"intangible"`) e manter apenas os termos canonicos documentados em `./GLOSSARY.md` (`BrioAtlas`, `BrioConsole`, `"trigger"`)
- [ ] Separar classes concretas `BrioObject2D` e `BrioObject3D` (bem como `BrioTransform2D` / `BrioTransform3D` e `BrioCamera2D` / `BrioCamera3D`)
- [ ] Refatorar `BrioGame` para deixar de ser um God Object, atuando como entrypoint central que aceita presets `"2d"` e `"3d"` ou um objeto completo `BrioGameConfig`
- [ ] Garantir que todas as funcoes utilitarias (`vec2`, `vec3`, `mat4`, `quat`, `BrioMath`, `BrioCollision`) sejam exportadas de forma independente para total suporte a *Tree-Shaking* (`"sideEffects": false` no `package.json`)

### 3.2. Backend ECS (Structure of Arrays) + Facade OOP e Object Pooling
- [ ] Implementar `ECSWorld` e `ComponentStorage` baseados em `TypedArrays` contiguos (`Float32Array`, `Uint32Array`, `Uint8Array`)
- [ ] Transformar `BrioObject2D` e `BrioObject3D` em Facades OOP leves (Entity Handles) cujos getters/setters leem e escrevem diretamente nos slots do ECS via `entityId`
- [ ] Implementar **Object Pooling nativo e transparente** em `ECSWorld` para `instantiate(prefab)` e `destroy(object)` em tempo $O(1)$, eliminando a flag estatica `BrioObject.instanceOfObject` e a restricao de sufixo `-[0-9]+`
- [ ] Eliminar a alocacao e ordenacao de array por frame (`Array.from(this.#assets.objects.values()).sort(...)`) em favor de listas de renderizacao pre-ordenadas por `BrioLayer` com reordenacao apenas quando uma camada for marcada como *dirty*
- [x] Eliminar criacao de closures e objetos literais em getters de leitura frequente (`BrioDebugger.console`, `BrioDebugger.render`, `BrioDebugger.#grid`)
- [x] Eliminar criacao de closures em `BrioCamera.pos` e `BrioCamera.size` durante a implementacao de `BrioCamera2D` / `BrioCamera3D`

### 3.3. Multi-Canvas, Compositor de Camadas (`BrioLayer`), Multi-Viewport e Workers (`OffscreenCanvas`)
- [ ] Implementar sistema `BrioLayer` suportando $N$ camadas configuraveis como `static` (redesenha apenas quando *dirty*), `parallax` (fator de scroll automatico), `dynamic` (redesenha por frame) e `ui` (empilhamento ordenado em Screen Space para caixas de dialogo estilo *Persona* + HUD sobreposto)
- [ ] Implementar suporte a multiplos `BrioViewport` por cena para permitir multiplayer local em tela dividida (*Split-Screen* para 2 a 4 jogadores, estilo *Gears of War*) e minimapas (*Picture-in-Picture*)
- [ ] Implementar `RenderWorker` com `OffscreenCanvas` (`transferControlToOffscreen()`) para retirar o custo de rasterizacao da Main Thread
- [ ] Implementar `PhysicsWorker` para processar Broadphase e resolucao de colisoes fora da Main Thread
- [ ] Implementar transporte de memoria do ECS com fallback automatico em 3 niveis: `SharedArrayBuffer` (zero-copy) -> `Transferable ArrayBuffer` (double-buffering) -> Main Thread (single-thread fallback)

---

## 4. Pipeline Grafico Multi-Backend (2D & 3D Zero-Dependency)

- [ ] Definir interface formal `RenderBackend` garantindo paridade visual deterministica entre todos os motores graficos
- [ ] Implementar seletor automatico de backend seguindo a cascata prioritaria: `WebGPU -> WebGL2 -> WebGL1 -> Canvas2D`
- [ ] Implementar `WebGPURenderer` (pipeline 2D de Sprite Batching e pipeline 3D de malhas e iluminacao basica)
- [ ] Implementar `WebGL2Renderer` (Instanced Drawing via VAOs e Uniform Buffer Objects para 2D e 3D)
- [ ] Implementar `WebGL1Renderer` (Dynamic Quad/Mesh Batching para GPUs legadas)
- [ ] Refatorar `Canvas2DRenderer` (suporte a `OffscreenCanvasRenderingContext2D`, multi-layer caching e **Software 3D Projector/Rasterizer** leve com *Painter's Algorithm* como fallback para cenas 3D em maquinas sem WebGL)

---

## 5. Implementacao e Polimento dos Modulos de Dominio

### 5.1. Cenas e Transformacoes (`BrioScene`, `BrioTransform2D`, `BrioTransform3D`)
- [ ] Implementar `BrioScene` completa com ciclo proprio (`preload`, `load`, `update`, `pause`, `resume`, `restart`, `destroy`) e manter uma `defaultScene` implicita em `BrioGame`
- [x] Implementar `baseSize`, `renderSize`, `visibility`, `opacity` e `layer` reativos em `BrioTransform2D`
- [ ] Implementar hierarquia Pai-Filho (`parent` / `children`) com calculo automatico de `localTransform` e `worldTransform` (via matrizes `Mat3` em 2D e `Mat4` em 3D)

### 5.2. Recursos Visuais 2D e 3D (`BrioTexture`, `BrioAtlas`, `BrioSpriteSheet`, `BrioSprite`, `BrioAnimation`, `BrioMesh`, `BrioMaterial`)
- [ ] Implementar `BrioTexture` e `TextureRegistry` (padrao Flyweight com `ImageBitmap` / texturas de GPU para evitar duplicacao de memoria por URI)
- [ ] Implementar `BrioAtlas` (mapeamento de sub-regioes nomeadas arbitrarias e factory de `BrioSprite`)
- [ ] Implementar `BrioSpriteSheet` como factory de `BrioSprite` e `BrioAnimation` a partir de grades uniformes (linhas x colunas / largura x altura de celula)
- [ ] Implementar `BrioAnimation` / `BrioAnimator` para controle de animacoes de sprites (frame rate, loop, ping-pong, callbacks de fim de animacao)
- [ ] Implementar `BrioMesh` (primitivas 3D Box, Sphere, Plane, Cylinder e parser leve para `.obj` / `.gltf`) e `BrioMaterial` / `BrioLight`

### 5.3. Cameras e Mapas (`BrioCamera2D`, `BrioCamera3D`, `BrioTileMap`)
- [ ] Implementar `BrioCamera2D` desacoplada de `BrioMap` (suporte a `follow` com `lerp` e `deadzone`, `zoom`, `rotation`, `setBounds`, `shake`, `screenToWorld`, `worldToScreen` e *Frustum Culling* 2D)
- [ ] Implementar `BrioCamera3D` (projecao `perspective` e `orthographic`, `fov`, `near`, `far`, `lookAt`, `screenToRay` e *Frustum Culling* 3D)
- [ ] Implementar `BrioTileMap` (suporte a matrizes 2D, importacao de JSON padrao Tiled/LDtk, mesclagem automatica de colliders adjacentes e renderizacao em chunks estaticos)

### 5.4. Fisica e Colisoes (`BrioCollision`, `BrioRigidBody`, Broadphase)
- [ ] Implementar resolucao fisica automatica por *Minimum Translation Vector* (MTV) para colliders do tipo `"solid"` e emissao de eventos/deteccao sem bloqueio para `"trigger"`
- [ ] Implementar `SpatialHash2D` e `SpatialOctree3D` para Broadphase automatica
- [ ] Implementar componente/perfil opcional `BrioRigidBody` (velocidade, aceleracao, gravidade, massa, atrito e restituicao)

### 5.5. Input, Audio, Serializacao, Storage e Plataforma
- [ ] Refatorar `BrioKeyboard` para usar um unico listener global na janela, expondo `BrioKeyboard.globalIsDown` e `BrioKeyboard.globalIsUp`, e aplicando `preventDefault()` apenas nas teclas configuradas
- [ ] Implementar `BrioMouse` (posicao em tela e no mundo, cliques, scroll wheel, cursor lock)
- [ ] Implementar `BrioTouch` (eventos multi-touch e gestos basicos para Web Mobile e Capacitor)
- [ ] Implementar `BrioGamepad` (polling unificado da Gamepad API, mapeamento padrao de botoes/eixos, deadzone e vibracao)
- [ ] Refatorar `BrioAudio` para utilizar **Web Audio API** (`AudioContext`, `AudioBuffer`, `GainNode` para canais Master/BGM/SFX, desbloqueio automatico de autoplay mobile) com fallback para `HTMLAudioElement`
- [ ] Implementar `BrioSerializer` com serializacao **binaria pura** (`ArrayBuffer` / `Uint8Array`) dos buffers do ECS para `createCheckpoint()`, `restoreCheckpoint()` e `restart()`, alem de tradutor opcional para JSON (`toJSON` / `fromJSON`)
- [ ] Remover a logica antiga de `#cachedObjects`, `#cachedSprites` e `JSON.stringify` de dentro de `BrioGame`
- [ ] Implementar `BrioStorage` multiplataforma (`state` em memoria, `session` via `sessionStorage`, `local` via `localStorage`, e `db` via `IndexedDB` suportando armazenamento direto dos snapshots binarios do `BrioSerializer`)
- [ ] Implementar `PlatformAdapter` para tratar particularidades de ciclo de vida, tela cheia, redimensionamento e storage entre Browser, Electron, Capacitor e ambiente Headless
- [ ] Remover `BrioUtils.addProperty` e substituir `BrioUtils.timedAnimation` e `BrioUtils.wait` pelo sistema `BrioTimer` sincronizado ao `deltaTime` e ao estado de `pause()` da cena

---

## 6. Tipagem Avancada TypeScript, Documentacao (JSDoc/ACO) e Testes

- [ ] Expandir `./src/tools/base_types.ts` com *Template Literal Types* e *Union Types* estritos para `KeyboardKey`, `MouseButton`, `GamepadButton`, `CSSColor`, `AnchorPoint` e `ViewportPreset`
- [ ] Adicionar suporte a Generics em `BrioGame` e `BrioScene` para inferencia e autocomplete de identificadores de assets e objetos registrados
- [x] Auditar e completar 100% de cobertura **JSDoc / TSDoc** em todas as classes, metodos, funcoes, propriedades e tipos publicos (foco em *Agent Context Optimization - ACO* e geracao do TypeDoc em `./docs/api/`)
- [x] Configurar suite de testes automatizados (Vitest + validacao em navegador via ChromeDevTools MCP na pasta `./demo/`) e validar antes de cada push

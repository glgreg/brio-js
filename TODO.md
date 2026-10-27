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
- [x] Separar classes concretas `BrioObject2D` e `BrioObject3D` (bem como `BrioTransform2D` / `BrioTransform3D` e `BrioCamera2D` / `BrioCamera3D`)
- [x] Refatorar `BrioGame` para deixar de ser um God Object, atuando como entrypoint central que aceita presets `"2d"` e `"3d"` ou um objeto completo `BrioGameConfig`
- [x] Garantir que todas as funcoes utilitarias (`vec2`, `vec3`, `mat4`, `quat`, `BrioMath`, `BrioCollision`) sejam exportadas de forma independente para total suporte a *Tree-Shaking* (`"sideEffects": false` no `package.json`)

### 3.2. Backend ECS (Structure of Arrays) + Facade OOP e Object Pooling
- [x] Implementar `ECSWorld` e `ComponentStorage` baseados em `TypedArrays` contiguos (`Float32Array`, `Uint32Array`, `Uint8Array`)
- [x] Transformar `BrioObject2D` e `BrioObject3D` em Facades OOP leves (Entity Handles) cujos getters/setters leem e escrevem diretamente nos slots do ECS via `entityId`
- [x] Implementar **Object Pooling nativo e transparente** em `ECSWorld` para `instantiate(prefab)` e `destroy(object)` em tempo $O(1)$, eliminando a flag estatica `BrioObject.instanceOfObject` e a restricao de sufixo `-[0-9]+`
- [x] Eliminar a alocacao e ordenacao de array por frame (`Array.from(this.#assets.objects.values()).sort(...)`) em favor de listas de renderizacao pre-ordenadas por `BrioLayer` com reordenacao apenas quando uma camada for marcada como *dirty*
- [x] Eliminar criacao de closures e objetos literais em getters de leitura frequente (`BrioDebugger.console`, `BrioDebugger.render`, `BrioDebugger.#grid`)
- [x] Eliminar criacao de closures em `BrioCamera.pos` e `BrioCamera.size` durante a implementacao de `BrioCamera2D` / `BrioCamera3D`

### 3.3. Multi-Canvas, Compositor de Camadas (`BrioLayer`), Multi-Viewport e Workers (`OffscreenCanvas`)
- [x] Implementar sistema `BrioLayer` suportando $N$ camadas configuraveis como `static` (redesenha apenas quando *dirty*), `parallax` (fator de scroll automatico), `dynamic` (redesenha por frame) e `ui` (empilhamento ordenado em Screen Space para caixas de dialogo estilo *Persona* + HUD sobreposto)
- [x] Implementar suporte a multiplos `BrioViewport` por cena para permitir multiplayer local em tela dividida (*Split-Screen* para 2 a 4 jogadores, estilo *Gears of War*) e minimapas (*Picture-in-Picture*)
- [ ] Implementar `RenderWorker` com `OffscreenCanvas` (`transferControlToOffscreen()`) para retirar o custo de rasterizacao da Main Thread
- [ ] Implementar `PhysicsWorker` para processar Broadphase e resolucao de colisoes fora da Main Thread
- [ ] Implementar transporte de memoria do ECS com fallback automatico em 3 niveis: `SharedArrayBuffer` (zero-copy) -> `Transferable ArrayBuffer` (double-buffering) -> Main Thread (single-thread fallback) *(reaberto em 2026-10-19: existe apenas a flag `useSharedMemory` no `ComponentStorage`; nao ha transporte para Workers)*

---

## 4. Pipeline Grafico Multi-Backend (2D & 3D Zero-Dependency)

- [x] Definir interface formal `RenderBackend` garantindo paridade visual deterministica entre todos os motores graficos
- [x] Implementar seletor automatico de backend seguindo a cascata prioritaria: `WebGPU -> WebGL2 -> WebGL1 -> Canvas2D`
- [ ] Implementar `WebGPURenderer` (pipeline 2D de Sprite Batching e pipeline 3D de malhas e iluminacao basica) *(hoje a cascata cai em `webgl2` porque so backends implementados sao selecionados; ver `docs/architecture/RENDERING_STUDY_THREEJS.md` secao 1 e item 8.1)*
- [ ] Implementar `WebGL2Renderer` (Instanced Drawing via VAOs e Uniform Buffer Objects para 2D e 3D) *(parcial em 2026-10-20: `WebGL2Backend` cobre malhas 3D com VAO e texturas; faltam instancing, UBOs e o pipeline 2D)*
- [ ] Implementar `WebGL1Renderer` (Dynamic Quad/Mesh Batching para GPUs legadas)
- [x] Refatorar `Canvas2DRenderer` (suporte a `OffscreenCanvasRenderingContext2D`, multi-layer caching e **Software 3D Projector/Rasterizer** leve com *Painter's Algorithm* como fallback para cenas 3D em maquinas sem WebGL)

---

## 5. Implementacao e Polimento dos Modulos de Dominio

### 5.1. Cenas e Transformacoes (`BrioScene`, `BrioTransform2D`, `BrioTransform3D`)
- [x] Implementar `BrioScene` completa com ciclo proprio (`step`, `pause`, `resume`, `createCheckpoint`, `restoreCheckpoint`, `destroy`); o conteudo registrado direto no `BrioGame` atua como cena padrao e a `BrioScene` ativa e composta apos ele *(revisado em 2026-10-19: antes a cena ativa nunca era renderizada)*
- [ ] Unificar `BrioScene.preload/load/restart` com o ciclo de vida do `BrioGame` (hoje a cena possui `ECSWorld` proprio e nao participa de `game.createCheckPoint()`)
- [x] Implementar `baseSize`, `renderSize`, `visibility`, `opacity` e `layer` reativos em `BrioTransform2D`
- [x] Implementar hierarquia Pai-Filho (`parent` / `children`) com calculo automatico de `localTransform` e `worldTransform` (via matrizes `Mat3` em 2D e `Mat4` em 3D)

### 5.2. Recursos Visuais 2D e 3D (`BrioTexture`, `BrioAtlas`, `BrioSpriteSheet`, `BrioSprite`, `BrioAnimation`, `BrioMesh`, `BrioMaterial`)
- [x] Implementar `BrioTexture` e `TextureRegistry` (padrao Flyweight com `ImageBitmap` / texturas de GPU para evitar duplicacao de memoria por URI)
- [x] Implementar `BrioAtlas` (mapeamento de sub-regioes nomeadas arbitrarias e factory de `BrioSprite`)
- [x] Implementar `BrioSpriteSheet` como factory de `BrioSprite` e `BrioAnimation` a partir de grades uniformes (linhas x colunas / largura x altura de celula)
- [x] Implementar `BrioAnimation` / `BrioAnimator` para controle de animacoes de sprites (frame rate, loop, ping-pong, callbacks de fim de animacao)
- [x] Implementar `BrioMesh` (primitivas 3D Box, Sphere, Plane, Cylinder e parser leve para `.obj` / `.gltf`) e `BrioMaterial` / `BrioLight` *(reaberto parcialmente em 2026-10-20: `BrioMesh.createCylinder` e `BrioLight` nao existem no codigo; ver 9.1 e 9.6)*

### 5.3. Cameras e Mapas (`BrioCamera2D`, `BrioCamera3D`, `BrioTileMap`)
- [x] Implementar `BrioCamera2D` desacoplada de `BrioMap` (suporte a `follow` com `lerp` e `deadzone`, `zoom`, `rotation`, `setBounds`, `shake`, `screenToWorld`, `worldToScreen` e *Frustum Culling* 2D)
- [x] Implementar `BrioCamera3D` (projecao `perspective` e `orthographic`, `fov`, `near`, `far`, `lookAt`, `screenToRay` e *Frustum Culling* 3D) *(reaberto parcialmente em 2026-10-20: `screenToRay` nao existe; ver 9.5)*
- [x] Implementar `BrioTileMap` (suporte a matrizes 2D e mesclagem automatica de colliders adjacentes)
- [ ] Implementar renderizacao de `BrioTileMap` em chunks sobre uma camada `"static"` e importacao de JSON Tiled/LDtk *(reaberto em 2026-10-19: nao havia metodo de renderizacao nem importador)*

### 5.4. Fisica e Colisoes (`BrioCollision`, `BrioRigidBody`, Broadphase)
- [x] Implementar resolucao fisica automatica por *Minimum Translation Vector* (MTV) para colliders do tipo `"solid"` e emissao de eventos/deteccao sem bloqueio para `"trigger"`
- [x] Implementar `SpatialHash2D` e `SpatialOctree3D` para Broadphase automatica
- [x] Implementar componente/perfil opcional `BrioRigidBody` (velocidade, aceleracao, gravidade, massa, atrito e restituicao)

### 5.5. Input, Audio, Serializacao, Storage e Plataforma
- [x] Refatorar `BrioKeyboard` para usar um unico listener global na janela, expondo `BrioKeyboard.globalIsDown` e `BrioKeyboard.globalIsUp`, e aplicando `preventDefault()` apenas nas teclas configuradas
- [x] Implementar `BrioMouse` (posicao em tela e no mundo, cliques, scroll wheel, cursor lock)
- [x] Implementar `BrioTouch` (eventos multi-touch e gestos basicos para Web Mobile e Capacitor)
- [x] Implementar `BrioGamepad` (polling unificado da Gamepad API, mapeamento padrao de botoes/eixos, deadzone e vibracao)
- [ ] Refatorar `BrioAudio` para utilizar **Web Audio API** (`AudioContext`, `AudioBuffer`, `GainNode` para canais Master/BGM/SFX, desbloqueio automatico de autoplay mobile) com fallback para `HTMLAudioElement`
- [x] Implementar `BrioSerializer` com serializacao **binaria pura** (`ArrayBuffer` / `Uint8Array`) dos buffers do ECS para `createCheckpoint()`, `restoreCheckpoint()` e `restart()`, alem de tradutor opcional para JSON (`toJSON` / `fromJSON`)
- [x] Remover a logica antiga de `#cachedObjects`, `#cachedSprites` e `JSON.stringify` de dentro de `BrioGame`
- [x] Implementar `BrioStorage` multiplataforma (`state` em memoria, `session` via `sessionStorage`, `local` via `localStorage`, e `db` via `IndexedDB` suportando armazenamento direto dos snapshots binarios do `BrioSerializer`)
- [x] Implementar `PlatformAdapter` para tratar particularidades de ciclo de vida, tela cheia, redimensionamento e storage entre Browser, Electron, Capacitor e ambiente Headless
- [x] Remover `BrioUtils.addProperty` e substituir `BrioUtils.timedAnimation` e `BrioUtils.wait` pelo sistema `BrioTimer` sincronizado ao `deltaTime` e ao estado de `pause()` da cena

---

## 6. Tipagem Avancada TypeScript, Documentacao (JSDoc/ACO) e Testes

- [ ] Expandir `./src/tools/base_types.ts` com *Template Literal Types* e *Union Types* estritos para `KeyboardKey`, `MouseButton`, `GamepadButton`, `CSSColor`, `AnchorPoint` e `ViewportPreset`
- [ ] Adicionar suporte a Generics em `BrioGame` e `BrioScene` para inferencia e autocomplete de identificadores de assets e objetos registrados
- [x] Auditar e completar 100% de cobertura **JSDoc / TSDoc** em todas as classes, metodos, funcoes, propriedades e tipos publicos (foco em *Agent Context Optimization - ACO* e geracao do TypeDoc em `./docs/api/`)
- [x] Configurar suite de testes automatizados (Vitest + validacao em navegador via ChromeDevTools MCP na pasta `./demo/`) e validar antes de cada push

---

## 7. Revisao Tecnica de 2026-10-19 (Integridade dos `[x]` e Integracao no Game Loop)

### 7.1. Concluido nesta revisao
- [x] Handles de entidade com geracao (`ECSWorld.generationOf`, `isAlive(id, generation)`) e `unbindECS()` em `BrioTransform2D` / `BrioTransform3D`: `destroy()` nao permite mais que referencias obsoletas escrevam em slots reciclados
- [x] `bindECS(storage, id, adopt)` para religar handles apos `restoreSnapshot`; `restoreCheckPoint()` / `restart()` restauram tambem o conjunto de objetos registrados
- [x] `BrioCompositor` integrado ao `BrioGame`: camadas `BrioLayer` (`static` com cache offscreen, `parallax`, `dynamic` com culling, `ui`), um passe por `BrioCamera2D`/`BrioViewport`, passes 3D por `BrioCamera3D` via `RenderBackend` e composicao da `BrioScene` ativa
- [x] Remocao de `Array.from(...).sort(...)` por frame do game loop (o item 3.2 estava marcado sem a mudanca no `BrioGame`)
- [x] `BrioRenderer.selectBestBackendType` restrito a backends implementados e `BrioRenderer.createBackend()`
- [x] `Canvas2DBackend`: sombreamento difuso aplicado (o `shade` era calculado e descartado) e triangulos reutilizados sem alocacao por frame
- [x] Linguagem Ubiqua: `BrioObject` -> `BrioObject2D`, `BrioTransform` -> `BrioTransform2D`; remocao de `src/not-implemented/` (`BrioMap`, `BrioCamera`) dos exports e do `BrioGame`
- [x] Remocao da flag `BrioObject.instanceOfObject` e da restricao de nomes `-[0-9]+` (o item 3.2 estava marcado sem a mudanca)
- [x] `ComponentStorage` com layout opcional: preset `"2d"` nao aloca `transform3D` (ADR-0004); snapshots binarios v2 registram o layout e continuam lendo v1
- [x] `ECSWorld.query(mask, out)` sem alocacao, `clearAllDirty` limitado ao high-water mark, cache de `PlatformAdapter.detectCapabilities()` com liberacao dos contextos WebGL de sondagem e checagem de `crossOriginIsolated`
- [x] `BrioGame.maxDeltaTime` (padrao 0.1 s) para abas com `requestAnimationFrame` limitado, e `BrioCamera2D.follow` convergindo exatamente (sem drift sub-pixel invalidando caches estaticos)
- [x] `package.json`: remocao do export quebrado `./types`, URLs e descricao atualizadas
- [x] Demo `demo/test-2d-split-screen-layers--19-10-26` cobrindo camadas, split-screen, PiP 3D, pooling e sonda de handles obsoletos
- [x] `Canvas2DBackend`: backface culling invertido (descartava as faces frontais e desenhava as traseiras) corrigido
- [x] `Canvas2DBackend`: ordenacao do Painter's Algorithm por passe inteiro (todas as malhas), com rasterizacao no `endFrame()`; antes cada malha era ordenada isoladamente e a ultima submetida cobria as anteriores
- [x] `Canvas2DBackend`: um unico `fill()` por triangulo com tons difusos em cache (sem a segunda passada de escurecimento), dilatacao de 0.5 px contra frestas de antialiasing, agrupamento de triangulos consecutivos do mesmo tom e strokes de wireframe limitados a 64 triangulos por path (105k triangulos em um path levavam ~16 s por frame)
- [x] Demo `demo/test-3d-glb-malfoy-model--19-10-26` e `tests/assets/GLBRealAsset.test.ts` com um GLB real do Sketchfab pelo ciclo `preload -> load -> update` do `BrioGame`

### 7.1.1. Backend WebGL2 (2026-10-20, estudo do three.js em `study/three.js`)
- [x] `WebGL2Backend`: geometria enviada ao GPU uma vez por malha (VAO + buffers `STATIC_DRAW`), um draw call por malha, cache de estado GL, programas por variante de shader, render list opaca (programa, material, frente-para-tras) e transparente (tras-para-frente), espelhamento com `frontFace(CW)`, perda de contexto tratada
- [x] Texturas sRGB (`SRGB8_ALPHA8`) com mipmaps e anisotropia; iluminacao em espaco linear e saida sRGB; `baseColorFactor` tratado como linear
- [x] `BrioMaterial.doubleSided` e `alphaCutoff` (glTF `doubleSided`, `alphaMode: "MASK"`)
- [x] `BrioRenderer` registra `webgl2` na cascata; `BrioGame` cai para `canvas2d` se o contexto WebGL2 falhar
- [x] Demo `test-3d-glb-malfoy-model`: modo texturizado, troca de backend por `?backend=`; 105k triangulos a 60 fps (~0,3 ms de CPU por frame, antes ~90 ms)
- [x] Testes: `WebGL2Backend.test.ts` (contexto GL falso), `GLBMaterialsAndNodes.test.ts`

### 7.2. Pendencias identificadas
- [ ] Tornar o lerp de `BrioCamera2D.follow` independente de framerate (`1 - (1 - lerp)^(dt * 60)`)
- [ ] Avaliar renomear `transform.layer` (profundidade dentro de uma `BrioLayer`) para `transform.depth`, evitando colisao com o termo canonico `Layer` do `GLOSSARY.md`
- [ ] `demo-2d-shooter--18-10-26`: `soldier.png` e uma spritesheet 900x700 desenhada inteira em 64x64; usar `BrioSpriteSheet` para recortar o frame
- [ ] Decidir sobre os 231 assets binarios versionados em `demo/demo-2d-shooter--18-10-26/assets/` (o `.gitignore` cobre apenas `/assets/` na raiz)
- [ ] `test-3d-glb-scene--18-10-26` depende de GLBs ausentes localmente em `assets/3d/glb/` (`gwen_tennyson.glb`, `spider_gwen.glb`)
- [x] `GLBLoader`: carregar `baseColorTexture` (embutido via `bufferView`, `data:` URI ou URI externa), decodificado uma vez por imagem com `createImageBitmap`
- [x] `GLBLoader` / `BrioModel.instantiate`: associar material por `primitive.material` em vez do indice da parte
- [ ] Prefixar nomes de malhas/materiais com o nome do modelo para evitar colisoes no registro global (`"Face"`, `"Hair"`)
- [x] `GLBLoader`: aplicar as transformacoes dos nos (`matrix` / TRS) em malhas sem skin (malhas com skin ignoram o no, conforme a spec)
- [ ] `GLBLoader`: skinning (`JOINTS_0` / `WEIGHTS_0`) e animacoes; hoje o modelo fica no bind pose
- [x] `Canvas2DBackend`: shading `"lambert"` com a media das 3 normais e suporte a `doubleSided`
- [ ] `Canvas2DBackend`: clipping no near plane (triangulos com vertices atras da camera sao projetados sem recorte); sem amostragem de textura
- [ ] `WebGL2Backend`: frustum culling por objeto (bounding sphere, como `Frustum.intersectsObject` do three.js), luzes configuraveis/IBL, `alphaMode: "BLEND"` por texel, malhas mutaveis (versionamento de buffers)
- [ ] `WebGPU` e `WebGL1` backends (cascata ADR-0001) *(detalhado em 8.1)*
- [ ] `BrioModel.instantiate`: partes filhas nao sao registradas no ECS (apenas a raiz), entao checkpoints nao cobrem transforms das partes

---

## 8. Melhorias Mapeadas em 2026-10-20 (Engine Existente)

> Referencias: `docs/architecture/RENDERING_STUDY_THREEJS.md` (estudo do three.js) e as revisoes das secoes 7.x.

### 8.1. Pipeline Grafico
- [ ] `WebGPUBackend` (WGSL escrito a mao com variantes por feature, cache de pipelines com `createRenderPipelineAsync`, bind groups por frequencia de atualizacao: frame/material/objeto, mipmaps por render pass, timestamp queries); registrar na cascata
- [ ] Cascata com fallback real: se `init()` do backend escolhido falhar (ex.: `requestAdapter()` retorna `null`), tentar o **proximo** da cascata (`webgpu -> webgl2 -> webgl1 -> canvas2d`), nao direto o `canvas2d`
- [ ] Camada comum `GpuResourceCache` / render list compartilhada entre `WebGL2Backend` e `WebGPUBackend` (equivalente a `src/renderers/common` do three.js): ordenacao, culling e chaves de feature escritas uma vez
- [ ] `WebGL1Backend` (sem VAO nativo: `OES_vertex_array_object`; indices Uint32 via `OES_element_index_uint`; sem sRGB nativo: `EXT_sRGB` ou conversao no shader)
- [ ] Frustum culling por objeto nos passes 3D (`BrioCamera3D` ja tem culling por esfera; falta bounding sphere em `BrioMesh` e uso no `BrioCompositor.#render3DPasses`)
- [ ] Pipeline 2D na GPU: sprite batching (atlas + buffer dinamico de quads), para as camadas 2D tambem sairem do Canvas2D; manter `Canvas2D` como fallback
- [ ] Instancing (`BrioObject3D` com a mesma malha/material em um draw) e batching de malhas estaticas
- [ ] Tone mapping (Neutral/ACES/AgX) e exposicao configuraveis; saida HDR futura
- [ ] Anti-aliasing configuravel (MSAA ligado/desligado, FXAA/SMAA como pos-processo) e `devicePixelRatio` / resolution scale
- [ ] Malhas mutaveis: versionar `BrioMesh` e reenviar apenas buffers alterados (`bufferSubData`)
- [ ] `alphaMode: "BLEND"` por texel (hoje aproximado por alpha test 0.5) e ordenacao por objeto de transparentes
- [ ] Compressao de texturas (KTX2/Basis Universal) e limites de tamanho de textura por dispositivo
- [ ] Captura de frame em todos os backends (`game.captureFrame(): Promise<Blob>`): requisito do MCP (10.1)
- [ ] Estatisticas de render unificadas no `RenderBackend` (`drawCalls`, `trianglesRendered`, programas/pipelines, memoria de GPU) expostas em `game.renderStats`
- [ ] Recuperacao de perda de contexto testada no navegador (`WEBGL_lose_context`), incluindo reenvio de texturas
- [ ] `Canvas2DBackend`: clipping no near plane; opcao de manter culling mesmo em materiais `doubleSided` para ganhar desempenho (hoje ~230 ms/frame em 105k triangulos)

### 8.2. Assets e Loaders
- [ ] glTF: skinning (`JOINTS_0` / `WEIGHTS_0`, `inverseBindMatrices`) com skinning na GPU e fallback na CPU
- [ ] glTF: animacoes (`animations`, samplers `LINEAR` / `STEP` / `CUBICSPLINE`) integradas a um `BrioAnimator3D`
- [ ] glTF: morph targets, `KHR_materials_emissive_strength`, `KHR_texture_transform`, `KHR_materials_unlit`, `KHR_mesh_quantization`, `EXT_meshopt_compression`, `KHR_draco_mesh_compression` (avaliar custo vs zero-dependency)
- [ ] glTF: normal map, metallic-roughness, occlusion e emissive textures (requer o modelo PBR de 9.1)
- [ ] glTF: preservar a hierarquia de nos como `BrioObject3D` filhos (hoje as transformacoes sao "assadas" nas malhas) e instancias de malha compartilhada
- [ ] Prefixar nomes de malhas/materiais com o nome do modelo (colisoes no registro global, ex.: `"Face"`, `"Hair"`)
- [ ] Partes filhas de `BrioModel.instantiate` registradas no ECS (checkpoints nao cobrem as partes)
- [ ] Limites de recursos ao parsear glTF/GLB (tamanho de buffers, dimensoes de imagens) contra arquivos hostis
- [ ] Carregamento de assets em Worker (parse de GLB e decode de imagens fora da Main Thread) e progresso de preload (`onProgress`)
- [ ] Liberacao de assets (`dispose`) e contagem de referencias entre cenas

### 8.3. Core, ECS e Desempenho
- [ ] Simulacao em passo fixo (`fixedTimestep`) com interpolacao de render, separada do `requestAnimationFrame`
- [ ] Gerador pseudoaleatorio com semente (`BrioRandom`) para replays deterministicos (requisito do MCP, 10.1)
- [ ] Componentes customizados do usuario no ECS (registro de componentes SoA alem de transform/fisica)
- [ ] Sistemas (`BrioSystem`) com ordem de execucao declarada (pre-update, update, post-update, render)
- [ ] Benchmarks automatizados (entidades/frame, triangulos/frame, alocacoes por frame) rodando no CI
- [ ] Profiler embutido no `BrioDebugger` (tempo por sistema, por passe de render, GPU timestamps)

### 8.4. Qualidade, Testes e Tooling
- [ ] Testes visuais automatizados (imagem dourada por demo, comparacao com tolerancia) no navegador headless
- [ ] Pipeline de CI (GitHub Actions): `tsc`, Vitest, build, testes visuais
- [ ] Mover as demos para um repositorio/pacote de exemplos com assets proprios (a pasta `demo/` passou a ser apenas local em 2026-10-20) ou hospedar os assets em um bucket
- [ ] Tornar o `TODO.md` compativel com Prettier (o arquivo ja divergia do formatador antes desta revisao)

---

## 9. Novas Funcionalidades Necessarias

### 9.1. Iluminacao e Materiais
- [ ] `BrioLight` (ECS): `directional`, `point`, `spot`, `hemisphere`, `ambient`, com cor, intensidade (unidades fisicas opcionais), alcance e decaimento
- [ ] Upload de luzes por Uniform Buffer Object (WebGL2) / bind group (WebGPU) com hash de estado para evitar reenvio
- [ ] Modelo de material PBR (metallic-roughness, GGX, Fresnel-Schlick) alinhado ao glTF, mantendo `lambert`/`unlit`/`flat` para estilos simples
- [ ] Image-Based Lighting: mapa de ambiente (HDR equirectangular), pre-filtragem (PMREM) e ambiente procedural padrao (equivalente ao `RoomEnvironment`)
- [ ] Sombras: shadow maps direcionais (cascaded para cenas grandes), spot e point; PCF/soft shadows
- [ ] Skybox / fundo por cubemap ou equirectangular, e neblina (`linear`, `exponential`)
- [ ] Materiais `toon` (cel shading com rampa) e outline, coerentes com o publico educacional/estilizado
- [ ] Iluminacao 2D (luzes pontuais e normal maps em sprites) para as camadas 2D na GPU

### 9.2. Audio
- [ ] `BrioAudio` sobre Web Audio API (`AudioContext`, `AudioBuffer`, barramentos Master/BGM/SFX com `GainNode`, desbloqueio de autoplay mobile) com fallback para `HTMLAudioElement` (item 5.5 em aberto)
- [ ] Audio 3D espacial: `PannerNode` (HRTF) por `BrioObject3D`, `AudioListener` acoplado a `BrioCamera3D`, atenuacao por distancia, cones direcionais
- [ ] Audio 2D posicional (pan estereo por posicao no mundo relativa a `BrioCamera2D`)
- [ ] Efeitos: reverb por zona (`ConvolverNode`), filtros (oclusao com `BiquadFilterNode`), ducking da musica
- [ ] Musica: crossfade, loops com pontos de intro/loop, camadas adaptativas
- [ ] Pool de vozes com limite de instancias simultaneas por som e prioridade

### 9.3. Animacao
- [ ] `BrioAnimator3D`: clipes de glTF, blending, crossfade, layers e mascaras por osso
- [ ] Tweens (`BrioTween`) com easings para qualquer propriedade numerica (transform, opacidade, cor)
- [ ] Maquina de estados de animacao (2D e 3D) declarativa
- [ ] Animacao por esqueleto 2D (estilo Spine/DragonBones) como fase futura

### 9.4. Fisica 3D
- [ ] Resolucao de colisao 3D (hoje apenas broadphase `SpatialOctree3D` e colliders): AABB, esfera, capsula, OBB
- [ ] `BrioRigidBody` 3D (gravidade, massa, atrito, restituicao) e controlador de personagem (capsula com degraus e rampas)
- [ ] Raycast/shapecast no mundo 2D e 3D (`world.raycast(origin, dir)`), base para tiros, selecao e IA
- [ ] Colisao contra malhas estaticas (triangle mesh) com BVH
- [ ] Joints simples (distancia, dobradica) como fase futura

### 9.5. Input e Interacao
- [ ] `BrioCamera3D.screenToRay` (marcado como feito em 5.3, mas inexistente) e picking de objetos 3D
- [ ] Mapeamento de acoes (`BrioInputMap`: "jump" -> Space/A/toque) com rebinding em tempo de execucao
- [ ] Controles de camera prontos: orbit, first-person, third-person (pointer lock)
- [ ] Controles virtuais na tela para mobile (joystick e botoes)
- [ ] Injecao de input sintetico independente do DOM (requisito do MCP, 10.1)

### 9.6. Conteudo, Cenas e UI
- [ ] `BrioMesh.createCylinder`, `createCapsule`, `createCone`, `createTorus` (cylinder marcado como feito em 5.2, mas inexistente)
- [ ] Formato declarativo de cena e prefab (`BrioSceneDocument`, JSON com schema gerado dos tipos TypeScript): salvar, carregar, diff (requisito do MCP, 10.1)
- [ ] Sistema de UI em tela (texto com fontes, botoes, paineis, barras, layout ancorado, foco por teclado/gamepad) sobre a camada `"ui"`
- [ ] Sistema de dialogos estilo visual novel (o `TARGET_ARCHITECTURE` cita caixas estilo *Persona*)
- [ ] Particulas 2D e 3D (emissores, curvas de vida/cor/tamanho, GPU quando disponivel)
- [ ] Renderizacao de `BrioTileMap` em chunks e importacao Tiled/LDtk (item 5.3 em aberto)
- [ ] Gerenciamento de cenas com transicoes (fade, wipe) e carregamento assincrono

### 9.7. Plataforma, Rede e Distribuicao
- [ ] Persistencia de saves com versionamento/migracao de snapshots
- [ ] Multiplayer em rede (WebSocket/WebRTC) com sincronizacao baseada nos snapshots binarios do ECS (rollback/lockstep como pesquisa)
- [ ] PWA (offline, manifest) e empacotamento Electron/Capacitor documentados
- [ ] Acessibilidade: remapeamento de controles, legendas, modos de daltonismo, reducao de movimento
- [ ] Localizacao (i18n) de textos de UI
- [ ] WebXR (VR/AR) como fase futura sobre os backends GPU

---

## 10. MCP: Criacao de Jogos por Plataformas Agenticas

> Estudo completo e arquitetura proposta: `docs/architecture/MCP_GAME_AUTHORING.md`. Decisao: `docs/adr/0006-mcp-agentic-game-authoring.md` (status *Proposed*). Alvo: especificacao MCP **2026-07-28** (stateless, sem handshake `initialize`, extensoes Tasks e MCP Apps).

### 10.1. Fase 0: Pre-requisitos na engine
- [ ] Formato declarativo `BrioSceneDocument` + JSON Schema 2020-12 gerado dos tipos (base de `brio_scene_patch`)
- [ ] `game.step(dt)` em passo fixo + `BrioRandom` com semente: replays deterministicos
- [ ] API de introspeccao: entidades e componentes, assets, camadas, cameras, cenas e estatisticas de render
- [ ] Injecao de input sintetico (teclado, mouse, toque, gamepad) pelas classes `Brio*` de input, sem DOM
- [ ] `game.captureFrame()` em todos os backends (Canvas2D, WebGL2, WebGPU) e no modo headless
- [ ] Diff de snapshots binarios por entidade (`BrioSerializer.diff(a, b)`)
- [ ] Hot reload de documentos de cena e assets preservando o estado do ECS quando possivel

### 10.2. Fase 1: Servidor somente leitura (stdio)
- [ ] Pacote `@brio-js/mcp` com o SDK TypeScript v2 (`@modelcontextprotocol/server`), opt-in explicito da revisao 2026-07-28, `server/discover`
- [ ] Recursos de documentacao: `brio://docs/glossary`, `brio://docs/api/{symbol}` (gerado do TypeDoc JSON), `brio://docs/adr/{n}`, `brio://schema/scene`
- [ ] Runtime headless: `brio_game_run` (headless), `brio_game_step`, `brio_game_stats`, `brio_entity_inspect`, `brio_game_screenshot` (Canvas2D headless)
- [ ] Jogos enderecados por handles explicitos (`gameId`) passados como argumento (protocolo sem sessoes)
- [ ] Catalogo deterministico e ordenado, anotacoes `readOnlyHint` / `destructiveHint` / `idempotentHint`, `outputSchema` em todas as tools

### 10.3. Fase 2: Autoria
- [ ] Tools de projeto: `brio_project_create` (scaffold com `AGENTS.md` e `.mcp.json`), `brio_project_info`, `brio_project_build`, `brio_project_test` (falhas do Vitest como `structuredContent`)
- [ ] Tools de cena e entidade: `brio_scene_list/read/create/patch/delete`, `brio_entity_add/update/remove`, `brio_prefab_create`
- [ ] Tools de assets: `brio_asset_list`, `brio_asset_import` (valida glTF/PNG/audio e reporta `BrioModel.warnings`), `brio_asset_inspect`
- [ ] Perfis de tools (`read` padrao, `author`, `play`, `full`) para limitar o consumo de contexto
- [ ] Confirmacao de operacoes destrutivas via Multi Round-Trip Requests (elicitation `input_required`)
- [ ] Seguranca: escopo de filesystem restrito ao projeto (Roots esta depreciado), normalizacao de caminhos, aviso de working tree sujo e sugestao de branch por sessao do agente

### 10.4. Fase 3: Runtime ao vivo
- [ ] Pacote `@brio-js/devtools` (ponte WebSocket no navegador, ativada por `BrioGame({ devtools: true })` ou `?brio-devtools=<token>`, removida por tree-shaking em producao)
- [ ] Servidor de ponte somente em loopback, validacao de `Origin`, token aleatorio por jogo, timeouts explicitos e sem reenvio de tool calls expiradas
- [ ] `brio_game_run` no navegador/Electron, `brio_input_send`, `brio_checkpoint_create/restore/diff`
- [ ] Recursos assinaveis via `subscriptions/listen`: `brio://game/{id}/console`, `/stats`, `/entities`
- [ ] `brio_game_eval` apenas no perfil `full`, marcado como destrutivo (equivale a execucao de codigo)

### 10.5. Fase 4: MCP Apps e Tasks
- [ ] MCP App `ui://brio/player` (`text/html;profile=mcp-app`): jogo rodando dentro do chat do agente, com FPS, inspetor de entidades e controles; CSP declarada em `_meta.ui.csp`
- [ ] Extensao Tasks (`io.modelcontextprotocol/tasks`) para operacoes longas: build, importacao em lote, suites de playtest e regressao visual
- [ ] `brio_playtest_record` / `brio_playtest_replay` (input deterministico + assercoes) e `brio_visual_snapshot` (imagem dourada com tolerancia)
- [ ] Transporte Streamable HTTP para uso hospedado/remoto (OAuth 2.1 com Client ID Metadata Documents), rastreamento via OpenTelemetry em `_meta`

### 10.6. Fase 5: Ecossistema
- [ ] Agent Skill `brio-game-dev` (`SKILL.md`, padrao agentskills.io) com fluxos: novo jogo, nova cena, importar glTF, HUD, testes, regressao visual
- [ ] `create-brio-game` (scaffolder usado tambem por `brio_project_create`)
- [ ] `llms.txt` gerado a partir do TypeDoc para agentes sem MCP
- [ ] Publicacao em registros MCP e configuracoes prontas para Claude Code, Claude Desktop, Codex, Cursor, VS Code/Copilot e Gemini CLI
- [ ] Suite de avaliacao: agentes constroem N jogos de referencia e sao pontuados por testes, desempenho e regressao visual
- [ ] Decidir as questoes abertas do estudo (cena declarativa como formato primario, scripting de comportamento, fidelidade do screenshot headless, distribuicao `npx` vs binario)

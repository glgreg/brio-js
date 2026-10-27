# Arquitetura do Projeto - BrioJS Engine

## 1. Visao Geral do Sistema

A BrioJS opera sob uma arquitetura em duas camadas estritamente delimitadas:
- **Superficie Publica (Ergonomia e Didatica)**: Orientada a Objetos (`BrioGame`, `BrioScene`, `BrioObject2D`, `BrioObject3D`, `BrioCamera2D`, `BrioCamera3D`) combinada a funcoes utilitarias puras e *tree-shakeable* (`vec2`, `vec3`, `mat4`, `quat`, `BrioMath`, `BrioCollision`).
- **Nucleo Interno (Alto Desempenho)**: Baseado em **ECS Data-Oriented (Structure of Arrays - SoA)** onde o estado reside em `TypedArrays` contiguos (`SharedArrayBuffer` opcional, `ArrayBuffer` por padrao). Alvo: processamento por Web Workers (`PhysicsWorker` e `RenderWorker` via `OffscreenCanvas`) - **ainda nao implementado**, hoje tudo roda na Main Thread.

## 2. Stack Tecnologica

- **Linguagem**: TypeScript estrito (`strict: true`), explorando *Template Literal Types*, *Discriminated Unions* e *Generics*.
- **Dependencias de Runtime**: Zero (*Dependency-Free*).
- **APIs Graficas (Cascata Alvo)**: `WebGPU -> WebGL2 -> WebGL1 -> Canvas2D`. **Implementado hoje**: apenas `Canvas2D` (com *Software 3D Projector*). `BrioRenderer.selectBestBackendType` so retorna backends implementados.
- **Audio**: Alvo Web Audio API (`AudioContext`, `AudioBuffer`, `GainNode`). **Implementado hoje**: apenas `HTMLAudioElement`.
- **Persistencia**: `BrioSerializer` (snapshots binarios puros em `ArrayBuffer` com tradutor opcional para JSON) integrado ao `BrioStorage` (`memory`, `sessionStorage`, `localStorage`, `IndexedDB`).

## 3. Padroes Arquiteturais e Regras Estruturais

1. **Entrypoint Central com Presets (`BrioGame`)**:
   - `BrioGame` centraliza a inicializacao aceitando os presets `"2d"`, `"3d"` e `"hybrid"` ou um objeto detalhado `BrioGameConfig`. O conteudo do proprio jogo e o da `BrioScene` ativa sao compostos a cada frame pelo `BrioCompositor`.
   - O preset `"2d"` aloca um `ECSWorld` sem buffer `transform3D` e rejeita `BrioObject3D`.
2. **Separacao Concreta 2D e 3D**:
   - Entidades 2D e 3D sao classes concretas distintas (`BrioObject2D` vs `BrioObject3D`, `BrioTransform2D` vs `BrioTransform3D`, `BrioCamera2D` vs `BrioCamera3D`), garantindo que jogos 2D nao paguem custo de memoria 3D e preservando *tree-shaking*.
3. **Entity Handle (Facade OOP sobre ECS)**:
   - Instancias de `BrioObject2D` e `BrioObject3D` guardam o handle `(entityId, entityGeneration)`; seus getters/setters e vetores atomicos (`BrioVec2`, `BrioVec3`, `BrioQuat`) leem e escrevem diretamente nos `TypedArrays` do `ECSWorld` com *dirty flags*, sem alocar closures.
   - `ECSWorld` incrementa a geracao do slot em `destroyEntity`/`clear`; `destroy()` chama `transform.unbindECS()` para que referencias obsoletas nunca escrevam em slots reciclados. Restauracoes de snapshot religam os handles com `bindECS(storage, id, adopt = true)`.
4. **Object Pooling Transparente e Registry Pattern**:
   - `instantiate()` e `destroy()` reciclam entidades em $O(1)$ no pool interno do ECS.
   - Texturas e recursos brutos utilizam o padrao *Flyweight / Registry* (`BrioTexture` + `TextureRegistry`).
5. **Compositor de Camadas (`BrioLayer`) e Multi-Viewport (Split-Screen)**:
   - Suporte a $N$ camadas (`static` com cache offscreen por camera, `parallax`, `dynamic` com frustum culling, `ui` em screen space) e multiplos `BrioViewport` simultaneos (um passe por `BrioCamera2D`) para multiplayer local em tela dividida.
   - Ordem de composicao por fonte (jogo, depois cena ativa): passes 2D por camera -> passes 3D por `BrioCamera3D` -> camadas `ui`. Implementacao em `src/rendering/BrioCompositor.ts`.
   - Iteracao no game loop usa arrays densos (`BrioRegistry`) e comparadores de modulo: nada de `Array.from`, `.sort()` incondicional ou closures por frame.

## 4. Documentacao de Referencia

Caminhos relativos a este arquivo (`brio-agent/memory/`):

- Glossario de Dominio: `../../GLOSSARY.md`
- Auditoria do Codigo Inicial: `../../docs/architecture/CODEBASE_AUDIT.md`
- Especificacao da Arquitetura Alvo: `../../docs/architecture/TARGET_ARCHITECTURE.md`
- Architecture Decision Records (ADRs): `../../docs/adr/`
- Checklist de Tarefas e Correcoes: `../../TODO.md`

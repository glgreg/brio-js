# Arquitetura do Projeto - BrioJS Engine

## 1. Visao Geral do Sistema

A BrioJS opera sob uma arquitetura em duas camadas estritamente delimitadas:
- **Superficie Publica (Ergonomia e Didatica)**: Orientada a Objetos (`BrioGame`, `BrioScene`, `BrioObject2D`, `BrioObject3D`, `BrioCamera2D`, `BrioCamera3D`) combinada a funcoes utilitarias puras e *tree-shakeable* (`vec2`, `vec3`, `mat4`, `quat`, `BrioMath`, `BrioCollision`).
- **Nucleo Interno (Alto Desempenho)**: Baseado em **ECS Data-Oriented (Structure of Arrays - SoA)** onde o estado reside em `TypedArrays` contiguos (`SharedArrayBuffer` com fallback para `Transferable ArrayBuffer` e Main Thread), processado por sistemas dedicados e Web Workers (`PhysicsWorker` e `RenderWorker` via `OffscreenCanvas`).

## 2. Stack Tecnologica

- **Linguagem**: TypeScript estrito (`strict: true`), explorando *Template Literal Types*, *Discriminated Unions* e *Generics*.
- **Dependencias de Runtime**: Zero (*Dependency-Free*).
- **APIs Graficas Suportadas (Cascata de Fallback)**: `WebGPU -> WebGL2 -> WebGL1 -> Canvas2D` (incluindo *Software 3D Projector* de fallback no `Canvas2D`).
- **Audio**: Web Audio API (`AudioContext`, `AudioBuffer`, `GainNode`) com fallback para `HTMLAudioElement`.
- **Persistencia**: `BrioSerializer` (snapshots binarios puros em `ArrayBuffer` com tradutor opcional para JSON) integrado ao `BrioStorage` (`memory`, `sessionStorage`, `localStorage`, `IndexedDB`).

## 3. Padroes Arquiteturais e Regras Estruturais

1. **Entrypoint Central com Presets (`BrioGame`)**:
   - `BrioGame` centraliza a inicializacao aceitando os presets `"2d"` e `"3d"` ou um objeto detalhado `BrioGameConfig`, mantendo uma `defaultScene` implicita para jogos de cena unica e suportando multiplas `BrioScene` para jogos complexos.
2. **Separacao Concreta 2D e 3D**:
   - Entidades 2D e 3D sao classes concretas distintas (`BrioObject2D` vs `BrioObject3D`, `BrioTransform2D` vs `BrioTransform3D`, `BrioCamera2D` vs `BrioCamera3D`), garantindo que jogos 2D nao paguem custo de memoria 3D e preservando *tree-shaking*.
3. **Entity Handle (Facade OOP sobre ECS)**:
   - Instancias de `BrioObject2D` e `BrioObject3D` guardam apenas o `entityId` numerico; seus getters/setters e vetores atomicos (`BrioVec2`, `BrioVec3`) leem e escrevem diretamente nos `TypedArrays` do `ECSWorld` com *dirty flags*, sem alocar closures.
4. **Object Pooling Transparente e Registry Pattern**:
   - `instantiate()` e `destroy()` reciclam entidades em $O(1)$ no pool interno do ECS.
   - Texturas e recursos brutos utilizam o padrao *Flyweight / Registry* (`BrioTexture` + `TextureRegistry`).
5. **Compositor de Camadas (`BrioLayer`) e Multi-Viewport (Split-Screen)**:
   - Suporte a $N$ camadas (`static`, `parallax`, `dynamic`, `ui` ordenada para dialogos sobrepostos e HUDs) e multiplos `BrioViewport` simultaneos por cena para multiplayer local em tela dividida.

## 4. Documentacao de Referencia

- Glossario de Dominio: `./GLOSSARY.md`
- Auditoria do Codigo Inicial: `./docs/architecture/CODEBASE_AUDIT.md`
- Especificacao da Arquitetura Alvo: `./docs/architecture/TARGET_ARCHITECTURE.md`
- Architecture Decision Records (ADRs): `./docs/adr/`
- Checklist de Tarefas e Correcoes: `./TODO.md`

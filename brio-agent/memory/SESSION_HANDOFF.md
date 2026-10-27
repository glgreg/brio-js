# Handoff de Sessão — 2026-10-27

> Arquivo de retomada. No boot, ler após `STATE.md`. Ele resume a sessão de 2026-10-17 a 2026-10-27 e lista o que falta para a **primeira versão funcional (v0.1.0)**. Detalhes completos estão em `TODO.md` (seções 7 a 10) e em `docs/architecture/`.

## 1. Estado atual (fim da sessão)

- **Branch de trabalho:** `refactor`. O **PR #6** (`refactor -> develop`) está aberto em https://github.com/glgreg/brio-js/pull/6. O merge na `develop` é decisão exclusiva do autor.
- **Validação no fim da sessão:**
  - `npx tsc --noEmit` limpo;
  - Vitest com 25 arquivos e 115 testes passando;
  - `npm run build:lin` OK.
- **Renderização:**
  - Backends implementados: `webgl2` (`src/rendering/WebGL2Backend.ts`) e `canvas2d`.
  - A cascata do ADR-0001 só escolhe backends suportados **e** implementados. Por isso, mesmo com WebGPU disponível no navegador, roda em `webgl2`.
  - Medido no GLB de 105k triângulos: WebGL2 a ~0.3 ms de CPU por frame (60 fps); Canvas2D a ~230 ms (só fallback).
- **Assets:**
  - Loaders GLB/GLTF/OBJ+MTL com texturas sRGB, `doubleSided`, `alphaMode` e nós com transformação aplicada.
  - Ainda faltam skinning, animações e PBR.
- **Documentação nova:**
  - `docs/architecture/RENDERING_STUDY_THREEJS.md`: técnicas estudadas no three.js e plano do WebGPU;
  - `docs/architecture/MCP_GAME_AUTHORING.md` e `docs/adr/0006-mcp-agentic-game-authoring.md` (Proposed);
  - `TODO.md` §8 (melhorias), §9 (novas funcionalidades) e §10 (MCP).
- **Estudo:** `study/three.js` tem um clone raso do three.js (gitignored, MIT). Serve para consultar técnicas, não para copiar código.

## 2. Mudanças de repositório que afetam a próxima sessão

- **Histórico reescrito em 2026-10-27** com force-push de `main`, `develop`, `refactor` e `tcc`. Foram removidos:
  - `demo/**/assets/`;
  - `showcase/public/assets/audios/` (branch `tcc`);
  - `temp/`;
  - os trailers `Co-Authored-By: Claude` das mensagens de commit.
  - Resultado: clone novo de ~131 MB para ~19 MB. Todos os hashes desde 2026-01 mudaram.
  - **Outros clones** (inclusive de colaboradores do TCC) precisam ser refeitos ou receber `git fetch && git reset --hard origin/<branch>`.
  - **Stashes antigos** do GitHub Desktop (`stash@{0}`, `stash@{1}`) apontam para commits antigos.
- **Backup anterior à reescrita:** `git bundle` com todos os refs em `/tmp/claude-1000/-home-gustavo-Dev-brio-js/431d6cbb-084c-44e7-8b62-2def18d03066/scratchpad/brio-js-backup-pre-rewrite.bundle` (133 MB). Fica em `/tmp`, então **mover para um local permanente** se quiser guardar.
- **Branch `tcc`:** o showcase não tem mais os áudios no remoto. Se forem necessários, restaurar do bundle e adicionar `showcase/public/assets/audios/` ao `.gitignore` da `tcc`, para não voltarem a ser versionados.
- **GitHub:** os refs `refs/pull/1..5` (somente leitura) ainda seguram os objetos antigos no servidor. O tamanho exibido pelo GitHub só cai após o GC deles ou um pedido ao suporte. Clones normais já vêm leves.
- **Repositório renomeado** para `glgreg/brio-js`. O GitHub redireciona, mas o `origin` local e as URLs do `package.json` (`repository`, `bugs`, `homepage`) ainda apontam para `GustavoLGregorio/brio-js`.
- **`demo/` e `assets/` só locais** (gitignored). O repositório público **não tem nenhum exemplo executável** hoje.

## 3. Pendências para a primeira versão funcional (v0.1.0)

Definição proposta de v0.1.0 (o autor deve confirmar): um desenvolvedor instala o pacote e cria um jogo 2D completo e uma cena 3D simples, usando apenas a documentação e um exemplo público. Precisa ter renderização na GPU com fallback, input, áudio, cenas e salvamento.

### P0: bloqueiam a v0.1.0

1. **Fallback real da cascata.** Se `init()` do backend falhar, tentar o próximo (`webgpu -> webgl2 -> webgl1 -> canvas2d`), não pular direto para `canvas2d` (TODO 8.1).
2. **Ciclo de vida de cena unificado.** `BrioScene.preload/load/restart` precisa participar do `BrioGame`. Hoje a cena tem `ECSWorld` próprio e fica fora de `game.createCheckPoint()` (TODO 5.1).
3. **Áudio sobre Web Audio API.** `AudioContext`, barramentos Master/BGM/SFX e desbloqueio de autoplay. O áudio 3D com `PannerNode` pode ficar para a v0.2 (TODO 5.5 / 9.2).
4. **Iluminação mínima configurável.** `BrioLight` (directional, ambient, hemisphere) enviado por UBO no WebGL2 e respeitado no Canvas2D. Hoje as luzes são constantes no shader (TODO 9.1).
5. **Passo fixo de simulação** (`fixedTimestep` com interpolação) e **`BrioRandom` com semente** (TODO 8.3). Também são pré-requisitos do MCP.
6. **Bugs de correção conhecidos:**
   - Canvas2D sem clipping no near plane;
   - `BrioCamera2D.follow` dependente do framerate;
   - colisão de nomes de malha/material entre modelos (`"Face"`, `"Hair"`);
   - partes filhas de `BrioModel.instantiate` fora do ECS (TODO 7.2).
7. **APIs marcadas como feitas mas inexistentes:** `BrioCamera3D.screenToRay`, `BrioMesh.createCylinder` (TODO 9.5 / 9.6).
8. **Segurança de loaders.** Limites de tamanho de buffer e de dimensão de imagem ao fazer parse de glTF/GLB hostil (TODO 8.2).
9. **Exemplo público e distribuição:**
   - um exemplo 2D e um 3D versionados, com assets leves e CC0 (ou baixados por script), no lugar das demos locais (TODO 8.4);
   - campo `files` no `package.json` e URLs atualizadas para `glgreg/brio-js`;
   - guia "Getting Started" no README;
   - `npm pack` validado.
10. **CI no GitHub Actions** com `tsc`, Vitest e build (TODO 8.4).

### P1: desejáveis na v0.1.0, aceitáveis na v0.2

- **Desempenho e robustez do 3D:**
  - frustum culling por objeto nos passes 3D;
  - recuperação de perda de contexto WebGL testada no navegador;
  - `game.renderStats` unificado.
- **Testes:** testes visuais automatizados (imagem dourada por exemplo) em navegador headless.
- **Input:** mapeamento de ações (`BrioInputMap`) e controles de câmera prontos (orbit e first-person).
- **UI:** UI básica em tela (texto, botões, barras) na camada `"ui"`.
- **2D:** renderização de `BrioTileMap` em chunks.

### Decisão em aberto do autor

- **WebGPU na v0.1.0 ou na v0.2?** O plano técnico está em `RENDERING_STUDY_THREEJS.md` §3:
  - WGSL escrito à mão com variantes;
  - cache de pipelines com `createRenderPipelineAsync`;
  - bind groups por frequência de atualização;
  - camada comum `GpuResourceCache` compartilhada com o WebGL2.
- **Recomendação:** v0.2, depois de P0 itens 1 e 4. A máquina de desenvolvimento é Linux, onde o suporte a WebGPU ainda é parcial, e o WebGL2 já cumpre a meta de desempenho.

### Fora da v0.1.0 (roadmap já documentado)

- **Backends:** WebGPU (se ficar para a v0.2) e WebGL1.
- **Visual:** PBR, IBL, sombras, tone mapping e sprite batching 2D na GPU.
- **Animação:** skinning e animação glTF (`BrioAnimator3D`).
- **Física 3D:** resolução de colisão, rigid bodies e raycast.
- **Conteúdo:** partículas e diálogos.
- **Plataforma:** rede, PWA e WebXR.
- **MCP (§10):** começa pela Fase 0 (`BrioSceneDocument`, `step` determinístico, introspecção, input sintético, `captureFrame`). Os itens P0.5 e P1 já adiantam parte dela.

## 4. Como retomar

1. Executar o boot do `SOUL.md`, ler este arquivo e checar o estado do PR #6 (`gh pr view 6 --repo glgreg/brio-js`).
2. Confirmar com o autor a definição de v0.1.0 e a decisão sobre o WebGPU.
3. Antes de qualquer push, rodar `npx tsc --noEmit && npx vitest run && npm run build:lin`.
4. Validar no navegador pelo MCP do Chrome (console e screenshot), servindo a raiz do repositório com um servidor estático. As demos locais ficam em `demo/` e usam `/assets/`. Faltam localmente `gwen_tennyson.glb` e `spider_gwen.glb`, que a demo `test-3d-glb-scene--18-10-26` usa.
5. Commits no padrão `<tipo>(<escopo>): resumo` em português, sem emojis e **sem trailer de coautoria de IA**.

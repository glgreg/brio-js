# Identidade do Projeto - BrioJS

## 1. Proposito e Visao

A BrioJS e uma Web Game Engine 2D e 3D modular, *zero-dependency* e de alto desempenho escrita em TypeScript. Seu proposito central (fundamentado no TCC do IFPR) e ocupar o vacuo educacional e produtivo existente entre ferramentas visuais *no-code/low-code* (como Scratch, GDevelop e Construct) e motores comerciais de alta complexidade (como Unity e Unreal Engine).

Para cumprir essa missao, a BrioJS combina:
1. **API Publica Simples e Didatica (OOP + Tooling Functions)**: Classes concretas e intuitivas (`BrioGame`, `BrioScene`, `BrioObject2D`, `BrioObject3D`) somadas a funcoes utilitarias modulares (*tree-shakeable*), 100% documentadas via JSDoc/TSDoc com foco em *Agent Context Optimization (ACO)*.
2. **Backend Orientado a Desempenho**: Nucleo interno baseado em **ECS (Structure of Arrays em `TypedArrays`)**, **Object Pooling O(1)**, **Serializacao Binaria Pura**, **Multi-Canvas / `OffscreenCanvas` em Web Workers** e pipeline grafico multi-backend com fallback automatico (`WebGPU -> WebGL2 -> WebGL1 -> Canvas2D`).
3. **Portabilidade Multiplataforma**: Execucao nativa em Navegadores Web, Desktop (Electron) e Mobile (Capacitor) com tratativas automaticas de plataforma e fallbacks progressivos.

## 2. Tipo de Projeto

- [x] Frontend / Runtime Multiplataforma (Web, Electron, Capacitor)
- [ ] Backend (API/Worker de Servidor)
- [ ] Monorepo
- [x] Biblioteca/Pacote (2D & 3D Game Engine Framework)
- [ ] Ferramenta CLI

## 3. Stakeholders e Publico-Alvo

- **Usuarios Iniciantes e Estudantes**: Alunos do ensino medio tecnico e graduacao em transicao da programacao em blocos para codigo textual real (JavaScript/TypeScript).
- **Desenvolvedores Intermediarios/Avancados e Agentes de IA**: Desenvolvedores indie e fluxos assistidos por LLMs que buscam prototipacao rapida com controle sobre camadas, multi-viewport (split-screen), shaders/GPU e memoria.
- **Mantenedores**: Gustavo Luiz Gregorio e Lucas Bigliardi Vicente.

## 4. Status Atual

Em refatoracao arquitetural ativa na branch `refactor` (rumo a v1.0). O diagnostico completo do codigo inicial encontra-se em `./docs/architecture/CODEBASE_AUDIT.md`, a especificacao da nova arquitetura em `./docs/architecture/TARGET_ARCHITECTURE.md`, o vocabulario oficial em `./GLOSSARY.md`, as decisoes arquiteturais em `./docs/adr/` e a lista de pendencias em `./TODO.md`.

# Identidade do Projeto - BrioJS

## 1. Propósito e Visão

A BrioJS é uma engine de jogos 2D leve, voltada para web e renderizada via HTML5 Canvas. A sua proposta de valor principal é fornecer uma fundação rápida, baseada em TypeScript sem dependências pesadas (vanilla), encapsulando o `CanvasRenderingContext2D` e automatizando o game loop (`preload` -> `load` -> `update`), renderização de sprites, controle de entrada (Keyboard), colisão (AABB), reprodução de áudio e debugging integrado.

## 2. Tipo de Projeto

- [x] Frontend (Canvas HTML5 / Web)
- [ ] Backend (API/Worker)
- [ ] Monorepo
- [x] Biblioteca/Pacote (Game Engine Framework)
- [ ] Ferramenta CLI

## 3. Stakeholders e Público-Alvo

- **Usuários**: Desenvolvedores de jogos independentes que desejam criar jogos rápidos para a web com TypeScript/JavaScript de forma acessível e transparente.
- **Mantenedores**: Gustavo e outros eventuais contribuidores focados na expansão das capacidades da engine.

## 4. Status Atual

Em desenvolvimento avançado (Alpha/Beta). Diversos módulos core (Game Loop, Sprites, Keyboard, Collisions, Assets) estão implementados e funcionais (evidenciado pelo projeto `demo`), contudo ainda existem features mapeadas em `not-implemented` (Câmera, Gamepad, Mapas, Cenas, Mouse, Storage).

## 5. Metadados Específicos do Projeto

- **Versionamento de Repositório**: Baseado no ecossistema npm (`package.json`).
- **Requisitos de Documentação**: JSDoc/TSDoc fortemente presente nas funções e propriedades para gerar tipos robustos na pasta `dist/` e facilitar o IntelliSense.

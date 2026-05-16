# Arquitetura do Projeto - Brio Engine

## 1. Visão Geral do Sistema
O sistema é um motor de jogos 2D construído inteiramente sobre as APIs nativas do navegador (Canvas API, DOM, Web Audio). Segue uma arquitetura orientada a componentes gerenciados por uma classe central (`BrioGame`) que atua como orquestradora do ciclo de vida completo da aplicação (game loop, rendering, atualizações de lógica).

## 2. Stack Tecnológica
- **Linguagem/Runtime**: TypeScript (compilado via `tsc` para arquivos JS/d.ts na pasta `dist`). Roda nativamente no Navegador.
- **Frameworks**: Nenhum (Vanilla TS/JS).
- **Bancos de Dados**: N/A (possível integração local no futuro via localStorage/IndexedDB conforme módulo `BrioStorage` pendente).
- **Infraestrutura**: Empacotamento npm, execução estática client-side (HTML/JS).

## 3. Padrões Arquiteturais
- **Estrutura de Diretórios**:
  - `src/`: Código-fonte TypeScript categorizado por responsabilidade (`assets`, `base`, `debugging`, `game`, `input`, `math`, `objects`).
  - `dist/`: Build JavaScript e Tipagens (`.d.ts`).
  - `demo/`: Implementação de exemplo em JavaScript (espaçonaves/shooter) para validar o funcionamento da engine.
  - `docs/`: Documentação gerada do código.
  - `tcc/`: **(Playground Acadêmico)** Diretório dedicado ao Trabalho de Conclusão de Curso (TADS/IFRP). Contém a fundamentação teórica, planos de negócios e documentação acadêmica do BrioJS. Agentes futuros devem focar nesta pasta quando o contexto envolver o escopo acadêmico/TCC.
- **Design Patterns**:
  - **Game Loop**: Laço controlado por `requestAnimationFrame` gerenciando delta time e FPS limiters.
  - **Facade/God Object**: `BrioGame` encapsula a complexidade e coordena módulos subjacentes (`BrioSpriteRenderer`, `BrioUpdater`, `BrioAssetManager`, `BrioKeyboard`).
  - **Object Pooling**: Suportado externamente (conforme visto em `demo/game.js`) para otimização de garbage collection.
- **Fluxo de Dados**: Execução sequencial estrita baseada em promises: `preload` (instancia elementos de mídia via rede) -> `load` (registra entidades `BrioObject` na memória) -> `update` (executa a cada frame a limpeza de tela, update da lógica local, cálculos de colisão, e renderização `BrioSpriteRenderer`).

## 4. Pontos de Integração
- **APIs Externas**: Nenhuma restrição; o jogo gerado consome imagens e sons de URLs diversas.
- **Serviços Internos**: Fortemente acoplado aos eventos do DOM (EventListeners de `keydown`/`keyup` ou callbacks de carregamento de `<image>`/`<audio>`).

## 5. Restrições e Contexto
- **Desempenho**: Alta sensibilidade no escopo de `update`. Operações custosas ou forte alocação/desalocação de memória (garbage collection) devem ser evitadas para garantir 60FPS constantes.
- **Encapsulamento**: Uso das flags `#` no TypeScript para variáveis genuinamente privadas de classes, blindando o core interno da engine de manipulações acidentais na execução pelo desenvolvedor do jogo.

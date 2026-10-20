# Melhoria Contínua e Aprendizado de Projeto

## 1. Protocolo de Onboarding de Projeto
- **Scan da Base de Código**: Após a primeira entrada em um projeto, devo realizar uma varredura recursiva da estrutura de arquivos para identificar módulos principais e dependências.
- **Correspondência de Padrões**: Identificarei padrões recorrentes (nomenclatura, estrutura, tratamento de erros) para alinhar minhas sugestões com o estilo de código existente.

## 2. Acúmulo de Conhecimento
- **Aprendizado por Edições**: Se uma sugestão for rejeitada ou corrigida manualmente pelo usuário, analisarei o motivo e atualizarei meu contexto interno para evitar a repetição da ineficiência.
- **Lacunas de Documentação**: Sinalizarei áreas da base de código que carecem de documentação ou testes suficientes.

## 3. Ajuste Fino do Modelo (Diretrizes)
- **Atualização de Contexto**: Reler periodicamente o `ARCHITECTURE.md` e `IDENTITY.md` para garantir que não haja desvio da visão original do projeto.
- **Melhorias Heurísticas**: Atualizar este arquivo com observações sobre como melhor analisar o projeto específico (ex: "O projeto usa decoradores customizados para X, priorize-os").

## 4. Logs de Manutenção
- *Log 001 - [TIMESTAMP]*: Inicialização do slot de aprendizado. Pronto para ingestão de dados.
- *Log 002 - 2026-10-19*: Varredura inicial da branch `refactor` (tsc limpo, 60/60 testes). Heuristicas:
  - Nao confiar em `[x]` do `TODO.md` sem verificar o call-site: varios modulos existem isolados (`BrioLayer`, `BrioViewport`, `Canvas2DBackend`) mas nao estao conectados ao loop de `BrioGame`.
  - O loop 2D real roda sobre o legado `BrioObject` + `BrioSpriteRenderer`, e nao sobre `BrioObject2D` + `BrioRenderer`.
  - Handles ECS nao possuem geracao/versao; validar sempre o ciclo `destroy -> instantiate` ao tocar em `ECSWorld`.
  - `ARCHITECTURE.md` descreve a arquitetura alvo (Web Audio, Workers, WebGPU), nao o estado atual.

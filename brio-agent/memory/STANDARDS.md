# Padroes de Engenharia - BrioJS Engine

## 1. Controle de Versao e Fluxo de Branches (Git)

- **Branch de Trabalho Atual**: Todo o trabalho de refatoracao, documentacao arquitetural e implementacao ocorre na branch `refactor` com commits e pushes diretos para `origin/refactor`. O merge para `develop` e realizado apenas mediante decisao explicita do autor.
- **Branch `tcc`**: Isolada exclusivamente para os artefatos academicos, apresentacoes e prototipos da banca (MEPI/TCC).
- **Mensagens de Commit**:
  - **Formato**: `<tipo>(<escopo>): <resumo curto>`
  - **Tipos**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.
- **Regra de Push**: Sempre testar e validar a compilacao do projeto (`npx tsc --noEmit` / `npm run build:lin`) antes de realizar `git push`.

## 2. Linguagem Ubiqua Estrita (Domain Modeling)

- **Proibicao de Aliases Semanticos**: Aliases no codigo ou nos exports so podem existir quando abstraem complexidade de configuracao (ex.: presets `"2d"` e `"3d"`). Nunca crie dois nomes para o mesmo conceito semantico.
- **Vocabulario Canonico**: Consulte e mantenha `./GLOSSARY.md` atualizado. Por exemplo:
  - Use `trigger` (nunca `intangible` ou `sensor`);
  - Use `BrioAtlas` (nunca `BrioSpriteAtlas`);
  - Use `BrioConsole` (nunca `BrioLogger`);
  - Use as classes concretas `BrioObject2D` e `BrioObject3D`.

## 3. Convencoes de Codigo e Desempenho

- **Proibicao de Emojis**: Nunca adicione emojis em nenhum arquivo de codigo ou documentacao do repositorio.
- **Referencias de Caminho**: Prefira sempre referencias relativas (`./` ou `../`) em vez de referencias locais absolutas.
- **Principios**: Aplique rigorosamente DRY, KISS, Clean Code e SOLID na organizacao dos modulos, priorizando **desempenho e zero alocacao no Game Loop** (evitar `Array.from`, `.sort()` por frame, `JSON.stringify` ou criacao de closures em getters).
- **Tipagem TypeScript**: Explore *Template Literal Types*, *Const Generics* e tipos utilitarios para oferecer autocompletar maximo na IDE do usuario.
- **Tree-Shaking**: Exporte funcoes utilitarias e classes de forma modular e independente, evitando side-effects na importacao.

## 4. Documentacao Obrigatoria (JSDoc / TSDoc / ACO)

- Toda classe, metodo, funcao, interface, tipo e propriedade publica DEVE conter anotacoes completas de JSDoc/TSDoc (`/** ... */`), detalhando o comportamento do dominio, parametros (`@param`), retorno (`@returns`), valores padrao (`@default`) e exemplos praticos (`@example`).
- A documentacao autogerada pelo TypeDoc (`npm run doc`) e emitida em `./docs/api/` (ignorada pelo Git), enquanto `./docs/adr/` e `./docs/architecture/` permanecem versionadas.

# Padrões de Engenharia - Brio Engine

## 1. Controle de Versão (Git)
### Mensagens de Commit
- **Formato**: `<tipo>(<escopo>): <resumo curto>`
- **Tipos**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.
- **Escopo**: Módulo da engine afetado (ex: `game`, `math`, `assets`, `demo`).

### Pull Requests
- Deve incluir um resumo conciso das alterações, especialmente se impactar o ciclo de vida do game loop ou consumo de memória.
- Deve garantir o pleno funcionamento da pasta `demo` com a alteração proposta.

## 2. Convenções de Código
- **Nomenclatura**:
  - `PascalCase` para Classes. Padrão de prefixo `Brio` nas classes core (ex: `BrioGame`, `BrioSprite`, `BrioObject`).
  - `camelCase` para métodos, variáveis e propriedades exportadas.
  - Tipos base e interfaces em `PascalCase` ou nomenclatura de suporte auxiliar (ex: em `math/vec2.ts` temos funções lowercase genéricas exportadas e `Vector2` namespacing).
- **Encapsulamento Rígido**: Uso extensivo de _private fields_ do ES (`#`) para ocultar implementação interna da API exposta (`#canvas`, `#width`, `#currentState`).
- **Clean Code**: Funções atreladas diretamente ao Game Loop de `BrioGame` e `BrioSpriteRenderer` devem minimizar aninhamentos para máxima velocidade de processamento do Call Stack JavaScript.

## 3. Requisitos de Teste
- **Testes Práticos**: Alterações devem ser homologadas e compiladas (`npm run build` ou `tsc`), seguidas da validação visual e interativa na página `demo/index.html`.
- **Validação de Performance**: O `fpsOverlay` deve ser inspecionado durante as validações locais no browser para checar memory leaks ou framedrops de possíveis gargalos inseridos no método `update`.

## 4. Documentação
- Obrigatório o uso do formato `JSDoc` / `TSDoc` (anotações de `/** */`) em todos os métodos públicos, getters e propriedades expostas. Isso não apenas serve de auto-documentação para leitura de código, mas alimenta o linter do IDE do desenvolvedor final que consome a biblioteca pelo diretório `dist/` e auxilia a geração estática da pasta `docs/`.

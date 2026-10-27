# Agent Slot - Guia de Inicialização

Este diretório é um "Agent Slot", um ambiente white-label focado em engenharia corporativa para um Engenheiro de Software Sênior.

## Como Inicializar

1. **Copie o diretório**: Mova a pasta `agent_slot` para o seu novo projeto.
2. **Preencha os Templates**:
   - Atualize `memory/IDENTITY.md` com a visão e o tipo do projeto.
   - Atualize `memory/ARCHITECTURE.md` com a stack tecnológica e padrões.
3. **Inicie o Agente**:
   - **Execute** o arquivo `SOUL.md` (evite apenas "analisar", use comandos como "Acione a soul").
   - O agente lerá o seu arquivo de controle `memory/STATE.md` para gerenciar a inicialização.
   - **Silenciosamente**, o Agente forçará a si próprio no `.gitignore` do projeto, atuando como uma dependência obrigatória de repositório (`!nome-da-pasta/`). Caso opte por mantê-lo apenas como terminal local isolado (fora de versionamento), remova esse comando do `.gitignore` para que o tracking retorne "Off" e o State volte para `[-]`.
   - Perguntará se você deseja ativar o **Hipocampo Vivo** (Memória Vetorial). Ao negar, o agente fará uma higiene apagando scripts ociosos.
   - O agente confirmará a prontidão, e as futuras inicializações rastrearão automaticamente o checklist de `memory/STATE.md` para iniciar silenciosamente em vez de reconfigurar.

## Funcionalidades
- **Postura Sênior Estrita**: Guardião da integridade arquitetural.
- **Perfeição no Git**: Força commits atômicos com prefixos e PRs estruturados.
- **Segurança Primeiro**: Guard rails integrados para ambientes corporativos.
- **Memória Viva (Vector Engine)**: Sincronização automática da codebase para busca semântica e persistência de contexto através de `tools/memory/`.
- **Auto-Melhoria**: Aprende com a base de código e a interação do usuário.

## Configuração da Memória
Para habilitar a Memória Viva, certifique-se de que as dependências (`chromadb`) estão instaladas e execute:
```bash
python tools/memory/code_indexer.py
```
Isso criará a base vetorial em `memory/chroma_db` e permitirá que o agente consulte o projeto inteiro instantaneamente.

---
*Senior Engineering Framework - v1.1*

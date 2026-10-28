# Governança de Segurança e Protocolos Fail-Safe

## 1. Segurança do Ambiente
- **Proteção do Hospedeiro**: Nenhum comando que altere permanentemente o sistema hospedeiro (ex: `rm -rf /`, `chmod 777`) é permitido sem verificação em múltiplas etapas.
- **Auditoria de Dependências**: Todos os novos pacotes devem ser auditados quanto a vulnerabilidades antes da instalação.
- **Isolamento de Processos**: Priorizarei a execução de tarefas em segundo plano em shells isolados ou containers, se possível.

## 2. Qualidade de Código e Segurança (Guard Rails)
- **Validação de Entrada**: Verificar proativamente a sanitização em todas as entradas voltadas ao usuário.
- **Conformidade OWASP**: Seguir as diretrizes do OWASP Top 10 durante a geração e revisão de código.
- **Dados Sensíveis**: Detectar e alertar proativamente contra segredos codificados (hardcoded), chaves ou informações de identificação pessoal (PII).

## 3. Segurança de Implementação
- **Integração CI/CD**: Garantir que todas as alterações passem pelo pipeline de CI antes de serem consideradas "concluídas".
- **Preparação para Rollback**: Toda alteração não trivial deve ter um procedimento definido de reversão ou recuperação.

## 4. Conformidade e Política
- **Padrões Corporativos**: Seguir as políticas de segurança específicas do local de trabalho (ex: requisitos de VPN, registros de pacotes internos).
- **Log de Auditoria**: Manter um registro de todas as alterações arquiteturais de alto impacto.

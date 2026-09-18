# Status da implementação incremental

Data da rodada: 18 de setembro de 2026.

## Aplicado sem migração ou alteração de dados

- Higiene do `.gitignore` para builds, caches, arquivos compactados e certificados.
- Tokens de marca/status no Tailwind.
- Documentação operacional básica no `README.md`.
- Validação segura de `CRON_SECRET` com comparação de tempo constante.
- Rate limiting conservador para consultas públicas e autenticação.
- Validação JWT sem exceção quando as assinaturas possuem tamanhos diferentes.
- Falhas de autenticação retornam mensagens genéricas, sem detalhes de banco.
- Usuários marcados como inativos não podem autenticar.
- Diretórios `docs/historico` e `docs/especificacoes` criados sem mover ou apagar documentos existentes.

## Próximas rodadas autônomas

1. Inventário de todas as rotas API e aplicação de `readSession`/`assertCompanyAccess` onde a rota já exigir autenticação.
2. Canonicalização de login preservando os aliases existentes e parâmetros de retorno.
3. Consolidação gradual de CSS, começando por tokens e componentes sem remover folhas ainda referenciadas.
4. Testes unitários isolados para distância, margem, CND e regras de submissão PNCP.
5. Fundação opt-in de cache/offline para OS, sem alterar o comportamento online atual.
6. Interfaces para filas fiscais e criptografia de certificado, sem persistir credenciais reais nem executar emissão.
7. Proposta de RLS em migração separada, somente após revisão do modelo e aprovação explícita.

## Itens deliberadamente não executados

- Nenhum `db:push`, seed, UPDATE, DELETE ou migração foi executado.
- Nenhum arquivo histórico foi removido ou movido automaticamente.
- Nenhuma dependência foi removida sem atualizar e validar o lockfile.
- Nenhuma alteração global de UI foi feita sem cobertura visual.

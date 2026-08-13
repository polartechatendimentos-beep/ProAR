# Correções da auditoria externa — 12/08/2026

Implementação incremental e não destrutiva sobre a versão consolidada do ProAR.

## Corrigido
- Porta de entrada pública por tenant: `/`, `/login`, `/auth` e `/signin` funcionam sem cookie prévio.
- Aliases de autenticação são reescritos para a mesma tela real de login do tenant.
- Tela pública do tenant recebe `Cache-Control: no-store`, `Pragma: no-cache`, `Expires: 0` e `X-Robots-Tag: noindex` para impedir 404/login antigo persistido na borda.
- Removido `<meta name="codex-preview" content="development">` da build de produção.
- Catálogo padrão de serviços permanece servido apenas por `/api/catalog/default-services` após validação de sessão e com `private, no-store`.
- CSP, anti-clickjacking, nosniff, Referrer-Policy, Permissions-Policy e HSTS reforçado permanecem ativos no `next.config.ts`.
- `robots.txt` explícito para bloquear indexação do ERP.
- `sitemap.xml` explícito apenas para páginas institucionais do domínio principal.
- `/.well-known/security.txt` adicionado.
- `/api/health/tenant` adicionado para healthcheck sem cookie, informando tenant e existência/estado cadastral sem revelar dados comerciais.

## Preservação
Nenhuma tabela, cliente, OS, produto, serviço, fornecedor, compra, obra ou registro financeiro foi removido. Não há migração destrutiva nesta atualização.

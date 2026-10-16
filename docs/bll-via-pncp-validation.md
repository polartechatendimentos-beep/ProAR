# BLL via PNCP — validation checklist

This feature **does not access BLL directly**. It marks records fetched from the official PNCP API only when PNCP metadata explicitly identifies the BLL platform.

## API scenarios (authenticated POST /api/licitacoes/search)

1. `{"source":"bll","uf":"SP","days":7,"maxPages":2}` — only records with `sourcePlatform=bll` and `integrationMode=bll_via_pncp` should be returned.
2. `{"source":"all","uf":"SP","days":7,"maxPages":2}` — preserve all PNCP results, with optional BLL annotations.
3. `{"source":"invalid"}` — HTTP 400.
4. Unavailable PNCP — preserve partial results and source health; do not fabricate opportunities.
5. Empty BLL results — message must distinguish no confirmed BLL metadata from no actual BLL notices.

## Unit test matrix for classifyBllFromPncp

| PNCP raw metadata | Expected |
|---|---|
| linkSistemaOrigem=https://bll.org.br/editais/ | matched, url evidence |
| linkSistemaOrigem=https://bllcompras.com/ | matched, url evidence |
| nomePlataforma=BLL Compras | matched, platform evidence |
| objetoContratacao='Manutenção BLL Compras' only | not matched |
| linkSistemaOrigem=https://bll.org.br.evil.example/ | not matched |
| linkSistemaOrigem=http://bll.org.br/ | not matched |
| empty metadata | not matched |

## Release gate

Run `npm ci && npm run typecheck && npm run build` in an isolated preview environment. Then run the API scenarios against an authenticated test tenant and inspect sample PNCP metadata. Do not merge or promote to production before verification. No database migration is required.

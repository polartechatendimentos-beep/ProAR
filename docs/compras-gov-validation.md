# Compras.gov.br via PNCP — validation

This connector classifies official PNCP records using explicit platform metadata; it **does not yet call the Compras.gov.br Dados Abertos API**.

## Cases to verify

- `linkSistemaOrigem=https://compras.gov.br/...` -> platform `compras-gov`
- `linkSistemaOrigem=https://comprasnet.gov.br/...` -> platform `compras-gov`
- `nomePlataforma=Compras.gov.br` -> platform `compras-gov`
- Procurement title alone mentions Compras.gov.br -> no classification
- Hostname `compras.gov.br.evil.example` -> no classification
- Other PNCP source -> unchanged
- Authenticated `POST /api/licitacoes/search` with `{"source":"compras-gov","uf":"SP","days":7,"maxPages":2}` -> only verified records
- `source=all` -> PNCP records retained, no duplication
- PNCP outage -> partial health is retained, no fabricated records

Before enabling a direct Dados Abertos connector, confirm endpoint paths, pagination, response contracts, rate limits and provenance against official Swagger documentation. Run typecheck, build and integration tests in preview before merging. Production must remain unchanged.

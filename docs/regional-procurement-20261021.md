# Cobertura regional de licitações — 21/10/2026

## Implementado

- Separação entre `publicationSystem` (Fiorilli, Betha, IPM, Equiplano, Aspec, SMARAPD, conforme publicador informado) e `disputePlatform` (domínio exato da BLL, Compras.gov, Licitações-e, BEC-SP). Campos preservados no contrato de busca e na união de evidências.
- Conector direto Fiorilli ativado para a Prefeitura de Ibirá (IBGE 3519402), usando a consulta pública documentada `VersaoJson/LicitacoesEContratos`, exercício solicitado e entidade 1. Endpoint respondeu HTTP 200 com array real na inspeção de leitura.
- Limites de 6,5s e 5 MB por resposta, redirects proibidos, até 5.000 registros com sinalização de rejeições/truncamento; fonte estática revisada, sem URL arbitrária fornecida pelo usuário.
- Campos de origem preservados, identificador externo estável por município/exercício; número de processo nunca convertido em sequência PNCP. Sem ID PNCP comprovado, registros de fontes distintas não são fundidos por semelhança textual.
- Valor sigiloso permanece ausente; data sem hora não vira prazo confirmado. Falhas isoladas não eliminam PNCP e outras fontes.
- Painel de cobertura distingue consulta direta, evidência via PNCP e fontes não consultadas. Prioridades PNCP → Fiorilli → BLL → Betha; nenhuma alegação de cobertura integral ou participação de mercado presumida.
- Diagnósticos por publicador e plataforma, incluindo falha/parcialidade da consulta PNCP subjacente. Prazo desconhecido não prova edital aberto.

## Limites explícitos

O conector Fiorilli direto está limitado a Ibirá. Não foi ativado genericamente em todos os municípios que usam a marca. Betha/IPM/legados entram por identificação do publicador no PNCP; seus conectores diretos aguardam endpoint por entidade validado. BLL direto mantém o feed autorizado já suportado, sem configurar credencial ou endpoint presumido. BEC-SP/Licitações-e são identificados pelos links oficiais no PNCP, sem simular consulta direta. Não há contorno de login, CAPTCHA ou bloqueios.

As coletas existentes de Mirassol/Catanduva e APIs PNCP/Compras.gov continuam disponíveis. Nenhuma migração, seed ou escrita em massa de registros reais.

## Fontes primárias revisadas

- https://transparencia.ibira.sp.gov.br/transparencia/versaoJson/DadosAbertos/ — contrato público Fiorilli, Licitações e Contratos.
- https://transparencia.ibira.sp.gov.br/transparencia/VersaoJson/LicitacoesEContratos/?ConectarExercicio=2026&Listagem=Licitacoes&Ano=2026&Empresa=1&MostraDadosConsolidado=False — consulta de leitura respondida.
- https://pncp.gov.br/manual/pt-br/latest/singlehtml/ — manual oficial PNCP.
- https://e-gov.betha.com.br/transparencia/01037-173/con_licitacoes.faces — interface pública Betha; não comprova API JSON universal.
- https://www.balsamo.sp.gov.br/paginas/portal/licitacoes/exercicios — portal municipal; acesso automatizado direto retornou 403 no teste, sem contornar bloqueio.
- https://geoftp.ibge.gov.br/organizacao_do_territorio/estrutura_territorial/areas_territoriais/2002/Resolucao_PR_Areas_Municipios_2001.pdf — código oficial de Ibirá.

## Validação

Testes incluem parsing de valores/datas, sigilo, entidade/exercício, identidade externa, falhas isoladas, conteúdo inválido, raio, preservação de publicador e domínio exato de disputa. Evidência em docs/validation/regional-procurement-20261021.log. Verificar CI completo e deploy antes de anunciar produção.

# Relatório técnico de validação — Licitações ProAR

Execução local registrada em 2026-10-15T21:01:35-03:00. Versão: pacote de funil multiportal de 15/10/2026.

**Status: sete testes automatizados deste pacote aprovados.** Isto não representa homologação integral dos conectores governamentais, da interface autenticada ou da elegibilidade de qualquer proposta.

## Evidências reproduzíveis

Comando: `node --experimental-strip-types --test tests/tender-pipeline.test.mjs`.
Log integral, sem edição dos tempos: `docs/validation/tender-pipeline-execution-20261015.log`.
Todos os dados dos testes são sintéticos e não foram gravados no banco de produção.

| Caso | Entrada / ação | Assertiva executada | Resultado |
|---|---|---|---|
| GEM-01 | Mesmo número PNCP na fonte e em acompanhamento salvo | Identidade estável; uma linha; snapshot atualizado preservando acompanhamento | Aprovado |
| GEM-02 | Estado ANÁLISE; serialização; ator sem permissão; tentativa de mudar identidade | Etapa preservada; acesso negado; identidade imutável; homologação exige referência oficial | Aprovado |
| GEM-03 | Seis certidões regulares + duas conferências técnicas | 80%; bloqueio da etapa pronta; liberação apenas com os dez itens | Aprovado |
| GEM-04 | Custo 12.150; AC 4%; lucro 12%; tributos 8,65% | Fórmula multiplicativa; diferença explícita para fórmula aditiva; global calculado pelo mensal arredondado | Aprovado |
| GEM-05 | Objeto menciona PMOC; exigência não conferida; depois confirmada | Palavra isolada não libera filtro; combinação de favorito, portal, prazo e município correta | Aprovado |
| GEM-06 | Proposta de 90 dias; rascunho incompleto | Validade parametrizada; ressalva normativa; rascunho pode ser salvo mas não gera proposta incompleta | Aprovado |
| GEM-07 | Texto com acento, aspas, quebra de linha e início de fórmula | CSV com BOM, escape de aspas, separador e neutralização de fórmula | Aprovado |

## Correções em relação ao relatório recebido

1. A RDC 886/2024 é um ato de revogação, incluindo a RE 09/2003. Não estabelece novos valores-limite de qualidade do ar. A minuta remete às normas sanitárias e técnicas vigentes e ao instrumento convocatório.
2. A fórmula `CD / (1 - AC - tributos - lucro)` não é a composição multiplicativa de BDI utilizada aqui. Com os dados do caso GEM-04 e demais parcelas zero: `12.150 × 1,04 × 1,12 / (1 - 0,0865)`. O preço mensal arredondado para cima é R$ 15.492,42 e o global de doze meses é R$ 185.909,04.
3. O cálculo mensal arredondado deve ser a base do global, evitando diferença de centavos entre a carta de proposta e a planilha.
4. Homologação e encerramento do prazo são situações distintas. A etapa Homologado exige referência de resultado oficial; um prazo vencido não marca vitória nem homologação.
5. O ensaio GEM-01 valida identidade e mesclagem de dados. Não realizou uma chamada ao PNCP, não comprova ingestão de três certames e não reproduz a latência de 85 ms informada no texto recebido.

## Funcionalidades entregues

Funil e favoritos persistidos na base compartilhada com RBAC e auditoria; checklist por processo combinado às certidões da empresa; filtros de portal, município, modalidade, prazo, favoritos, PMOC conferido e pesquisa; ordenação por data, valor, score e prontidão; cadastro manual; minuta de proposta em texto revisável com dados da empresa ativa e validade configurável; CSV da lista filtrada; matriz com diagnósticos reais da consulta. O leitor de edital e o cofre existentes continuam disponíveis nas ferramentas de apoio.

## Limites de homologação

Os diagnósticos dos portais indicam o resultado daquela consulta, sem garantia de disponibilidade contínua. A matriz não apresenta um teste como executado por abrir o modal. A proposta é minuta interna e não é enviada ao portal. O score do radar não é match automático com o acervo. PMOC confirmado é uma anotação de revisão humana do edital, não certificação sanitária. WhatsApp não foi ativado. Gravação e concorrência usam o fluxo transacional de estado existente; não foram criados registros de teste na produção. Validação visual autenticada e envio real de propostas não fazem parte destes sete testes.

## Referências verificadas

- Acórdão TCU 2622/2013, seção 2.6, fórmula do BDI de obras públicas: https://pesquisa.apps.tcu.gov.br/documento/acordao-completo/%2A/NUMACORDAO%3A2622%20ANOACORDAO%3A2013%20COLEGIADO%3A%22Plen%C3%A1rio%22/DTRELEVANCIA%20desc%2C%20NUMACORDAOINT%20desc/0
- RDC ANVISA 886/2024: https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&cod_menu=9432&cod_modulo=310&link=S&numeroAto=00000886&orgao=ANVISA%2FMS&seqAto=222&tipo=RDC&valorAno=2024

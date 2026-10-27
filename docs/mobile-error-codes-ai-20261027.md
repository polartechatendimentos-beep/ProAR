# Códigos de erro multimarcas e assistente — 2026.10.27.2

## Entrega

73 registros, incluindo falhas, proteções e estados normais, em oito marcas. Não é tabela universal: o filtro exige a linha/fonte e separa unidade evaporadora de condensadora. Código com espaços é normalizado nos dois lados, sem transformar O em zero ou colapsar C1 21 em C1. Os significados são paráfrases curtas da documentação identificada, não diagnóstico de causa.

| Marca | Cobertura adicionada | Registros |
|---|---|---:|
| Daikin | ABQ-A / controlador ARCWA, já existente | 10 |
| Elgin | Piso-Teto PV R-32, documento 0043 Rev.03, modelos PVFI/PVFE48/60 documentados | 8 |
| Gree | G-Prime Inverter Compact Rev.001, cinco modelos GULD identificados na capa | 13 |
| TCL | TAC28CHSDTPG11IT Austrália (7) e sinais luminosos CSA/CHSA Brasil (3), separados | 10 |
| Midea | Springer Midea Multi-Inverter D 03/18, códigos da condensadora | 10 |
| Carrier | Cassette Inverter 40KVQOD12/18/24, evaporadora, p.78 | 15 |
| Samsung | Artigo oficial de suporte BR: CF, dF/dL, AP, C1 e exemplo C422 | 6 |
| LG | Artigo oficial de suporte PT, CH05; não comprova modelo brasileiro específico | 1 |

As URLs e páginas estão em lib/mobile-error-catalog.ts e lib/mobile-technical-library.ts. Modelos de lista são comparados de forma normalizada e aceitam sufixos de variante da base cadastrada. Linha não correspondente bloqueia o assistente. Artigos gerais e referências por família exibem limitação explícita e exigem confirmação do técnico.

## Assistente

IA local opcional por WebGPU, utilizando o worker existente e o modelo Qwen3-0.6B-q4f16_1-MLC. Não usa OpenAI API, chave, credenciamento ou inferência remota. O carregamento inicial do runtime/modelo exige conexão e recursos do aparelho. Consulta guiada determinística é rotulada sem IA.

Modelo completo, sintomas, confirmação de aplicabilidade e correspondência exata do código são necessários. A IA retorna apenas IDs de perguntas da lista revisada; saída inválida, campos extras ou IDs desconhecidos são recusados. Não renderizamos texto livre do modelo como diagnóstico, procedimento ou fonte. O código e seu significado vêm da base e não da geração. Nenhuma alteração na OS ou envio automático. Cancelamento, timeout, falha e limpeza do worker ao trocar de contexto incluídos.

## Validação e limites

Testes cobrem oito marcas, IDs únicos, fontes HTTPS, separação por marca/linha, normalização de piscadas, rejeição de código desconhecido, bloqueio de modelo incompatível, distinção de referência geral, recusa de texto livre/seleção inválida e construção do contexto com relato tratado como dado. Não houve teste de inferência real WebGPU nem teste visual autenticado em aparelho nesta sessão.

Sem migrações ou alterações nos dados reais. Plano das 100 melhorias permanece incremental; esta entrega amplia o acervo, sem declarar o catálogo de 100 concluído.

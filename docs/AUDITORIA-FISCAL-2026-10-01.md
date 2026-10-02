# Auditoria Fiscal ProAR — NF-e, NFC-e e NFS-e
Data de referência: 01/10/2026

## Objetivo
Conferir a cobertura fiscal do ProAR para a operação da PolarTech em Mirassol/SP, separando:
1. campos cadastrais;
2. campos da operação;
3. tributação por item/serviço;
4. documentos referenciados;
5. pagamentos;
6. transporte/entrega;
7. autorização, eventos e documentos auxiliares;
8. Reforma Tributária (IBS/CBS);
9. NFS-e Prefeitura de Mirassol / GOVBR Cidade360;
10. NF-e e NFC-e SEFAZ-SP.

## Fontes técnicas usadas
- Portal Nacional NF-e/NFC-e — MOC e Notas Técnicas vigentes.
- NT 2025.002 / RTC e Informes Técnicos 2025.002 e 2026.002.
- NT 2026.004 — CNPJ alfanumérico.
- Portal da NFS-e Nacional — NT 008/2026 (DANFSe) e NT 009 v1.01 de 01/10/2026.
- Prefeitura de Mirassol / Cidade360 — ISS Digital, API NFS-e padrão nacional.
- SEFAZ-SP — serviços NF-e/NFC-e e obrigatoriedade NFC-e no varejo paulista.

---

# 1. Emitente / empresa

| Item | Status | Observação |
|---|---|---|
| CNPJ | Implementado | Compatível com modelo alfanumérico de 14 posições |
| Razão social | Implementado | Validado no preflight |
| UF / Município | Implementado | Validado |
| Inscrição Estadual | Implementado | Aviso quando ausente em NF-e/NFC-e |
| Inscrição Municipal | Implementado | Obrigatória em NFS-e |
| CRT / regime tributário | Implementado | Simples, Presumido e Real |
| Certificado A1 | Implementado | Cofre criptografado, validade e metadados |
| Ambiente homologação/produção | Implementado | Separado por configuração |
| Série NF-e | Implementado | Configurável |
| Série NFC-e | Implementado | Configurável |
| Série RPS/DPS | Implementado | Configurável |
| CSC / ID CSC NFC-e | Implementado | Segredo protegido |
| CNAE do estabelecimento | Pendente | Recomendado para consistência fiscal/NFS-e |
| Código município fato gerador ICMS | Parcial | Derivado de cidade/UF, precisa campo explícito para casos especiais |
| Código município consumo IBS/CBS | Pendente | Necessário em cenários condicionais, ex. indPres=5 |

# 2. Destinatário / tomador

| Item | Status | Observação |
|---|---|---|
| CPF/CNPJ | Implementado | Validação atual |
| Nome / razão social | Implementado | Obrigatório na NF-e |
| Endereço completo | Implementado | CEP, logradouro, número, bairro, cidade e UF |
| IE | Implementado | Com indicador de contribuinte |
| IM | Implementado | Disponível |
| Indicador IE: contribuinte/isento/não contribuinte | Parcial | Hoje é inferido; deve virar seleção explícita |
| Consumidor final | Implementado na operação | Não fica preso ao cadastro do cliente |
| Identificação estrangeiro | Pendente | Para operações com exterior/turista |
| País / código país | Pendente | Para exterior |
| SUFRAMA | Pendente | Quando aplicável |
| e-mail fiscal | Pendente | Útil para distribuição automática de XML/PDF |
| telefone fiscal | Parcial | Pode existir no cliente, sem regra fiscal específica |

# 3. Identificação da NF-e/NFC-e

| Item | Status | Observação |
|---|---|---|
| Modelo 55/65 | Implementado pelo tipo | NF-e/NFC-e |
| Natureza da operação | Implementado | Obrigatória |
| Entrada/Saída | Implementado | NF-e; NFC-e fixada como saída |
| Destino operação interna/interestadual/exterior | Implementado | NFC-e fixada como interna |
| Consumidor final (indFinal) | Implementado | NFC-e obrigatório = sim |
| Indicador de presença | Implementado | Presencial, internet, teleatendimento etc. |
| Finalidade NF-e | Implementado | 1 Normal, 2 Complementar, 3 Ajuste, 4 Devolução/Retorno, 5 Crédito, 6 Débito |
| Tipo Nota Débito | Implementado | Códigos 01–07 validados |
| Tipo Nota Crédito | Implementado | Códigos 01–03 validados |
| Município fato gerador | Parcial | Falta tratamento avançado |
| Processo de emissão | Pendente | Normal/contingência e processo emissor |
| Versão aplicativo emissor | Pendente | Recomendado guardar |
| Data/hora saída/entrada | Pendente | Campo condicional relevante |
| Intermediador/marketplace | Pendente | Quando operação não presencial exigir |

# 4. Produtos e tributação

| Item | Status | Observação |
|---|---|---|
| Descrição | Implementado | Validada |
| Quantidade | Implementado | Validada |
| Valor unitário | Implementado | Validado |
| Unidade comercial/tributável | Implementado | Validada |
| NCM | Implementado | 8 dígitos |
| CFOP | Implementado | 4 dígitos |
| Origem mercadoria | Implementado | 0–8 |
| CEST | Implementado | Aviso em cenários de ST |
| GTIN | Implementado | 8–14 ou SEM GTIN |
| CST ICMS | Implementado | Regime normal |
| CSOSN | Implementado | Simples Nacional |
| CST PIS | Implementado | Validado |
| CST COFINS | Implementado | Validado |
| Código benefício fiscal | Implementado | Cadastro disponível |
| CST IBS/CBS | Implementado | Obrigatório conforme RTC |
| cClassTrib IBS/CBS | Implementado | Obrigatório conforme RTC |
| Base/alíquota/valor ICMS | Pendente | Motor de cálculo |
| ICMS-ST | Pendente | Base, MVA, alíquota e valor |
| FCP/FCP-ST | Pendente | Cálculo |
| DIFAL | Pendente | Cálculo e regras de destino |
| IPI | Pendente | Quando aplicável |
| Base/alíquota/valor PIS/COFINS | Pendente | Hoje só CST |
| Base/alíquota/valor IBS/CBS | Pendente | Hoje classificação, falta motor completo |
| Crédito presumido IBS/CBS | Pendente | Conforme tabelas vigentes |
| Redução/diferimento/desoneração | Pendente | Regras condicionais |
| Dados de combustível | Não prioritário | Somente se houver operação futura |
| Rastreabilidade lote/série | Pendente | Útil para equipamentos e peças |

# 5. Documentos referenciados

| Item | Status | Observação |
|---|---|---|
| NF-e/NFC-e origem | Implementado básico | Uma chave de 44 dígitos |
| Obrigação de referência em complementar/devolução | Implementado | Preflight bloqueia ausência |
| Múltiplas NF-e referenciadas | Pendente | Estrutura deve virar lista |
| CT-e referenciado | Pendente | Quando aplicável |
| Cupom/ECF/outros documentos | Pendente | Compatibilidade fiscal |
| Devolução total/parcial assistida | Pendente | Deve copiar itens e impostos da nota origem |
| Complementar assistida | Pendente | Deve identificar valor/quantidade/imposto complementado |

# 6. Pagamentos e cobrança

| Item | Status | Observação |
|---|---|---|
| Forma de pagamento NFC-e | Implementado básico | Dinheiro, cartões, PIX, sem pagamento, outros |
| Múltiplos meios de pagamento | Pendente | Ex.: PIX + cartão |
| Valor por meio de pagamento | Pendente | Necessário em pagamentos mistos |
| Troco | Pendente | NFC-e |
| Dados cartão/adquirente | Pendente | Integração TEF/adquirente quando aplicável |
| NSU/autorização | Pendente | Cartões |
| Duplicatas/faturas | Pendente | NF-e a prazo |
| Parcelas e vencimentos | Pendente | Integrar Financeiro |
| gPagAntecipado / pagamentos antecipados | Pendente | RTC |
| NFS-e pagamentos vinculados gPgtoVinc | Pendente | NT 009 permite múltiplas transações |

# 7. Transporte, retirada e entrega

| Item | Status | Observação |
|---|---|---|
| Modalidade frete | Implementado | NF-e |
| Transportadora CNPJ/CPF | Pendente | |
| Nome/IE/endereço transportadora | Pendente | |
| RNTRC | Pendente | |
| Veículo placa/UF | Pendente | |
| Volumes | Pendente | Quantidade, espécie, marca, numeração |
| Peso líquido/bruto | Pendente | |
| Local de retirada diferente | Pendente | |
| Local de entrega diferente | Pendente | Muito relevante para obra/unidade do cliente |
| Entrega em obra/unidade | Pendente | Deve aproveitar hierarquia Cliente > Unidade > Ambiente |

# 8. NFS-e Mirassol / GOVBR Cidade360

| Item | Status | Observação |
|---|---|---|
| Município IBGE 3530300 | Implementado | Roteamento fiscal |
| Provedor GOVBR/Cidade360 | Implementado no roteamento | ISS Digital |
| Endpoint API padrão nacional | Implementado | /NFSe.Api/NotaNacional |
| IM prestador | Implementado | Obrigatória |
| Código serviço | Implementado | |
| NBS | Implementado | Cadastro |
| ISS alíquota | Implementado básico | Falta motor e regras avançadas |
| ISS retido | Implementado no serviço | Falta detalhamento do responsável |
| Município prestação/incidência | Implementado | |
| finNFSe | Implementado | Regular/Crédito/Débito |
| indFinal | Implementado | Uso/consumo pessoal |
| cIndOp | Implementado | 6 dígitos |
| indPessoas | Implementado | Relação tomador/adquirente/destinatário |
| IBS/CBS classificação | Parcial | Produto/serviço possui classificação, falta cálculo |
| PIS/COFINS retidos/devidos | Pendente | NT 009/RTC |
| INSS/IR/CSLL retenções | Pendente | Conforme serviço/tomador |
| Dados de obra/CNO | Pendente | Muito relevante para PolarTech/construção |
| Código obra/art/cei quando aplicável | Pendente | |
| Intermediário do serviço | Pendente | |
| Tomador ≠ adquirente ≠ destinatário cadastral completo | Parcial | Indicador existe; faltam cadastros separados |
| Operações imóveis | Não prioritário | Só se houver fato gerador aplicável |
| Bens móveis | Pendente/condicional | Pode ser relevante para locação de equipamentos |
| gPgtoVinc | Pendente | Pagamentos vinculados |
| DANFSe NT 008 v1.02 | Implementado na ponte | XML autorizado como fonte |
| Cancelamento | Implementado via ponte | Exige retorno real |
| Substituição | Roteada, UI pendente | |
| Consulta | Roteada, UI pendente | |

# 9. Autorização e eventos

| Item | Status | Observação |
|---|---|---|
| Preflight servidor | Implementado | Bloqueia transmissão inválida |
| Autorização real | Implementado estruturalmente | Depende da ponte/provedor homologado |
| Rejeição com código/mensagem | Implementado | |
| XML autorizado | Implementado como retorno | Depende do autorizador |
| DANFE/DANFCe/DANFSe | Implementado como retorno/geração | DANFSe com rota própria |
| Cancelamento | Implementado | |
| Consulta situação | Pendente na UI/API específica | |
| CC-e | Pendente | NF-e quando permitida |
| Inutilização numeração | Pendente | NF-e/NFC-e |
| Manifestação destinatário | Pendente | Para documentos de entrada |
| Ciência/Confirmação/Desconhecimento | Pendente | Entrada |
| Distribuição DF-e | Pendente | Buscar NF-e emitidas contra CNPJ |
| EPEC / contingência NF-e | Pendente | |
| Contingência NFC-e | Pendente | |
| SVC-AN | Roteada, execução pendente | |
| Reprocessamento automático | Pendente | Para falhas temporárias |
| Idempotência | Pendente | Essencial para não emitir nota duplicada |
| Webhook/status assíncrono | Pendente | Essencial para documentos em processamento |

# 10. Segurança e auditoria

| Item | Status | Observação |
|---|---|---|
| RBAC consultar/preparar/emitir/cancelar/configurar | Implementado | |
| Certificado A1 protegido | Implementado | AES-256-GCM |
| Segredos CSC ocultos | Implementado | |
| Separação empresa/tenant | Implementado | Cofre por companyId |
| Log de quem alterou configuração | Implementado | updatedBy |
| Log imutável de evento fiscal | Pendente | Recomendado |
| Hash XML/PDF | Pendente | Integridade documental |
| Idempotency key por emissão | Pendente | Prioridade alta |
| Número/série reservado de forma concorrente | Pendente | Prioridade alta |
| Lock otimista na emissão | Pendente | Evita dupla emissão |
| Retenção XML pelo prazo legal | Pendente | Política documental |
| Backup/exportação fiscal | Pendente | |
| Monitoramento certificado | Parcial | Existe daysToExpiry; falta alerta automático |

---

# Resultado da auditoria

## Cobertura considerada pronta
- Estrutura Central Fiscal.
- Cadastro fiscal base da empresa.
- Certificado A1.
- Série NF-e/NFC-e/RPS-DPS.
- CSC NFC-e.
- NCM/CFOP e classificação fiscal principal do produto.
- Serviço NFS-e com código/NBS/ISS.
- Finalidade completa da NF-e 1–6.
- Entrada/saída.
- Destino da operação.
- Consumidor final.
- Indicador de presença.
- Documento referenciado básico.
- Campos operacionais NFS-e RTC: finNFSe, indFinal, cIndOp, indPessoas.
- Pré-validação no servidor.
- Roteamento Mirassol/GOVBR e SEFAZ-SP.
- Autorização/cancelamento por ponte fiscal.
- DANFSe estruturado para NT 008/2026 v1.02.

## Cobertura parcial que deve ser concluída antes de chamar o módulo de "fiscal completo"
1. Motor de cálculo tributário ICMS/ICMS-ST/FCP/DIFAL/PIS/COFINS/IBS/CBS.
2. Pagamentos completos, parcelas, duplicatas e pagamentos mistos.
3. Transportadora, veículos, volumes, retirada e entrega.
4. Múltiplos documentos referenciados e devolução/complementar assistidas.
5. Retenções completas da NFS-e.
6. Pessoas distintas na NFS-e (tomador/adquirente/destinatário).
7. CNO/obra e campos de construção civil.
8. Eventos: CC-e, inutilização, distribuição DF-e e manifestação.
9. Contingência NF-e/NFC-e.
10. Idempotência, numeração concorrente e trilha imutável de eventos.

# Prioridades recomendadas

## P0 — antes de emissão real em produção
- Idempotência de emissão.
- Controle transacional de número/série.
- Consulta de status pós-envio.
- Persistência imutável de XML/protocolo/eventos.
- Testes em homologação Mirassol, NF-e e NFC-e.
- Regras de cálculo tributário validadas pelo contador.
- Conferência de certificado, CSC e credenciamento real.

## P1 — operação diária
- Devolução assistida.
- NF-e complementar assistida.
- Pagamento/parcelas integrados ao Financeiro.
- Retirada/entrega/transportadora.
- Retenções NFS-e.
- CNO/obra.
- CC-e e inutilização.
- Distribuição DF-e / notas de entrada.

## P2 — automação e inteligência
- Motor de CFOP/CST/CSOSN sugerido por cenário.
- Tradução de rejeições com link direto para o campo.
- Atualização automática das tabelas NCM, cClassTrib, CST IBS/CBS e cIndOp.
- Monitor de alterações de NT/SEFAZ/NFS-e.
- Auditor fiscal automático por documento.
- Conciliação XML x Financeiro x Estoque x OS.

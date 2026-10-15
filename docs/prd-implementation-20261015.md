# ProAR — execução do PRD recebido em 15/10/2026

## Entrega desta atualização

- Central de Licitações: nova aba Habilitação e BDI, usando o estado compartilhado da empresa e a confirmação de gravação já existente.
- Cadastro e alteração de certidões Federal, Estadual, Municipal, FGTS, CNDT e Falência, com validade, emissor, número, fonte HTTPS e resultado/data da conferência manual.
- Alertas visuais em 15 e 5 dias, vencimento no dia civil de São Paulo, identificação de restrição, conferência pendente e ausência. Integração à Central de Pendências.
- Uma certidão restritiva não é ocultada por outra regular: exige resolver o registro ou inativá-lo com motivo, preservando auditoria.
- Bloqueio de confirmar participação na triagem e de mudar Certames para Participaremos / Proposta enviada quando a habilitação não está regular. Isso é um controle interno, sem envio a portal externo.
- Cofre do radar usa os documentos compartilhados, substituindo rascunhos no localStorage.
- Acervo: contratante, família de sistema, capacidade BTU/h, quantidade, ART/TRT e link do documento. Busca por TR (12.000 BTU/h) ou BTU/h; soma somente com autorização expressa do operador de que o edital aceita. A comparação não atesta habilitação jurídica nem interpreta automaticamente o edital.
- Formação de preço: mão de obra, peças, insumos, deslocamento, ferramentas, AC, riscos, seguros, despesas financeiras, lucro e tributos. Fórmula multiplicativa, cálculo de BDI e preço, salvamento e recuperação de composições.
- Validação de documentos, custos e permissões no servidor e trilha de auditoria existente.
- PMOC: periodicidade de calendário real (mensal, bimestral, trimestral, semestral, anual) e personalizada por dias; início e última manutenção como referência estável. O vencimento não avança sozinho ao abrir a tela. Cadastro de CREA/CFT e ART/TRT no plano.

## Base existente reaproveitada

Radar PNCP/portais, consulta externa segura, medição/empenhos/contratos, cadastro hierárquico, equipamento/QR e histórico, checklist de OS, evidências, assinatura do cliente, assinatura padrão do funcionário, comprovante PDF, jornada/GPS e fila offline idempotente já possuem implementações no repositório. A existência desses recursos não significa que todos os critérios avançados do PRD estão integralmente atendidos.

## Requisitos que dependem de outra implementação ou integração

- Consulta autenticada/robôs para validar certidões nos emissores; não se confunde com a validade informada pela equipe.
- Job às 07h com push/e-mail: falta configuração de destinatários e canal; esta entrega oferece pendências internas calculadas ao consultar o sistema.
- ICP-Brasil e carimbo de tempo: exigem provedor/certificado e cadeia de validação. A assinatura desenhada do atendimento é uma evidência e não deve ser apresentada como assinatura ICP-Brasil.
- Retenções fiscais e emissão NFS-e: dependem do regime, município, natureza da operação e configuração fiscal. Não aplicar universalmente 11% de INSS ou uma alíquota de ISS.
- Qualidade do ar: cadastro de resultados laboratoriais, parâmetros vigentes por norma e aprovação do RT ainda requer implementação específica; não classificar automaticamente com limites antigos.
- Geofencing, roteirização com trânsito e upload de evidências com marca d’água obrigatória: exigem validação do fluxo completo, política de exceção e, quando aplicável, provedor.
- Migração para React Native/Flutter/WatermelonDB não integra esta atualização. O aplicativo atual continua com Next.js/PWA e shell Capacitor Android.
- Livro PMOC completo com certificado, BMS completo de todos os modelos de contrato, estoque volante automático em todos os consumos e SLA contratual avançado precisam de critérios de homologação próprios.

## Correções normativas ao PRD

A Lei 13.589/2018, art. 1º, trata de edifícios de uso público e coletivo com ambientes climatizados artificialmente, sem restringir a obrigação de PMOC a mais de 5 TR. A RE 09/2003 foi expressamente revogada pelo art. 3º, XI, da RDC 886/2024. Essas referências do anexo não devem gerar regras automáticas desatualizadas.

Fontes oficiais consultadas:
- https://planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13589.htm
- https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&cod_menu=9431&cod_modulo=310&link=S&numeroAto=00000886&orgao=RDC%2FDC%2FANVISA%2FMS&seqAto=000&tipo=RDC&valorAno=2024

Os demais itens do PRD são backlog explícito; não são apresentados como concluídos por este pacote.

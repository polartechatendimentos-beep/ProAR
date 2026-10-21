# Licitações: BDI no dossiê e preferências de filtros

- A gaveta do edital permite informar custos diretos mensais e percentuais de BDI. Usa o motor multiplicativo existente, sem alíquotas presumidas.
- A composição é persistida junto ao acompanhamento do edital, sob a permissão `licitacoes.editar` e validação do ledger no servidor. Registros anteriores continuam válidos sem composição.
- Usar preço mensal na minuta é uma ação explícita. Calcular ou salvar a composição não substitui o preço já informado. Gerar minuta não envia proposta ao portal.
- Filtros e formato de visualização podem ser salvos, aplicados e esquecidos por empresa e usuário autenticado neste navegador. Não há sincronização entre dispositivos. O formato antigo global não é restaurado entre usuários.
- Nenhuma migração, carga fictícia, alteração de estoque ou atualização em massa de registros existentes.

## Limites e continuidade

Estoque por viatura continua pendente de integração persistente. Os helpers atuais com vehicleId/technicianId não estabelecem, por si, um fluxo transacional completo de vínculo, transferência e consumo. A sincronização de preferências entre dispositivos e a validação visual autenticada em aparelhos reais continuam pendentes.

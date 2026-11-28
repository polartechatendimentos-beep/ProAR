# Homologação: correções prioritárias da auditoria operacional

Esta revisão amplia o PR #328. Não requer migração e não autoriza publicação automática.

## Fila e confirmação de gravações

- Na edição de um cadastro elegível, trabalhe sem rede. Registre duas alterações distintas, reconecte e confira os dois resultados na seção **Alterações neste aparelho**.
- Altere o mesmo cadastro em outro aparelho antes de reconectar. A fila deve conservar a edição offline para revisão e não sobrescrever o cadastro online. Baixe os dados da alteração se precisar aplicá-la manualmente; só depois confirme a remoção do rascunho local.
- Replique falha de rede em Clientes, Cadastro Rápido, Orçamentos, Compras e edição de OS. O formulário permanece em edição, e só se anuncia gravação após o banco confirmar. Ações críticas como faturamento, alteração financeira e programação final da OS não entram na fila genérica de desktop.
- Cópias legadas de toda a empresa continuam intactas no navegador, sem reaplicação automática. Peça avaliação assistida antes de limpar o armazenamento. A fila específica do técnico em Mobile permanece independente.

## Agenda

- Abra o mesmo horário do mesmo técnico em dois aparelhos e confirme nas duas sessões. Só uma revisão pode gravar. Repetir após carregar a revisão nova deve informar o conflito de horário, mantendo o formulário editável.
- Faça o mesmo com alteração de agenda, Atendimento e Mobile. Um rascunho não reserva horário; uma ordem antiga com sobreposição não bloqueia uma correção alheia à programação.

## Fiscal

- Use ambiente de homologação e provedor de teste. Perda de resposta ou protocolo inconclusivo deve conservar a tentativa registrada; repetir ou trocar o valor não pode disparar nova DPS.
- Use **Consultar NFS-e** para consultar a tentativa original. Só a rejeição fiscal definitiva permite nova emissão. A autorização só deve aparecer quando o resultado contiver identificador fiscal.
- A consulta real exige o endpoint somente de leitura do adaptador definido em [NFSE-RECONCILIACAO.md](./NFSE-RECONCILIACAO.md). Não configurar a URL de emissão para consulta. Validar autorização, rejeição e processamento com o adaptador antes de publicar.

Os itens de evolução de produto do relatório (portal do cliente, integração ampliada por QR/PMOC, métricas e outras homologações de campo) não são correções deste lote.

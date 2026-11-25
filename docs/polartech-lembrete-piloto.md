# Lembrete de continuação do atendimento no piloto

- Desativado por padrão, separado do módulo de lembretes de higienização. Só é elegível quando um administrador habilita a configuração para o número de teste da empresa e há expediente configurado. A troca do número ou nova habilitação não alcança as mensagens anteriores.
- Uma pergunta real, recebida no aparelho e ainda sem resposta, pode gerar **um** lembrete curto no intervalo escolhido (15 a 1380 minutos) durante o expediente. A janela é inferior a 24 horas desde a última mensagem do contato. Se o expediente não coincidir com essa janela, não há envio.
- Qualquer resposta, pausa, pedido de descadastro, encaminhamento, encerramento, atribuição ou ação de atendente impede a tentativa pendente. Uma reserva idempotente e uma nova leitura imediatamente antes de chamar o WhatsApp impedem o envio se a conversa já mudou. Depois que a solicitação sai ao provedor, ela não pode ser cancelada.
- Não reenviar se o resultado do provedor for incerto. Os estados de envio aparecem no histórico do atendimento. Um aceite do servidor não é uma confirmação de entrega no aparelho.
- O piloto não se estende a clientes externos. A autorização administrativa para o número de teste não equivale ao consentimento de outros destinatários para mensagens de acompanhamento.

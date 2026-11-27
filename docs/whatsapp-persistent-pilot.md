# Fila persistente do piloto de WhatsApp

Esta etapa não liga automação, não altera o webhook do provedor e não migra contatos. Nos ambientes sem a flag e sem o identificador explícito da empresa, o endpoint continua com o caminho atual. Não vincule número real de cliente ao piloto.

## Fluxo

1. O webhook autentica evento, empresa e instância como antes. Somente mensagens elegíveis do número interno são registradas na fila privada da empresa antes da confirmação HTTP. Opt-out é aplicado de imediato, fora da fila. A fila não contém arquivos de mídia ou credenciais.
2. O processo pós-resposta do webhook inicia a fila. Uma concessão de tempo e atualização por revisão mantêm somente um consumidor em cada empresa, sem substituir o acionamento por evento pelo cron. O cron de WhatsApp existente é recuperação limitada, não o caminho primário.
3. O consumidor revalida o piloto, o número, a instância, a janela de envio e o estado da conversa. Mensagens vencidas ou de piloto alterado ainda entram no histórico, sem resposta retroativa. A triagem de texto continua local e não depende da disponibilidade da OpenAI.
4. O envio tem chave por evento. Se houver reserva no Atendimento sem registro de tentativa, a recuperação pode continuar, desde que a conversa ainda autorize. Se já houver um registro de tentativa, a recuperação reconcilia a aceitação comprovada ou marca incerteza. Nunca chama o provedor de novo apenas por falta de confirmação.
5. Em Atendimento → Conexão → Recebimento de mensagens, o administrador pode conferir pendências e exceções. Se houver exceções, compare com a conversa no aparelho. Não reenvie às cegas. O alerta de exceção não implica entrega nem desaparece automaticamente. A fila para de aceitar novos trabalhos se lotar, sinalizando erro ao webhook em vez de confirmar e descartar.

## Validação e habilitação controlada

- Em homologação, manter `PROAR_WHATSAPP_DURABLE_PILOT` desligada por padrão. Quando autorizado para um novo teste interno, usar tenant isolado, `PROAR_WHATSAPP_DURABLE_PILOT_COMPANY_ID` apontando exatamente para esse tenant e as configurações existentes do bot para um único número de teste. A ativação global de automação existente continua necessária. Não ampliar o escopo.
- Testar webhook duplicado, falha antes de persistir, falha depois de aceitação pelo provedor, opt-out e piloto desativado. Confirmar no aparelho o caso positivo e nunca confundir “aceita pelo provedor” com “entregue”.
- Se for preciso parar novos envios, desative o bot do número interno. Retirar a flag apenas desativa a fila e retorna ao caminho que já existia; não é um bloqueio geral do WhatsApp. Não reproduza eventos antigos.
- Não foi validado contra credenciais, banco ou número reais nesta implementação. Análise de mídia/PDF e troca para a API oficial da Meta ficam fora desta etapa.

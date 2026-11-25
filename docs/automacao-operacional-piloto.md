# Validação operacional do piloto no ProAR

Execute com o número interno autorizado, sem remover a restrição do piloto. Não reutilize mensagens antigas nem teste com um cliente real.

## WhatsApp

1. Na Central de Atendimento, verifique se o recebimento de eventos está ativo e se o assistente está liberado somente para o número de teste.
2. Do telefone de teste, envie “Meu ar está pingando”. Depois que chegar a primeira resposta, envie “É pela unidade de dentro”, sem aguardar cinco minutos.
3. Confirme que as duas respostas chegaram ao telefone e que a segunda usa a informação nova sem repetir a pergunta. Na Central de Atendimento, verifique que a aceitação do envio não é exibida como entrega e que eventual recibo corresponde à mesma mensagem.
4. Em testes com dados fictícios, verifique que eventos repetidos ou fora de ordem não provocam outro envio, e que uma conversa em atendimento humano não recebe a resposta automática.
5. Só amplie o piloto depois de confirmar entrada, envio e entrega, incluindo a segunda resposta, e revisar as pendências com a equipe.

## Agenda

- Use um cliente de teste identificado e revise um rascunho de retirada e outro de instalação. As duas visitas devem ter horários e ordens distintos.
- Para mover uma visita existente, abra a OS correspondente, revise disponibilidade e confirme que o número da OS não mudou. Um conflito ou erro de gravação não deve resultar em confirmação para o cliente.
- Verifique a mesma solicitação duas vezes no ambiente de teste e confira que ela não cria uma segunda ordem indevida.

## Pendências do expediente

- Confira apenas conversas novas aguardando retorno, orçamentos efetivamente pendentes e visitas do dia seguinte ainda sem confirmação registrada.
- Não trate uma página incompleta ou fonte indisponível como ausência de pendências. Não envie resumo vazio nem use o resumo para responder clientes.

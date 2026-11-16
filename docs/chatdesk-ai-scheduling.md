# Sugestões e agenda do atendimento

A central reutiliza a credencial OpenAI da empresa via getOpenAiCredential. Rascunhos consideram até 12 mensagens recentes e o texto digitado. Notas internas não são enviadas ao modelo. A resposta precisa de aceite e envio pelo operador. O preenchimento assistido ao digitar é opcional, com espera de 1,8 s e descarte de respostas de textos anteriores. Não há consulta de preço ou agenda pelo modelo.

O agendamento é determinístico e usa a base operacional da empresa. Em Assistente local, o administrador informa técnico (ID existente), serviço previamente combinado, dias, expediente, duração e intervalo de deslocamento. Ative também o assistente e os envios automáticos na conexão. A opção de agendamento começa desativada.

Uma mensagem como “higienização depois das 16h” gera até três opções, uma por dia, nos próximos 15 dias. O serviço deve constar em uma das 12 mensagens recentes do cliente e corresponder ao serviço configurado. Cadastro, telefone e endereço precisam ser únicos; bloqueios financeiros e conflitos são conferidos pelo mesmo preparador usado nas ações da central. Clientes com OS ativa são encaminhados para a equipe.

O cliente escolhe usando AGENDAR <código> <opção>. As ofertas expiram em 15 minutos. A confirmação revalida endereço, regras, agenda e revisão do estado, cria uma OS com identificador estável por evento e vincula a conversa. O envio usa a fila persistente; aceitação pelo servidor não comprova entrega. Falha de envio fica no histórico para conferência. Quem assume o atendimento pausa o assistente.

Limites: não há interpretação de toda linguagem natural, escolha de vários serviços, otimização geográfica, lista de espera automática nem reagendamento autônomo. O intervalo configurado é uma margem fixa de deslocamento; o administrador deve adequá-lo à área atendida. A oferta ainda não bloqueia o horário. A reserva ocorre apenas na escolha e uma disputa é resolvida pelo controle de revisão do estado. Alterações simultâneas na conversa e na base operacional não formam uma única transação; confirmar ativação com um número de homologação e dois clientes concorrentes antes de liberar a operação.

Homologação operacional: cadastrar cliente sintético, configurar técnico e serviço de teste, habilitar o assistente apenas no ambiente de homologação, pedir opções após 16h, ocupar uma opção com outro atendimento e escolher o horário. Conferir nova consulta, OS única após redelivery, interrupção após assumir, opt-out e isolamento entre empresas. Sem credenciais de homologação, os testes automatizados de domínio não comprovam entrega real nem o comportamento do provedor.

## Reforço de segurança — 16/11/2026

A escolha de um horário agora compara a revisão da conversa e o identificador da oferta **imediatamente antes** do commit da OS. Se um operador assumir ou pausar a conversa, se o cliente retirar a autorização, se a oferta for substituída ou se a conversa tiver sido modificada, o agendamento automático não prossegue com o snapshot anterior. Há um teste de regressão para cada condição.

**Limitação importante:** esta checagem reduz a janela de risco, mas não torna chat e OS uma única transação. Uma alteração ainda pode ocorrer durante o commit operacional. Exigir homologação com disputa real operador × bot antes de habilitar, e não prometer reserva atômica enquanto os stores permanecerem separados. O PR também requer resolução dos conflitos com a branch de produção atual.

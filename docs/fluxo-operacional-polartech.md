# Fluxo operacional: roteiro de homologação

Esta entrega não exige migração nem alteração de dados de produção.

1. Em Orçamentos, adicione um item e simule uma perda de rede após iniciar a gravação. A proposta deve continuar preenchida, sem confirmação falsa. Reenvie e consulte a lista para conferir que o mesmo identificador foi usado. Em duas sessões, confira o conflito e revise as alterações antes de repetir.
2. Abra um orçamento enviado. Registre o aceite expresso do cliente em um orçamento sem alçada ou siga o fluxo de aprovação existente. Converta em OS. Confira cliente, local, quantidades, valor e vínculo de origem. A operação só é confirmada depois do banco. Repita em outra sessão para conferir que não cria outra OS.
3. Na agenda de homologação, inclua uma visita sem técnico para o dia local e uma OS aguardando peça. Na tela inicial, cada pendência deve abrir a OS correta. A contagem de conversas usa a consulta restrita a administradores; falha ou consulta parcial não equivale a uma fila vazia.
4. Na lista de OS, use exclusivamente o emissor fiscal de homologação. Valide o retorno de campo obrigatório, a preservação do valor e a classificação de uma resposta inconclusiva. Não reenvie quando o emissor ainda não confirmou o resultado.
5. Na ficha do cliente, confira vínculos pelo identificador após renomear o cliente. O atalho de conversa consulta o Atendimento, respeita o acesso do usuário e não envia mensagem. Em mobile, confira que a OS com envio pendente não é apresentada como concluída e que o SOS permanece fora do detalhe da OS.

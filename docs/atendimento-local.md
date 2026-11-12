# Central de atendimento com assistente local

Rota: `/atendimento`. Acesso pelo cadastro de Clientes e pela configuração do WhatsApp.

## Assistente sem serviço externo de IA

A central não chama OpenAI, Gemini nem outro modelo externo. O classificador local usa regras para triagem dos setores Geral, Técnico, Financeiro, Comercial e PMOC. Sugere respostas conservadoras e prepara um rascunho de solicitação para revisão. Não confirma diagnóstico, peças, preço, horário, pagamento nem cria uma OS fictícia.

O nome da empresa é carregado do cadastro real. O administrador pode configurar uma saudação e preparar respostas automáticas. Não existem clientes, métricas ou mensagens demonstrativas no ambiente operacional.

## Multiempresa e equipe

A empresa vem exclusivamente da sessão. Um identificador enviado pela tela é usado apenas para conferir correspondência com a sessão. Registros, configurações, números, QR Codes, mensagens, notas e lembretes usam a base resolvida para a empresa autenticada. Registros retornados com outro companyId são recusados.

A visibilidade dos setores deriva das permissões reais: Clientes/Comercial, OS/PMOC e Financeiro. Permissão de leitura em um setor não autoriza escrita. O nome e o cargo das respostas são adicionados pelo servidor a partir da sessão; não há seletor para fingir ser outro funcionário. Cadastros de colaboradores continuam sendo geridos no módulo de Funcionários do ProAR.

Assumir um atendimento pausa o assistente. Outro colaborador não pode assumir silenciosamente uma conversa já atribuída. Transferências, alterações de etapa, notas e vínculo com OS existente geram histórico. O vínculo exige uma OS encontrada na base da própria empresa. O funil CRM mostra apenas os atendimentos carregados e suas etapas reais.

## Recebimento e envio

`POST /api/whatsapp/web/events/[companyId]` recebe eventos de texto da Evolution. Exige um segredo por empresa em cabeçalho, cadastro ativo e correspondência exata da instância. Ignora grupos, mensagens do próprio número e eventos não suportados. Não importa o histórico anterior da Evolution nem baixa anexos; para mídia sem texto, orienta consultar o WhatsApp.

O administrador ativa o recebimento por `POST /api/atendimento/recebimento`. O endereço base vem da variável de servidor `PROAR_WHATSAPP_WEBHOOK_BASE_URL`, nunca de uma URL fornecida pelo navegador. A ativação só retorna sucesso após conferir a configuração na Evolution, incluindo o cabeçalho de autenticação. O endpoint de callback precisa estar publicamente acessível, com HTTPS e autenticação da aplicação preservada para as demais rotas.

Respostas humanas e automáticas usam a caixa de saída já existente, com reserva persistente antes de enviar. Notas internas nunca passam pelo transporte. O histórico distingue processamento, aceitação, bloqueio e resultado desconhecido. Não equivale a confirmação de entrega ou leitura. Resultados incertos não são reenviados automaticamente.

## Pedidos de interrupção

Pedidos como SAIR, PARAR, STOP e frases de interrupção são registrados por empresa e telefone. Bloqueiam também os lembretes agendados e testes para esse destinatário. Somente a gestão pode registrar nova autorização com justificativa; o assistente continua pausado até conferência.

## Automações

Respostas automáticas exigem simultaneamente: configuração específica da empresa, liberação geral `PROAR_EVOLUTION_AUTOMATION_ENABLED=true`, número conectado, cliente sem bloqueio, conversa sem responsável humano e assistente não pausado. Há intervalo mínimo de cinco minutos entre respostas automáticas da mesma conversa.

Novas mensagens, comandos e mudanças de estado usam gravação otimista com revisão. Conflitos refazem a leitura e preservam alterações de outros colaboradores. O histórico por conversa tem limite de 1.500 registros; ao atingir o limite, novas escritas são recusadas para evitar perda silenciosa. Uma rotina de arquivamento e paginação de transcrições completas ainda precisa ser acrescentada antes de operação em grande volume.

## Homologação

- Endereço reservado: `https://homologacao.proar.online`, vinculado somente à branch `feat/proar-whatsapp-web`.
- Automações gerais continuam desabilitadas na homologação.
- Conferir login, dois clientes com bases provisionadas, setor de cada colaborador, recepção real, assinatura, nota interna, transferência, teste de envio, interrupção e reconexão.
- Dimensionar a VPS para o número de empresas simultâneas. O código não compra nem aumenta o plano.
- Não há IA generativa, interpretação de imagens, anexos pelo chat, indicadores de ROI fictícios ou emissão fiscal automática por texto de cliente.

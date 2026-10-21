# ProAR Mobile — pacote do dia e central de recuperação

Base: production cfafeb20ba951164dda4b3b23d0841d741b20439. Primeira entrega das prioridades aprovadas pelo usuário nesta conversa. Mantém os módulos existentes, dados reais e APIs de gravação. Não executa migrations, seeds, exclusões ou alterações de permissões de funcionários.

## Implementado

1. Após uma leitura autenticada do bootstrap, prepara automaticamente uma cópia criptografada das OS do dia e dos atendimentos já iniciados. Limite de 200 OS, com aviso explícito de pacote parcial. Inclui somente a projeção operacional já autorizada: cliente/local, informações da OS e opções de equipamento. Não copia o banco gerencial completo.
2. Central em Mais e atalho disponível na operação: lista rascunhos, preparações aguardando envio, solicitações já transmitidas sem confirmação e bloqueios que exigem revisão. Mostra também metadados da fila de frota/jornada do mesmo escopo, sem criar outra fila nem mudar as regras de envio.
3. Rascunhos criptografados podem ser retomados pela central. Envios pendentes não desaparecem automaticamente após 30 dias. Gravação adicional ao ocultar o aplicativo ajuda a preservar o preenchimento, além do debounce, pagehide e desmontagem existentes. O sistema operacional pode interromper uma escrita ainda em andamento; não se promete proteção absoluta contra desligamento abrupto.
4. Preparo manual do acesso offline e dos históricos de cliente das OS do pacote: duas consultas simultâneas, até 20 OS e 30 registros por histórico, com aviso de falhas/cobertura parcial. Usa os endpoints autenticados existentes; não cria atendimentos fictícios. Cópias de fotos remotas e PDFs não são baixadas. Fotos preenchidas pelo técnico continuam no rascunho criptografado da OS.
5. Ao abrir o Mobile offline na mesma sessão da aba, carrega o pacote válido. A validade termina no menor limite entre expiração da sessão, trial conhecido, oito horas desde o preparo e meia-noite em Brasília. Não guarda cookies, senhas, tokens de acesso ou assinatura da sessão no pacote.
6. HTTP 401/403 limpa a identificação temporária de leitura. Abrir o sistema completo também a limpa; novo acesso offline depois de fechar a sessão/aba pode exigir uma conexão para confirmar a identidade novamente. Conteúdo e chaves permanecem separados por empresa/usuário. Não há promessa de revogação remota instantânea sem conexão.
7. Após uma conclusão confirmada, remove a OS do pacote local. Mudanças de versão impedem reaproveitar o histórico do pacote anterior. Um preparo em andamento não pode sobrescrever um pacote que foi atualizado no servidor. Requisições de bootstrap antigas são abortadas/ignoradas para evitar trocar o escopo depois de uma nova leitura.
8. Service worker registrado no Mobile, cache v7, preparo do HTML e scripts/CSS próprios, confirmação explícita por MessageChannel. A UI só confirma interface offline após resposta positiva. Falha de arquivo não produz sucesso fictício. APIs não entram no cache; fallback de navegação mantém Mobile somente em `/mobile`, preservando a interface completa na raiz.
9. Versão do Mobile atualizada para 2026.10.20.1. Retentativas de OS continuam usando a mesma chave idempotente. Conflitos e jornada/permissões são verificados no servidor; a central não transforma um rascunho ou timeout em conclusão.

## Como usar

Com conexão e sessão válida, abrir `/mobile`, atualizar os atendimentos e acessar Mais → Central de sincronização e recuperação → Preparar acesso offline e históricos. Aguardar a confirmação e conferir quantas OS/históricos foram preparados. A mesma tela permite retomar a OS, revisar dados e consultar a confirmação do envio. A Central de campo continua responsável por sua fila de frota/jornada.

No atendimento sem rede, abrir uma OS presente no pacote e preencher o rascunho. Histórico offline está disponível na consulta do cliente dessa OS; filtro por equipamento e arquivos remotos precisam de conexão. Depois, sincronizar e conferir o resultado no servidor. Não limpar os dados do navegador enquanto houver registros pendentes.

## Limites e demais sugestões aprovadas

Este pacote cobre offline, central de sincronização e recuperação. A revisão de comprovante de conclusão, assinaturas, checklist documental, diagnóstico do Radar e verificação de versão existentes foram preservados. Isso não constitui auditoria integral de todas essas funções.

Estoque transacional por viatura; BDI dentro da gaveta; filtros salvos por usuário no servidor; histórico universal de alterações por registro; painel único de todas as integrações; e aprimoramentos adicionais do cofre documental/comprovantes continuam pendentes de implementação ou auditoria específica. A homologação visual autenticada em celular, tablet e computador também não foi executada nesta etapa. Não se apresentam as 12 sugestões nem o catálogo de 820 itens como concluídos.

## Validação

Testes exercitam armazenamento criptografado com adaptador IndexedDB em memória e operações reais WebCrypto: escopo, validade, atualização concorrente, remoção após confirmação, retenção de pendências e metadados da fila. Testes do worker executam seu código em VM com respostas de rede controladas, incluindo arquivos indisponíveis e fallback por rota. Evidência em `docs/validation/mobile-offline-recovery-20261020.log`. Os testes não comprovam disponibilidade contínua da rede nem comportamento de todos os sistemas operacionais.

Suíte completa local: 438 testes aprovados. TypeScript aprovado, lint sem erros (com avisos) e build Next.js concluído. O commit enviado também deve passar pelas verificações automáticas de produção antes do merge.

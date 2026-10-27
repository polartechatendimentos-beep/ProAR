# ProAR Field: jornada e central operacional

## Entregue

- Field usa dados reais e continua ocultando OS concluídas/canceladas. Técnicos com vínculo por employeeId/techId são filtrados pelo ID; nome/login permanece como compatibilidade para OS legadas sem esses IDs.
- Jornada integrada ao serviço existente: entrada, pausa, retorno e encerramento. Selfie de evidência é exigida para entrada/retorno de técnicos; não constitui reconhecimento facial nem prova de vida. Imagens são compactadas e armazenadas criptografadas com AES-GCM, chave derivada por empresa, fora das respostas comuns.
- Técnicos precisam de jornada ativa e não expirada para iniciar/editar/concluir OS. A mesma regra cobre o PUT legado de estado para impedir desvio pelo desktop. Gestores mantêm suas permissões próprias. Funcionário com mobileAccessEnabled=false é bloqueado.
- Nova API de OS aceita somente relatório, diagnóstico, checklist, fotos, assinatura de aceite e transição operacional. Não aceita alteração financeira, fiscal ou estoque pelo payload mobile. Usa o validador e os livros do ERP, CAS do snapshot, chave idempotente, versão e fingerprint do registro para detectar alterações pelo desktop.
- Check-in/check-out de técnicos exigem GPS recente com precisão de até 100 m. Fechamento exige check-in, equipamento, diagnóstico, serviço executado, fotos antes/depois, aceite identificado e checklist técnico do tipo de serviço.
- Frota: cadastro e atribuição de veículo por gestão autorizada; checklist completo e registro de avarias; veículo inseguro não libera atuação em OS. Abastecimentos validam odômetro e calculam autonomia apenas entre dois abastecimentos completos consecutivos, com alerta por faixa operacional de referência. Aviso de revisão por quilometragem.
- SOS explícito registra alerta prioritário e fotografia pontual do GPS quando disponível; funciona em pausa sem reiniciar o rastreamento contínuo. A gestão recebe os alertas na Central, consultada a cada 15 segundos, e registra a providência tomada. Não envia automaticamente a contatos externos ou serviços públicos de emergência.
- Solicitação e decisão de ajustes de jornada são novos registros: não editam nem apagam as marcações originais.
- Marcação operacional fica em work-punch-v1, independente da limpeza de amostras GPS de 90 dias. Histórico e download JSON individual autenticados; comprovantes não são apresentados como REP-P.
- Fila web durável, criptografada com AES-GCM/IndexedDB e escopo confirmado pelo servidor (empresa/usuário), para checklist, abastecimento e pedido de ajuste. Estados pendente/em transmissão/falha e backoff. Sem cookies, senhas ou tokens persistidos. SOS, jornada e conclusão de OS nunca são mostrados como confirmados offline.
- Android: pausa de coleta separada de encerramento e fila GPS protegida pelo Android Keystore. GPS continua somente no expediente. Pontos históricos capturados antes da pausa podem sincronizar depois; posições capturadas durante descanso são rejeitadas pelo servidor. APK anterior encerra a coleta ao falhar a nova função pause e informa a necessidade de atualização.

## Requisitos que ainda dependem de integração ou homologação

- Reconhecimento facial com prova de vida, cadastro de biometria, políticas de retenção e provedor apropriado. A selfie web é evidência para conferência, sem identificação biométrica automática.
- REP-P: INPI, Atestado Técnico/Termo de Responsabilidade, NSR, AFD/AEJ nos leiautes vigentes, ICP-Brasil/PAdES/CAdES e comprovantes legais. Não ativar como substituto de ponto trabalhista oficial antes de completar e validar essa integração.
- Cercas virtuais configuradas, classificação sede/residência/primeira OS e horário contratual/limites configuráveis. Não inferir esses locais nem uma jornada legal a partir de endereços ou do limite operacional de 12h do rastreamento.
- GPS/iOS em segundo plano, comandos de hardware, BLE/Wi-Fi Direct/P2P, identidade mútua e protocolo criptografado de retransmissão. Dados encaminhados por outro dispositivo devem preservar origem, assinatura, tenant, destinatário e idempotência; nenhum colega deve ler evidências de outro.
- OCR de odômetro/notas, upload privado de comprovantes de combustível, áudio de SOS com autorização explícita e entrega externa por push/WebSocket/contatos cadastrados. A consulta web de 15s não é despacho instantâneo garantido.
- Transcrição/laudo por IA e resumo diário dependem da decisão sobre credencial/provedor e configuração de custo. Nenhuma nova chamada de IA foi adicionada nesta etapa.
- Fila offline de OS/fotos/assinatura e de ponto exigirá política de reconciliação com a jornada efetivamente ativa no horário da coleta. A fila atual não confirma essas ações sem servidor.

## Validação

Testes de domínio: isolamento, permissões, idempotência, odômetro, autonomia, aprovação sem alterar original, liberação de veículo, jornada pausada/expirada, concorrência com desktop, evidências de fechamento, criptografia por empresa e GPS durante pausas. CI do ProAR executa typecheck/lint/testes/build/smoke. CI Android compila APK debug nas alterações nativas do PR/production.

Antes de campo, testar em dispositivo real: câmera/selfie, pausas, GPS com tela bloqueada, retomada, internet interrompida, reinício do app, troca de usuário, SOS em pausa, permissões negadas, assinatura e economia de bateria. Build e testes de domínio não substituem teste físico.

Fontes de REP-P verificadas em 13/10/2026: https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/rep e https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/Perguntas%20e%20Respostas%20REP .

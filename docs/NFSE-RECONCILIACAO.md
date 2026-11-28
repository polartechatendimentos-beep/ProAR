# NFS-e: conferência de uma tentativa sem resposta conclusiva

O ProAR grava o vínculo empresa + ordem de serviço + tentativa antes de enviar a DPS. Se a conexão cair, o adaptador responder com conteúdo inesperado ou a SEFIN continuar processando, o documento fica em **Processando**; repetir a emissão não dispara outro envio. Só a rejeição explícita e conclusiva do adaptador libera a correção e nova tentativa.

## Contrato da integração

- `PROAR_SEFIN_NACIONAL_ADAPTER_URL`: endpoint existente, usado somente para emissão. O POST tem chave de idempotência gerada no servidor e o adaptador deve respeitá-la.
- `PROAR_SEFIN_NACIONAL_ADAPTER_LOOKUP_URL`: URL autorizada do endpoint **somente leitura** do mesmo adaptador. Não use a URL de emissão como substituta; esta consulta não chama diretamente a SEFIN.
- A consulta é um GET com Bearer `PROAR_SEFIN_NACIONAL_ADAPTER_TOKEN` e parâmetros `companyId`, `serviceOrderId` e `idempotencyKey`. O adaptador precisa resolver essa chave para o identificador da DPS original, confirmar seu estado fiscal sem retransmiti-la e devolver `companyId` e `idempotencyKey` correspondentes, além do resultado. Exemplo sintético: `{"companyId":"empresa-teste","idempotencyKey":"chave-da-tentativa","result":{"status":"Autorizada","number":"123","verificationCode":"ABC"}}`.
- Para rejeição definitiva, use `status:"Rejeitada"` no resultado com HTTP 200 ou 422 **somente** se houver resposta fiscal conclusiva para a tentativa, não para indicar busca sem resultado. Um 404, erro de comunicação, tenant/chave divergente, protocolo isolado ou resposta inconclusiva mantém o bloqueio.
- Se a consulta não estiver configurada, confira o resultado no emissor nacional antes de qualquer ação. A interface não libera reemissão por ausência de confirmação. Tentativas legadas usam o valor salvo na OS e a chave original derivada do identificador da empresa da sessão usada para emissão. Se essa sessão mudou, a chave histórica não foi preservada, ou a OS não tem valor, verifique manualmente no emissor; não presuma que a nota não foi emitida.
- Os testes usam somente respostas sintéticas. Homologue o contrato com o adaptador antes de configurar a consulta para operação real.

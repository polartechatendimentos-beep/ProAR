# Recebimentos dos clientes — Mercado Pago

Integração exclusiva dos recebimentos da empresa. A cobrança das mensalidades do SaaS usa o módulo anterior e não é alterada. Cada empresa conecta a própria conta recebedora; não há repasse automático entre ProAR, ProBarber ou barbeiros.

## Configuração

Em Financeiro → Receber com Mercado Pago, abra a conexão. Use uma aplicação da própria conta da empresa com **Checkout Pro via Preferences API**, preencha Access Token e assinatura secreta do webhook no formulário protegido e cadastre a URL exibida na configuração de notificações de **pagamentos** do Mercado Pago. Nunca envie credenciais pelo chat nem inclua no código.

Teste primeiro com credenciais de teste. Depois conecte as credenciais reais e marque produção. Contas, links e conciliação de teste e produção são separados. Um pagamento de teste não gera baixa financeira, estoque ou comissão reais.

## Uso

- ProAR: o valor vem do saldo do título a receber. Pagamento aprovado gera baixa idempotente e rastreável no razão, na conta BANK (Conta bancária). Se a conta foi desativada ou o saldo foi alterado, a aprovação permanece registrada e a baixa fica para conferência.
- ProBarber: abra o caixa, configure preços e comissão dos serviços. Atendimentos já iniciados, com preço conhecido e sem recebimento registrado ficam disponíveis. O link cobra os serviços da reserva; produtos extras/descontos continuam no fechamento presencial. Após aprovação real, a comanda é concluída, gera comissão e recibo. Caixa fechado, mudança de reserva ou outro conflito deixam a baixa para conferência, sem solicitar novo pagamento.
- Gere o link e compartilhe com o cliente. O checkout hospedado oferece os meios habilitados na conta Mercado Pago; a disponibilidade efetiva depende do provedor.
- Webhooks assinados consultam novamente o pagamento no provedor, verificando conta recebedora, ambiente, moeda BRL, referência e valor. O retorno do navegador não confirma pagamento.
- “Conferir pagamento” recupera o estado do provedor e repete apenas a baixa interna pendente. Notificações repetidas não geram nova baixa.
- Emissão incerta por timeout fica em conferência, evitando gerar outro checkout sem verificar o primeiro no Mercado Pago pela referência mostrada.
- Reembolso/contestação são sinalizados. A devolução bancária e o estorno contábil precisam de conferência gerencial; o sistema não executa transferência ou reembolso automaticamente.
- O valor conciliado é bruto. Taxas específicas do Mercado Pago devem ser conferidas no extrato do provedor e lançadas como despesa; não são inventadas nem tratadas como zero cobrado pelo provedor.

## Segurança e persistência

Credenciais cifradas com AES-GCM, vinculadas à empresa. Somente o servidor acessa o banco; o formulário nunca retorna tokens salvos. ProAR usa PROAR_TENANT_MASTER_KEY já adotada no isolamento empresarial. ProBarber usa PROBARBER_PAYMENT_KEY se configurada; na instalação existente usa a chave privada de serviço do projeto como origem da chave criptográfica. Antes de rotacionar essa chave, migre/reconecte as credenciais protegidas; não substitua uma chave existente arbitrariamente.

Sem credenciais configuradas, a interface permite configuração e não simula cobrança. Homologação desta entrega usa clientes sintéticos, APIs simuladas, rollback SQL e nenhuma cobrança real.

Documentação consultada: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/payment-notifications e https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-pro-preferences/overview

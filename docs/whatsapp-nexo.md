# WhatsApp multiempresa na Nexo

Servidor: `https://evolution.proarwapp.cloudservidor.com.br`.
A instância piloto existente é `proar-polartech`.

## Conexão de cada cliente

Em Configurações → WhatsApp, o administrador consulta a conexão e gera seu QR Code. O backend usa somente a empresa da sessão autenticada, valida o cadastro ativo e prepara uma instância determinística exclusiva. O cliente escaneia o QR Code com o número da própria empresa. O envio fica preparado automaticamente e pode ser pausado pelo administrador.

As credenciais de instância ficam criptografadas na base resolvida para cada empresa. A chave administrativa da Evolution permanece no servidor e não aparece nas respostas da API. Instâncias de outros clientes e bases não provisionadas são recusadas. Solicitações concorrentes usam a mesma identidade e não criam novas instâncias para a mesma empresa.

## Variáveis do servidor

- `PROAR_EVOLUTION_URL`: endereço HTTPS da Evolution, sem `/manager`.
- `PROAR_EVOLUTION_ADMIN_KEY`: segredo administrativo de provisionamento.
- `PROAR_TENANT_MASTER_KEY`: chave de criptografia já utilizada no ProAR.
- `PROAR_EVOLUTION_AUTOMATION_ENABLED=false`: bloqueio geral até homologação.
- `PROAR_EVOLUTION_COMPANY_ID`, `PROAR_EVOLUTION_INSTANCE` e `PROAR_EVOLUTION_API_KEY`: mapeamento opcional da instância piloto existente. Outros clientes não usam essas credenciais.

Configurar as variáveis de homologação somente para a branch `feat/proar-whatsapp-web`. Não compartilhar segredos com branches não revisadas.

## Envios agendados

O cron `/api/cron/whatsapp` está programado a cada cinco minutos. Processa somente empresas ativas com envios habilitados e conexão aberta. Cada lembrete agendado recebe um registro de tentativa único por empresa, identificador e data. A reserva é persistida antes de enviar, impedindo que duas execuções do worker enviem a mesma tarefa. Falhas sem confirmação não são reenviadas automaticamente; devem ser conferidas no WhatsApp.

O histórico distingue aceitação pelo servidor, processamento e resultado desconhecido. Aceitação não comprova entrega. Ele não armazena o corpo da mensagem e mostra o destinatário mascarado. O worker não sobrescreve o cadastro de lembretes nem outros dados operacionais. O histórico de envios é a fonte do estado da tentativa.

A execução tem orçamento de tempo, cursor persistente entre empresas, até cinco mensagens por empresa e vinte por rodada. Clientes seguintes continuam nas próximas rodadas. O fluxo legado Meta do cron de licitações não processa lembretes Evolution em paralelo. Os alertas de licitação existentes continuam limitados à empresa piloto; não são replicados automaticamente para outros clientes.

## Homologação e capacidade

1. Confirmar publicação da branch e variáveis restritas ao Preview.
2. Confirmar a conexão da PolarTech e de uma segunda empresa de teste já autorizada, verificando isolamento de QR, credenciais e histórico.
3. Testar envio para número escolhido pelo operador, desconexão e reconexão.
4. Validar reserva atômica de tentativas no provedor real de banco.
5. Conferir a capacidade da VPS antes de ampliar o número de clientes conectados. O plano atual tem 1 vCore e 2 GB de RAM; o código não aumenta o plano automaticamente.
6. Ativar o bloqueio geral somente após homologação; publicar produção somente com a versão validada.

Esta etapa não incorpora caixa de entrada, webhooks de recebimento nem atendimento por IA. Esses recursos exigem integração com o CRM e validação de eventos reais.

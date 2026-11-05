# ProAR — WhatsApp híbrido (desenvolvimento)

## Motores independentes
- **Meta Cloud API (PR #171)**: canal oficial, preferencial para mensagens empresariais autorizadas.
- **Evolution API**: opção não oficial baseada em WhatsApp Web, com consentimento e ativação explícitos por empresa. Não realizar fallback automático do canal oficial para o não oficial.
- **wa.me**: envio manual, não confirmar entrega automaticamente.

## Operação Evolution
Hospedar Evolution em serviço persistente com HTTPS e rede protegida, separado do Vercel. Usar armazenamento persistente e banco/Redis conforme a versão da Evolution escolhida. Não expor API key ao navegador; configurar por empresa em cofre criptografado. Nunca colocar chaves no repositório ou em docker-compose público.

Fluxo: usuário autorizado inicia pareamento -> backend consulta a Evolution -> frontend apresenta QR vivo com expiração -> backend consulta estado -> sessão conectada. O QR é temporário e não deve ser armazenado em logs. Não usar imagem estática.

## Gate de homologação
1. Testar conexão e expiração/reemissão do QR com instância real em ambiente isolado.
2. Confirmar isolamento de empresa e RBAC para leitura de estado/QR.
3. Simular falhas de rede, desconexão, bloqueio e reconexão.
4. Testar fila, idempotência, opt-out, limites e consentimento.
5. Testar webhooks autenticados, assinaturas e deduplicação antes de registrar entrega/leitura.
6. Validar credenciais Meta separadamente e confirmar templates aprovados.
7. Não enviar para clientes reais nem publicar em produção antes da aprovação expressa.

## Riscos
Evolution/Baileys não são a Cloud API oficial da Meta; podem desconectar ou sofrer restrições. Não prometer conexão permanente, pareamento em prazo fixo ou entrega garantida. Não compartilhar sessão WhatsApp entre tenants.

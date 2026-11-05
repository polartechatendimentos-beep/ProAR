# Provisionamento do motor Evolution (fora da Vercel)

Este arquivo é um roteiro operacional, não uma instalação ativa.

## Infraestrutura necessária
- VPS ou serviço de contêiner **persistente**, com domínio e TLS (HTTPS).
- Evolution API em versão estável fixada por digest de imagem após validação; Postgres/Redis e volume persistente conforme documentação da versão selecionada.
- API não exposta publicamente sem proxy autenticado, firewall e limitação de taxa.
- Backups criptografados e monitoramento de disponibilidade; não armazenar tokens, QR ou sessões em logs.

## Variáveis no ProAR (Vercel, segredos do servidor)
Configure no ambiente de homologação, sem publicar valores:
- `PROAR_EVOLUTION_COMPANY_ID`: ID da empresa autorizada para o piloto.
- `PROAR_EVOLUTION_URL`: URL HTTPS da API Evolution.
- `PROAR_EVOLUTION_INSTANCE`: nome da instância exclusiva.
- `PROAR_EVOLUTION_API_KEY`: chave de acesso longa, exclusiva do piloto.

## Validação de ponta a ponta
1. Subir o motor persistente e confirmar que o endpoint de estado responde somente com autenticação.
2. Abrir `/whatsapp/conectar` no preview autenticado como administrador da empresa piloto.
3. Gerar QR temporário e escanear em **Aparelhos conectados** com um número de teste autorizado.
4. Confirmar estado `open`, reiniciar o contêiner e verificar persistência.
5. Validar expiração, reemissão de QR, reconexão, perda de rede e isolamento por empresa.
6. Antes de habilitar envio: implementar filas, webhooks autenticados, auditoria, opt-out e testes de mensagens autorizadas.
7. Aprovar manualmente a homologação e liberar produção somente depois.

**Atenção:** Baileys/Evolution utilizam WhatsApp Web não oficial e podem sofrer bloqueios ou desconexões. O PR #171 (Cloud API oficial) permanece como canal independente.

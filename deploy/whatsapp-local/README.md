# WhatsApp local gratuito — ProAR

Esta alternativa usa o computador da PolarTech como servidor. Não requer contratar VPS, mas o computador deve permanecer ligado, com Docker Desktop e internet. Evolution é integração **não oficial**; não há garantia de disponibilidade ou de ausência de bloqueios.

## Iniciar
1. Instalar Docker Desktop no computador autorizado.
2. Na pasta `deploy/whatsapp-local`, copiar `.env.example` para `.env`.
3. Gerar uma chave segura (`openssl rand -hex 32`) e uma senha forte para PostgreSQL. Não compartilhar segredos no chat nem commitar `.env`.
4. Revisar a tag da imagem e as variáveis com a documentação da versão Evolution escolhida.
5. Rodar `docker compose config`, `docker compose up -d` e `docker compose ps`.
6. Validar localmente `http://localhost:8080` e criar uma instância exclusiva de teste.

## Limite importante de rede
O ProAR hospedado na Vercel **não pode acessar** `http://localhost:8080` no computador da empresa. Não preencher `PROAR_EVOLUTION_URL` com localhost: isso não funciona remotamente.

Para conectar o ProAR na nuvem ao serviço local sem contratar servidor, ainda será necessário um canal de saída seguro (por exemplo, um agente local que consulte uma fila no ProAR), com autenticação mútua, segregação por empresa, controle de concorrência, logs e deduplicação. **Esse agente ainda não foi implementado.** Não expor portas do roteador nem usar túneis públicos sem autenticação.

## Estado da solução
- Stack local com PostgreSQL, Redis e volumes: preparada.
- Página QR e consulta de status no PR #172: preparadas para um serviço Evolution HTTPS acessível.
- Agente local, fila de mensagens, recebimento de eventos, pareamento real e testes E2E: pendentes.
- Não enviar mensagens reais antes de opt-in explícito e homologação.

Nenhuma mudança em produção é feita por esta documentação.

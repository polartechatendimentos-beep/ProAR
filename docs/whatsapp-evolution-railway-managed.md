# Evolution API gerenciada para ProAR — plano Railway

Status: **somente preparação**. Não provisionar, conectar número real ou habilitar disparos sem aprovação e testes.

## Provedor escolhido para piloto
Railway, com três serviços privados no mesmo projeto: Evolution API, PostgreSQL e Redis. Configurar um volume persistente na Evolution em `/evolution/instances` (confirmar diretório com a versão fixada). Postgres e Redis não devem receber domínio público.

Usar imagem `evoapicloud/evolution-api:v2.3.6` apenas após revisão de compatibilidade e segurança. **Nunca usar :latest em produção.** Referência de template: https://railway.com/deploy/evolution-api-236-with-redis-and-postgresql--evolution-api-236-with-redis-and-postgre

## Variáveis do serviço Evolution (segredos configurados no painel Railway)
```dotenv
PORT=8080
SERVER_URL=https://SEU_DOMINIO_HTTPS
AUTHENTICATION_API_KEY=GERAR_SEGREDO_ALEATORIO_DE_64_CARACTERES
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=REFERENCIA_PRIVADA_DO_POSTGRES
CACHE_REDIS_ENABLED=true
CACHE_REDIS_URI=REFERENCIA_PRIVADA_DO_REDIS
```
Conferir variáveis específicas na documentação da versão selecionada. Não colocar valores reais no GitHub, logs, browser ou mensagens.

## Variáveis server-side no ProAR (ambiente Preview da Vercel)
```dotenv
PROAR_EVOLUTION_URL=https://SEU_DOMINIO_HTTPS
PROAR_EVOLUTION_INSTANCE=polartech_homolog
PROAR_EVOLUTION_API_KEY=MESMO_SEGREDO_DO_RAILWAY
PROAR_EVOLUTION_COMPANY_ID=ID_INTERNO_DA_EMPRESA_PILOTO
```
A integração existente no PR #172 é limitada a uma empresa piloto. Não habilitar multiempresa antes de cofre por tenant e isolamento de instâncias.

## Sequência de homologação
1. Validar orçamento, aprovar contratação e criar projeto Railway.
2. Provisionar PostgreSQL e Redis com rede privada e backups.
3. Implantar Evolution fixada em versão revisada, com volume persistente, TLS e chave forte.
4. Criar instância exclusiva `polartech_homolog` pelo backend autorizado; nunca gerar QR estático.
5. Configurar variáveis Preview da Vercel e testar `/whatsapp/conectar` com login no mesmo domínio.
6. Parear número de teste pelo WhatsApp > Aparelhos conectados; confirmar estado `open`.
7. Reiniciar serviço e validar reconexão, expiração QR, isolamento e limites de envio.
8. Implementar fila durável, deduplicação transacional, opt-in/opt-out, webhook autenticado e histórico.
9. Testar mensagens autorizadas com números de teste; validar falhas e observabilidade.
10. Somente após homologação explícita promover para produção.

## Observações
Evolution/Baileys usa protocolo não oficial de WhatsApp Web; pode desconectar ou sofrer restrições. Não substituir a Meta Cloud API do PR #171. Não habilitar envio em massa nem prometer disponibilidade contínua.

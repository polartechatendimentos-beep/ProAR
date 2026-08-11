# ProAR Manager + Trial 7 dias

## Novos endereços
- `/teste`: cadastro público para teste gratuito.
- `/manager`: painel administrativo TAV's (exige sessão Administrador do ProAR).
- `/?tenant=<slug>`: acesso ao ambiente da empresa criada no trial.

## Fluxo
1. Cliente informa CPF/CNPJ e dados padrão da empresa.
2. O banco mestre valida duplicidade e cria licença `trial` por 7 dias.
3. É criado o usuário `admin` com senha temporária forte (ou a senha definida em `PROAR_TRIAL_DEFAULT_PASSWORD`).
4. Com `SUPABASE_MANAGEMENT_TOKEN` e `SUPABASE_ORGANIZATION_SLUG`, o backend solicita um projeto Supabase dedicado para o tenant e inicializa a estrutura operacional.
5. A URL e a credencial de servidor do tenant são guardadas no banco mestre; o segredo é criptografado com AES-256-GCM usando `PROAR_TENANT_MASTER_KEY`.
6. As rotas de estado e obras resolvem o banco dedicado a partir da sessão. Se o provisionamento ainda estiver manual, o sistema mantém o modo legado isolado logicamente até a infraestrutura ser configurada.

## Migração obrigatória no banco mestre
Aplicar `supabase/migrations/20260811_proar_manager_trials.sql`.

## DNS
Criar `teste.proar.app` apontando para a implantação Vercel do ProAR. O mesmo código atende `/teste`. Para uma experiência ainda mais limpa, configure um redirect do host `teste.proar.app` para `/teste` no Vercel ou middleware.

## Segurança
- Não exponha `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_MANAGEMENT_TOKEN` ou `PROAR_TENANT_MASTER_KEY` no navegador.
- Não use `admin/admin` em produção. A implementação gera senha temporária por padrão.
- O vencimento do trial é validado no servidor.
- CPF/CNPJ já usados não podem iniciar novo trial automaticamente.

## Separação do Gerencial
O Gerenciador Multiempresa foi removido da navegação/configurações do ProAR operacional. Use exclusivamente `/manager` (recomendado em `manager.proar.app`). O domínio `teste.proar.app` abre o cadastro público do trial e o operacional continua separado.

### Domínios recomendados
- `app.proar.app` ou domínio atual: ProAR operacional
- `teste.proar.app`: cadastro de teste por 7 dias
- `manager.proar.app`: ProAR Manager restrito à TAV's

## Subdomínio automático por empresa

A versão atual usa o padrão `nomefantasia.proar.app`. O tenant é resolvido automaticamente pelo hostname; `?tenant=` permanece apenas como compatibilidade de desenvolvimento/legado. Para produção, configure `*.proar.app` como domínio wildcard no Vercel e `PROAR_ROOT_DOMAIN=proar.app`.

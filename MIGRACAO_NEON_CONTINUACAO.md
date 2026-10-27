# ProAR: continuação da migração do banco principal para Neon

## Estado verificado em 28/09/2026

- A branch `release/proar-production-20260921` recebeu seis commits do Manus até `23f7ef6`. Eles instalaram `@neondatabase/serverless` e iniciaram a adaptação das rotas de autenticação, estado e licitações.
- A importação anterior da base principal para a integração Neon `proar-polartech-db` foi conferida com as sete tabelas `proar_*` e a quantidade de registros da cópia de origem. O estado operacional da PolarTech contém 325 clientes, 2 produtos, 147 casas no mapa e 1 obra.
- Esta continuação corrige a escolha do banco para `polartech-principal`, as rotas que ainda requisitavam a API REST do Supabase, o armazenamento de JSONB e os filtros usados na gravação otimista do estado. Conexões Supabase de empresas dedicadas continuam endereçadas pelo `api_url` próprio.
- `npm run typecheck` e `npm run build -- --webpack` concluíram sem erros. `npm test` não contém testes cadastrados neste repositório.

## Configuração necessária na Vercel

O projeto `pro_ar` na equipe `tav-s` já recebeu da integração Neon a variável `PROAR_NEON_DATABASE_URL`. Confirme que ela existe no ambiente **Production** e se refere ao banco `proar-polartech-db`. Depois de publicar este código, configure `PROAR_DATABASE_PROVIDER=neon` em **Production**, faça uma nova implantação e valide os dados antes de remover qualquer conexão antiga. O ambiente Preview já tinha essa chave de seleção definida na etapa anterior.

Não coloque a string de conexão em `NEXT_PUBLIC_*` nem no HTML. Ela deve ficar apenas nas variáveis do servidor da Vercel.

## Conferência pós-implantação

1. Faça login em `polartech.proar.online` com uma conta existente.
2. Confira a carteira de clientes, o catálogo de produtos e as obras em andamento; o aplicativo lê o estado `polartech-principal` e as chaves legadas sem migrar nem apagar os registros.
3. Confira a leitura de `/api/work-projects` e os mapas de obra publicados.
4. Faça uma alteração pequena e autorizada, recarregue a página e confirme que a revisão e o registro permanecem. Se houver conflito de revisão, o endpoint devolve HTTP 409 com o estado atual.
5. Observe os logs de execução da implantação para falhas SQL ou de conexão antes de considerar a troca concluída.

## Pendências de acesso nesta sessão

O conector Vercel retornou 403 para a equipe `tav-s` (`Not authorized ... re-authenticate to this scope`). O envio anterior para o repositório privado `polartechatendimentos-beep/ProAR` foi rejeitado pela revisão automática de aprovação. Por isso esta continuação foi preparada e validada localmente; a produção ainda não foi alterada por esta sessão.

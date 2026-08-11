# Implementação — ProAR Manager + Trial 7 dias

## Entregue
- ProAR Manager separado em `/manager`.
- Cadastro público de trial em `/teste`, preparado para o domínio `teste.proar.app`.
- `proxy.ts` do Next.js 16 reescreve `teste.proar.app/` para `/teste`.
- Cadastro padrão de empresa com PF/PJ, CPF/CNPJ, razão social, fantasia, responsável, contatos, endereço, inscrições, tipo de empresa, regime tributário e segmento.
- Validação matemática de CPF/CNPJ e bloqueio de novo trial para documento já cadastrado.
- Trial controlado no servidor por 7 dias.
- Usuário padrão `admin` com senha temporária forte; troca obrigatória no primeiro acesso.
- Opção de dados demonstrativos.
- Identidade/configuração da empresa carregada pelo tenant.
- Sessão do trial contém `companyId`/`companySlug`, impedindo seleção acidental de outra empresa.
- Módulos liberados são carregados do cadastro da empresa.
- ProAR Manager permite bloquear/desbloquear, prorrogar 7 dias, converter plano e abrir o ambiente.
- Auditoria administrativa no banco mestre.
- Arquitetura de banco dedicado por empresa com Supabase Management API.
- Credenciais dos bancos dos tenants criptografadas com AES-256-GCM no banco mestre.
- Rotas principais de estado e obras resolvem automaticamente o banco dedicado do tenant.
- Se as credenciais de provisionamento não estiverem configuradas, o tenant fica marcado como `manual`, sem fingir que o banco exclusivo foi criado.
- Se o projeto Supabase ainda estiver subindo, o status fica `creating` e o Manager possui ação `Finalizar banco`.

## Variáveis novas
Consulte `.env.example`.

## Migração obrigatória
Aplicar `supabase/migrations/20260811_proar_manager_trials.sql` no banco mestre antes de liberar `/teste`.

## Vercel / DNS
Adicionar o domínio `teste.proar.app` ao mesmo projeto ou a uma implantação de homologação e configurar o DNS indicado pelo Vercel.

## Observação de build
Os arquivos TS/TSX novos e alterados foram verificados pelo compilador TypeScript em modo de transpile e não apresentaram erros de sintaxe. O `next build` completo não foi executado porque o projeto enviado não contém `node_modules` e a instalação das dependências excedeu o limite de execução deste ambiente.

## Endurecimentos adicionais
- Senhas de trial e troca de senha agora usam `scrypt` com salt individual; hashes SHA-256 antigos continuam aceitos apenas para migração automática no próximo login.
- Tenant com banco dedicado ainda não `ready` não cai no banco mestre: o acesso operacional retorna indisponível até o provisionamento terminar.
- Falha ao criar o administrador remove o cadastro parcial da empresa para não consumir o trial indevidamente.
- Bloqueio de novo trial também considera e-mail e telefone, além de CPF/CNPJ.
- Rate limit persistente de até 5 tentativas/24h por origem, armazenando hash do IP em vez do endereço puro.
- Honeypot anti-bot e suporte opcional a Cloudflare Turnstile.
- Páginas de Termos de Uso e Política de Privacidade adicionadas.

# ProAR - Sistema Integrado de Climatização, Obras & Licitações

O ProAR é uma aplicação **Next.js 15 com App Router**, integrada ao PostgreSQL/Vercel Postgres, Drizzle ORM e Tailwind CSS. Este documento contém apenas o fluxo operacional atual; relatórios e históricos devem permanecer em `docs/` quando forem organizados em uma etapa posterior.

## Requisitos

- Node.js 22.x
- npm
- Acesso às variáveis de ambiente do ambiente correspondente

## Desenvolvimento local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Nunca versione arquivos `.env*`, certificados, senhas ou tokens. Preencha as variáveis usando valores de desenvolvimento ou um ambiente seguro.

## Verificações

```bash
npm run typecheck
npm run lint
npm run build
```

O script `test` atualmente executa a verificação TypeScript. Testes de regras de negócio devem ser adicionados gradualmente sem conexão com dados de produção.

## Banco de dados

O acesso relacional principal utiliza Drizzle ORM. Antes de executar qualquer comando que altere schema, confirme a conexão e o ambiente do banco:

```bash
npm run db:generate
npm run db:push
```

`db:push` não deve ser executado contra produção sem revisão, backup e aprovação explícita. Esta documentação não executa migrações nem altera registros.

## Variáveis de ambiente principais

Consulte `.env.example` para a lista atual, incluindo:

- conexão PostgreSQL/Vercel Postgres;
- `JWT_SECRET` e demais segredos de autenticação;
- `CRON_SECRET` para rotas agendadas;
- credenciais de integrações externas.

Segredos reais devem ser configurados no provedor de hospedagem, não no repositório.

## Deploy

O projeto usa o build padrão do Next.js:

```bash
npm run build
npm run start
```

Na Vercel, configure as variáveis de ambiente por ambiente e confirme que os comandos de build e Node.js estão alinhados com o `package.json`. Alterações de schema, cron e integrações externas devem ser validadas em preview antes da produção.

## Áreas funcionais

- Gestão operacional de obras e diários de bordo;
- Ordens de serviço e relatórios PMOC;
- Cálculo de deslocamento técnico regional;
- Radar de licitações e PNCP;
- Multi-tenancy e autenticação;
- Consulta automática de CNPJ;
- Integrações de WhatsApp e documentos.

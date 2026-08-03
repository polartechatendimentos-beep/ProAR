# ProAR - Sistema Autônomo de Licitações e Gestão Fiscal

O **ProAR** é uma solução completa em **Next.js (App Router)** integrada com **Vercel Postgres** e **Drizzle ORM** para monitoramento de licitações, integração com WhatsApp e configurações fiscais.

---

## 🚀 Principais Correções e Melhorias

1. **Unificação do Framework:** Removido conflito de build entre Vite e Next.js. O projeto utiliza puramente **Next.js 15 App Router** para frontend e backend (API Routes).
2. **Banco de Dados no Vercel (Vercel Postgres / Neon):**
   - Configurado **Drizzle ORM** nativo com `@vercel/postgres`.
   - Schemas PostgreSQL atualizados e otimizados (`db/schema.ts`).
   - Conexão configurada em `db/index.ts`.
3. **Cron Job Integrado:** `vercel.json` configurado para executar a rotina de busca de licitações periodicamente.
4. **Interface Moderna:** UI responsiva construída com Tailwind CSS e Lucide React.

---

## 🛠️ Passo a Passo para Implantação na Vercel

### 1. Criar Repositório e Conectar à Vercel
1. Envie estes arquivos para um repositório no GitHub/GitLab.
2. Acesse o dashboard da [Vercel](https://vercel.com) e importe o projeto.

### 2. Adicionar o Vercel Postgres
1. No dashboard do seu projeto na Vercel, vá em **Storage** > **Create Database** > **Postgres**.
2. Siga as instruções e conecte o banco de dados ao seu projeto.
3. As variáveis de ambiente (`POSTGRES_URL`, `POSTGRES_HOST`, etc.) serão adicionadas automaticamente.

### 3. Executar as Migrações do Banco de Dados
No seu terminal local (ou via Vercel CLI), execute:
```bash
npm install
npx drizzle-kit push
```
Isso criará automaticamente todas as tabelas (`licitacoes`, `fiscal_config`, `whatsapp_settings`, `system_state`, `users`) no Vercel Postgres.

### 4. Configurar Variáveis de Ambiente
Em **Settings** > **Environment Variables** na Vercel, defina:
- `CRON_SECRET`: Token para proteger a rota de Cron (`/api/cron/licitacoes`).
- `WHATSAPP_API_TOKEN`: Chave de API da sua integração do WhatsApp.
- `WHATSAPP_PHONE_NUMBER_ID`: ID do número de WhatsApp.

---

## 💻 Estrutura do Projeto

```
ProAR/
├── app/
│   ├── api/             # API Routes (Licitações, Fiscal, WhatsApp, Cron)
│   ├── globals.css      # Estilos Tailwind CSS
│   ├── layout.tsx       # Layout principal
│   └── page.tsx         # Dashboard interativo
├── db/
│   ├── index.ts         # Inicialização da conexão Drizzle + Vercel Postgres
│   └── schema.ts        # Schemas do banco de dados PostgreSQL
├── lib/
│   ├── proar-auth.ts    # Funções de Autenticação
│   └── proar-whatsapp.ts# Funções do serviço de WhatsApp
├── drizzle.config.ts    # Configuração do Drizzle Kit
├── next.config.ts       # Configuração do Next.js
├── vercel.json          # Configuração de Cron Jobs da Vercel
└── package.json         # Dependências do projeto
```

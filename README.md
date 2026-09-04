# ProAR - Sistema Integrado de Climatização, Obras & Licitações
## ProAR Climatização & Engenharia Térmica | Matriz Mirassol/SP

O **ProAR** é uma solução corporativa completa desenvolvida em **Next.js 15 (App Router)** integrada com **PostgreSQL / Vercel Postgres**, **Drizzle ORM** e **Tailwind CSS**.

---

### 🚀 Funcionalidades Principais

1. **Gestão Operacional de Obras & Diário de Bordo (`/api/work-projects`, `/obra/[token]`):**
   - Acompanhamento de avanço físico de obras e contratos de climatização.
   - Portal público exclusivo para fiscais de prefeituras e clientes com token seguro.
   - Diário de bordo, controle de ocorrências e vistorias de não conformidade com fotos.
   - Medições de materiais (tubulação de cobre, recargas de gás R410A/R22, suportes e cabos).

2. **Ordens de Serviço & Relatórios Fotográficos PMOC (`/api/relatorios`):**
   - Check-in e check-out de equipes técnicas com carimbo de data/hora.
   - Checklist digital de higienização conforme Lei Federal 13.589/2018 e ANVISA RE nº 9.
   - Registro de fotos "Antes" e "Depois" da higienização e manutenção preventiva.
   - Coleta de assinatura digital do técnico credenciado e do cliente/fiscal.

3. **Cálculo de Deslocamento Técnico Regional (`lib/municipality-distances.ts`):**
   - Matriz completa de distâncias rodoviárias a partir de Mirassol/SP e São José do Rio Preto para mais de 50 cidades do interior paulista.
   - Cálculo automático de KM total e taxa de deslocamento para orçamentos rápidos.

4. **Radar de Licitações & PNCP (`/api/licitacoes`, `/api/cron/licitacoes`):**
   - Varredura autônoma de pregões e dispensas no Portal Nacional de Contratações Públicas.
   - Filtros inteligentes especializados em climatização, PMOC, refrigeração e chillers.
   - Cron Job protegido com segredo `CRON_SECRET`.

5. **Segurança Avançada e Multi-tenancy (`lib/proar-auth.ts`, `lib/company-access.ts`):**
   - Autenticação com tokens JWT assinados criptograficamente via HMAC-SHA256.
   - Hashes de senha com salt seguro via PBKDF2 (SHA-512).
   - Isolamento estrito de dados por empresa (`assertCompanyAccess`).
   - Proteção de rotas de anexos com validação de tipo MIME e limite de 10MB.

6. **Consulta Automática de CNPJ (`/api/cnpj/[cnpj]`):**
   - Consulta ágil com sanitização e integração com bases da BrasilAPI e ReceitaWS.

---

### 🛠️ Configuração e Execução

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env

# 3. Aplicar as migrações no banco de dados (Drizzle ORM)
npx drizzle-kit push

# 4. Iniciar em modo de desenvolvimento
npm run dev

# 5. Executar build de produção
npm run build
```

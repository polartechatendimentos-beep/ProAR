# ProAR Manager — Login separado

- `manager.proar.online` agora é reservado integralmente ao ProAR Manager.
- Qualquer rota de interface nesse host é reescrita para `/manager`, impedindo abertura acidental do ERP operacional.
- Login do Manager é independente do login das empresas.
- Credenciais padrão solicitadas: usuário `admin`, senha `232325`.
- As credenciais podem e devem ser sobrescritas no Vercel por `PROAR_MANAGER_USER` e `PROAR_MANAGER_PASSWORD`.
- A sessão usa cookie HttpOnly, SameSite Strict e assinatura HMAC.
- O endpoint `/api/manager/companies` agora aceita exclusivamente a sessão do Manager; uma sessão de Administrador do ERP não libera o Manager.
- Nenhum dado de empresa ou banco operacional foi removido.

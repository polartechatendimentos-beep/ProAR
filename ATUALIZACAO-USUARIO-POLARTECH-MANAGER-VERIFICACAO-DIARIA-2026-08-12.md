# ProAR — usuário PolarTech, cadastro automático no Manager e verificação diária

Alteração incremental e não destrutiva.

## PolarTech
- CNPJ principal configurado no cliente padrão: 45.823.828/0001-88.
- O processo diário garante a empresa `polartech` no ProAR Manager sem duplicar cadastro existente por slug/CNPJ.
- Usuário operacional garantido no banco de usuários da PolarTech:
  - usuário: `Tiago.Viana` (login não diferencia maiúsculas/minúsculas)
  - senha inicial configurável por `PROAR_POLARTECH_TIAGO_PASSWORD` (valor solicitado: `289936`)
  - perfil: Administrador
  - permissões: todas

## Cadastro automático de empresas no Manager
- Uma empresa autenticada com CNPJ válido envia heartbeat para `/api/companies`.
- O backend busca primeiro o CNPJ já existente e atualiza o mesmo cadastro, evitando duplicidade.
- São gravados `auto_registered` e `last_seen_at`.
- O heartbeat ocorre ao entrar e a cada 6 horas enquanto o sistema estiver aberto e online.

## Verificação de liberação
- `/api/auth` agora revalida no banco mestre se o tenant segue ativo e dentro do período de trial.
- O front-end revalida o acesso a cada hora e sempre que a janela volta ao foco.
- Se o Manager bloquear a empresa, a sessão é encerrada na próxima validação online.

## Rotina diária
- Vercel Cron: `/api/cron/manager-daily-check`, diariamente às 08:15 UTC (05:15 America/Sao_Paulo).
- Garante cadastro da PolarTech e o usuário Tiago Viana.
- Varre empresas do Manager.
- Bloqueia trials vencidos.
- Atualiza `last_manager_check_at`.
- Registra auditoria `DAILY_COMPANY_ACCESS_CHECK`.

## Migração
Aplicar `supabase/migrations/20260812_manager_daily_access.sql` no banco mestre.

## Variáveis Vercel
- `CRON_SECRET`
- `PROAR_PRIMARY_COMPANY_ID=polartech-principal`
- `PROAR_POLARTECH_CNPJ=45823828000188`
- `PROAR_POLARTECH_TIAGO_PASSWORD=289936`

Por segurança, recomenda-se trocar a senha inicial após o primeiro acesso e manter o valor real apenas nas variáveis protegidas do Vercel.

# ProAR — revisão de segurança (2026-11-14 UTC)

## Escopo e limites

Revisão do código e dependências, testes automatizados e requisições HTTP de baixo impacto em `polartech.proar.online`. Sem brute force, exploração destrutiva, alteração de registros operacionais, envio de mensagens ou leitura de segredos. Não equivale a um pentest completo nem garante proteção contra qualquer ataque.

Base revisada: produção `a21d9757f2f640e0280eff6ce7b97896e2d486aa`.

## Achados e correções desta revisão

| Item | Evidência | Correção |
| --- | --- | --- |
| Credencial administrativa compartilhada de contingência | Fallback de senha no código quando variável de ambiente ausente; configuração de senha presente em produção e preview, verificada somente por metadados | Fallback removido; ausência de configuração nega autenticação |
| Dependências de produção com alertas conhecidos | npm audit --omit=dev: 13 pacotes sinalizados, 3 críticos e 10 altos; contagens incluem cadeias transitivas, sem comprovar exploração | Next 16.4.6, jsPDF 4.2.1, Blob 2.9.0, atualizações transitivas e override Zod 4.6.7+; resultado final: 0 alertas conhecidos |
| Dependência de desenvolvimento React Server DOM com alerta crítico | Auditoria completa detectou versão 19.2.6 | React, React DOM e React Server DOM Webpack alinhados em 19.2.9; Vite em 8.3.8; auditoria completa sem alertas críticos |
| Proteções adicionais nos fluxos de autenticação | Login/recuperação não tinham validação explícita compartilhada de origem e tamanho | Origem exata quando enviada, rejeição Sec-Fetch-Site cross-site, JSON objeto, limite de 8 KiB medido no stream e limites por campo; códigos 400/403/413/415 |
| Robustez dos cookies de sessão | Parser tolerava segmentos excedentes/expiração não numérica e assinatura Unicode podia provocar exceção no manager | Estrutura e expiração estritas, tamanhos limitados, assinatura administrativa válida e usuário correspondente; conta legada inativa rejeitada |
| Cache de APIs | Resposta 401 de /api/state apresentava política public | Cabeçalho private/no-store para /api/:path* |
| Recorrência de dependências vulneráveis | Pipeline não tinha auditoria de dependências de produção | Etapa npm audit --omit=dev --audit-level=high no CI |

## Verificações públicas na versão base

| Recurso sem autenticação | HTTP observado |
| --- | --- |
| /api/state | 401 |
| /api/atendimento | 403 |
| /api/bidding-documents | 401 |
| /api/manager/companies | 403 |
| /.env | 404 |
| /.git/config | 404 |

Página inicial 200. HSTS, CSP, X-Frame-Options DENY, nosniff e Referrer-Policy presentes. Isso comprova apenas o comportamento das URLs consultadas, não a ausência de outras exposições.

## Riscos e validações pendentes

1. Firewall e proteção contra tentativas repetidas: a conexão Vercel negou acesso à configuração e ao status de ataques; CLI não disponível. Não foi possível confirmar/ajustar rate limits. Reautorizar a conexão com acesso ao firewall, revisar tráfego e implantar limites graduais de POST por IP para login, manager, recuperação e reset; preservar usuários que compartilham IP. Não foi implantado um contador apenas em memória que aparentasse proteção distribuída.
2. MFA no manager e revogação imediata de sessões após troca de senha/inativação precisam de implementação específica. Cookies assinados têm validade; esta revisão não implementa um registro central de revogação.
3. Recuperação de senha atualiza senha e marca token usado em duas operações. Planejar consumo atômico/transação e teste concorrente em homologação.
4. Teste autenticado A/B de isolamento multiempresa, uploads maliciosos, autorizações por função, SQLi/SSRF, integrações e restauração de backup não foi executado ponta a ponta nesta revisão. Testes de domínio existentes ajudam, mas não substituem essas validações em ambiente controlado.
5. CSP ainda permite scripts inline; migrar para nonces requer validar Next, pagamentos, OCR e relatórios. Não foi endurecida cegamente.
6. Auditoria completa ainda informa 21 pacotes de ferramentas de desenvolvimento/transitivos (6 altos, 15 moderados, zero críticos), principalmente a cadeia alternativa Vinext/Cloudflare, Drizzle Kit e ferramentas de lint. Exigem atualização/homologação própria; não estão nos resultados de dependências de produção. Não expor servidores de desenvolvimento publicamente.
7. Não houve investigação forense; não se pode concluir se houve invasão anterior a partir destas verificações.

## Validação

Os resultados finais do pipeline e implantação ficam registrados no pull request desta revisão. Os novos testes cobrem origem, JSON inválido, limites em bytes sem Content-Length, campos não textuais, ausência de senha administrativa configurada, adulteração de sessão, expiração inválida e assinatura Unicode. Preservados os testes operacionais existentes.

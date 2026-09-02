# Atualizações de Produção — ProAR

Este arquivo é o registro oficial de cada publicação em produção.

## Regra de atualização

Antes de concluir qualquer deploy, registrar:

- data e hora;
- commit publicado;
- ambiente e status do deploy;
- lista objetiva das melhorias/correções aplicadas;
- migrações executadas;
- validações realizadas;
- pendências que **não** entraram naquele deploy.

Nenhuma melhoria deve ser marcada como publicada sem confirmação de deploy **Ready**.

---

## Última atualização em produção

**Data:** 02/09/2026
**Commit:** `cd2ac4f` — `Alterações 02/09/2026`
**Ambiente:** Produção — Vercel / projeto `pro_ar`
**Status:** Ready
**Branch:** `main`

### Aplicado

- Correções operacionais consolidadas enviadas para a branch principal.
- Ajustes de Obras, incluindo a fonte única para normalização e cálculo de progresso.
- Estrutura de credencial central de IA e leitura assistida de etiquetas.
- Ajustes de baixa parcial do Financeiro e comportamento do PDV.
- Base fiscal e configurações de certificado digital já presentes no projeto.
- Integração Git da Vercel reconectada ao repositório `polartechatendimentos-beep/ProAR`.

### Validação

- Deploy da Vercel concluído como **Ready**.
- Domínios `proar.online` e `*.proar.online` com configuração válida no projeto.

### Não incluído nesta publicação

- Lote local `2b2b99b` — fundação de anexos, auditoria, contatos de obra, alterações de medidas e consumos por etapa. A migração SQL foi executada no Supabase em 02/09/2026; ainda faltam a integração das telas e a nova publicação do código.

---

## Publicação validada — 02/09/2026

**Commit:** `4c4a32f` — `fix: ajusta monitor de licitações para build`  
**Ambiente:** Produção — Vercel / projeto `pro_ar`  
**Status:** Ready  
**Branch:** `main`

### Aplicado

- Correção das exportações inválidas nas rotas de Licitações e monitor automático.
- Restauração do repositório operacional utilizado pelas APIs de auditoria, alterações de medidas e contatos de obra.
- Correção da compilação de produção com Webpack.
- Remoção local da rota malformada de alterações de obra; a limpeza do arquivo remoto será incluída no próximo lote validado.

### Validação

- `npm run typecheck` concluído sem erros.
- `npm run build` concluído sem erros.
- Deploy `FWFgkTQaZXDT55ajUE7wvBuTZ8di` confirmado como **Ready** pela Vercel.

### Dados e migrações

- Nenhum dado de clientes, OS, financeiro, estoque, fotos ou histórico foi apagado.
- As tabelas relacionais e RLS previamente aplicados no Supabase foram preservados.

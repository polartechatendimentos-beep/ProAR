# Governança de Releases do ProAR

## Regra principal

Nenhuma melhoria nova é liberada diretamente para PolarTech ou clientes.

Fluxo obrigatório:

**Desenvolvimento → ProAR Interno → Homologação → Canary → Produção**

- **ProAR Interno**: `teste.proar.online`, tenant `proar-internal`, base isolada e dados sintéticos.
- **Homologação**: `homologacao.proar.online`, release candidate.
- **Canary**: liberação explícita para tenant selecionado, com período mínimo de observação.
- **Produção**: rollout escalonado por lotes e política de cada tenant.

PolarTech é uma **empresa do grupo em Produção**, não o ambiente de teste.

## Gates obrigatórios

Antes de cada promoção, o sistema verifica:

1. deployment Vercel em estado READY;
2. commit associado ao deployment;
3. sequência correta dos canais;
4. target anterior ativo e saudável;
5. aprovação antes de atingir clientes;
6. compatibilidade de schema;
7. ausência de incidente crítico recente;
8. snapshot pré-release do tenant;
9. health check após troca do alias;
10. janela de observação do Canary.

Migration destrutiva sem rollback declarado é bloqueada.

## Feature Flags

Uma funcionalidade pode existir no código sem estar liberada.

Cada flag suporta:

- Interno ON/OFF;
- Homologação ON/OFF;
- percentual determinístico de Canary;
- Produção ON/OFF;
- exceção por empresa.

## Política por tenant

Cada empresa possui:

- canal;
- versão atual;
- deployment atual;
- versão de schema;
- política automática, manual, fixada ou agendada;
- versão fixada, quando aplicável;
- janela individual de atualização;
- modo manutenção;
- estado do último health check.

## Produção escalonada

A liberação geral não troca todos os aliases em um único request.

Por padrão:

- até 5 tenants por lote;
- intervalo de 60 minutos entre lotes;
- parâmetros configuráveis por ambiente.

Antes do próximo lote, os targets já atualizados são verificados. Em caso de regressão, health inválido ou incidente crítico:

- a release é marcada como falha;
- targets ainda agendados são bloqueados;
- o alias do target com falha retorna ao deployment anterior quando disponível;
- um incidente estruturado é registrado.

## Rollback

Cada target mantém:

- deployment anterior;
- versão anterior;
- snapshot operacional pré-release.

O Manager permite rollback de código e, quando solicitado, restauração do snapshot de dados. Antes de restaurar dados, o estado atual é salvo novamente.

## Dados de QA

O ambiente interno não copia dados de PolarTech ou clientes. Ele cria registros sintéticos próprios para Cliente, Equipamento, OS, Orçamento, Venda, Estoque, Compra, Fornecedor, Financeiro, PMOC, Obras, Licitações, Fiscal e Diagnósticos.

## Auditoria

Criação, aprovação, promoção, alteração de política, feature flags, rollback, health checks e interrupções de rollout são auditados.

## Regra operacional

Um deploy `READY` na Vercel **não significa** que um cliente recebeu a versão. O Manager compara o deployment publicado com o deployment efetivamente servido pelo alias e sinaliza divergências.

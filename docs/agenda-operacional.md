# Agenda operacional

A rota `/?tab=agenda` usa o componente `OperationalAgenda`. Mantém as ordens autorizadas carregadas pelo ERP, os callbacks existentes de abertura/criação de OS e não grava alterações por navegar, buscar ou filtrar.

Visualizações: Dia, Semana (padrão, segunda a domingo), Mês (grade de 42 dias), Técnico (semana) e Lista (todos os registros filtrados com data válida). A referência inicial usa a data civil em America/Sao_Paulo. Os indicadores de hoje, atrasadas e sem técnico consideram as OS em aberto da base carregada. O filtro Todas inclui abertas, concluídas e canceladas.

## Programação e análise

- Programação pendente: OS em aberto sem data válida, horário válido ou técnico; exibe até 50 registros e abre a OS existente para tratamento.
- Conflitos: pares únicos de OS em aberto sobrepostas para o mesmo técnico no período exibido, somente quando existe data, horário, identificação do técnico e duração estimada válida. Trata horários adjacentes como disponíveis. A API bloqueia novos conflitos conhecidos ao alterar a programação, usando o estado completo da empresa. Alterações de observações não bloqueiam OS com sobreposições legadas. Não altera horários automaticamente.
- Resumo por técnico: todos os status e técnicos autorizados no período exibido, independentemente dos filtros da lista. Mostra agendadas/em aberto, concluídas, canceladas e estimativas cadastradas; não mede tempo trabalhado, produtividade financeira ou presença.

O adaptador recebe o ID da empresa ativa, rejeita registros explicitamente marcados com outra empresa e preserva os objetos originais. OS antigas que identificam técnico por nome são vinculadas a um ID somente quando esse nome tem um único ID conhecido nos registros carregados. Pessoas com o mesmo nome e IDs distintos não são mescladas. Dados sem duração não recebem uma duração presumida para calcular conflito.

O calendário respeita as permissões já aplicadas pela API do estado operacional. Em perfis com visão parcial, a análise corresponde somente às OS disponibilizadas ao perfil; ausência de alerta não garante disponibilidade global da equipe.

## Fluxo diário e OS

A Agenda carrega data e técnico selecionados no novo cadastro, exibe filtros ativos e permite limpar filtros. Os cartões mostram técnico, término quando há duração e alerta de dados incompletos. A programação pendente oferece formulário compacto de data, horário, técnico e duração; conflitos conhecidos são revalidados no servidor.

A OS abre em Resumo, com áreas separadas para Ordem, Comunicação, Execução, PMOC, Contratos e Relatórios. Há um único comando de persistência. Os campos compartilham o mesmo rascunho; recuperar rascunhos exige empresa, ID e fingerprint da versão salva correspondentes. Estados personalizados são preservados. Alterações operacionais não recalculam valores legados sem detalhamento financeiro.

Relatórios consultam novamente o estado autorizado e selecionam a OS por ID. Prévia, download e impressão usam o mesmo PDF com fotos e assinaturas existentes. Alterações pendentes exigem salvar antes de exportar. Imagens externas não são baixadas pelo gerador; imagens incompatíveis são informadas na prévia. Registro de execução PMOC continua sendo uma ação explícita, separada do preenchimento do rascunho.

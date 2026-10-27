# Pacote consolidado para produção — 26/10/2026

Origem: chat compartilhado `https://chatgpt.com/share/6adfecab-00c4-83e8-af04-340c3fffc190`. Inclui a sequência dos PRs #131/#132 (OS gerenciais) e #133–#136 (custos e simuladores), consolidada sobre a branch production, sem usar main.

## Alterações

- Administradores e gestores consultam todas as OS retornadas pelo estado da própria empresa, inclusive sem técnico e encerradas. Técnicos continuam restritos às OS abertas atribuídas a eles. A projeção conserva a lista de campos permitidos; não expõe valores financeiros ou credenciais.
- Filtros de abertas, em andamento, concluídas, canceladas e sem técnico; atrasadas exclui encerradas. Listagem renderiza 100 por etapa com opção de carregar mais, sem limitar o conjunto disponível para busca.
- OS encerradas ficam disponíveis para consulta do diagnóstico e serviço executado; edição de execução não é oferecida nesse histórico.
- Composição por produto/serviço com linhas, impostos, margem e taxa de cartão persistidos no registro existente. Aplicar preço/custo exige ação explícita seguida do salvamento normal.
- Simuladores determinísticos de equipe/hora produtiva, metragem e perda, lotes, ponto de equilíbrio e lances. Não enviam ofertas aos portais nem alteram preços automaticamente. Não configuram IA externa.
- Parâmetros financeiros novos iniciam em zero para conferência; campos salvos são preservados. Custo de equipe é informado por profissional e os materiais/equipe do simulador avançado são adicionais ao custo base cadastrado.

## Correções na consolidação

A integração inicial dos simuladores tinha JSX inválido e foi corrigida. Foram adicionadas validação de campos obrigatórios, valores não finitos, categorias/identidades, limites numéricos e proteção contra divisão praticamente nula. Preços mínimos são arredondados para cima ao centavo. O lote considera desconto também na parcela de custo fixo. O ledger valida composições no servidor e mantém as permissões por módulo.

A identificação “sem técnico” considera vínculo por ID e nome. O caso “Não concluída” permanece aberto. Histórico encerrado não entra nas métricas de pendências operacionais.

## Validação e limites

Testes de cálculos, arredondamento, entradas inválidas, persistência/negação de permissão, projeção de mais de 500 OS para gestores e segregação de técnicos. Evidências em docs/validation/latest-changes-production-20261026.log. Executar CI completo com typecheck, lint, testes, build, runtime smoke e probe do banco antes da promoção.

Sem migração, seed, atualização em massa de preços, alteração de dados reais ou credenciais. A validação visual autenticada em aparelhos reais não é declarada concluída. Demais melhorias apenas sugeridas no chat (IA conversacional, comparação de fornecedores, dashboard histórico etc.) não fazem parte deste pacote.

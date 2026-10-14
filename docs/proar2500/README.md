# Programa de evolução ProAR — 2.500 sugestões

Fonte: https://chatgpt.com/share/6acf4bff-1854-83e8-963f-8d6c85cd4fc4?ogimg=plain

Os 500 itens iniciais e 2.000 adicionais estão preservados em catalog.json.
Os identificadores usam base500 e adicional2000 para evitar colisões entre numerações.

## Critério de contabilização

Não auditado: ainda sem comparação completa com a implementação.
Parcial: há uma entrega relacionada, mas faltam critérios do item.
Implementado: todos os critérios concretos do item atendidos e testes aprovados.
Publicado: implementação completa com deploy confirmado.
Bloqueado: dependência concreta registrada.
Uma correção não conclui automaticamente todos os itens relacionados.

## Evidências já publicadas em 14/10/2026

PRs #84, #85, #86, #87, #89, #90 e #91 integrados em production.
Deploy final confirmado no commit 07374d73c2188544655de9fa469c2e0c9d8cdb75.
Cobertura: integridade entre clientes, projeção mobile com dados malformados,
versão e limite de OS seguros, tipos de certame válidos e bloqueio de operações
críticas offline. Isso não constitui conclusão das 2.500 sugestões.

## Lote atual — integridade de contratos e ferramentas HVAC

- adicional2000:0934 (parcial): valor unitário opcional de empenho precisa ser numérico, finito e não negativo; overflow rejeitado. Pendentes outras validações contextuais e integração completa do fluxo de empenhos.
- adicional2000:0932 / base500:042 (relacionados, parciais): execução, liberação e estorno de item de certame usam apenas o saldo da OS informada; reserva mantém saldo global. Esta entrega não conclui todo o fluxo de empenhos nem todo o sistema de saldos.
- adicional2000:0254 (relacionado, parcial): interpolação PT rejeita temperatura não finita e tabelas com medições inválidas. Medição completa de superaquecimento em visita permanece pendente.

Testes: tests/catalog2500-contract-integrity.test.mjs e tests/catalog2500-pt-inputs.test.mjs.
Nenhum lançamento existente é modificado pela alteração do código.

## Próxima prioridade

Verificar integridade e autorização no servidor antes de melhorias visuais,
seguir por itens reproduzíveis e registrar commit, CI e deploy em cada lote.
Integrações dependentes de serviços externos devem registrar a dependência;
não fabricar credenciais, fatos técnicos, dados operacionais ou confirmações.

## Atualização do acompanhamento — 14/10/2026

PRs #92 e #93 publicados. Deploy confirmado no commit
b2d2e5881b29a11138739da4e4c66c90846baf39, com CI completo aprovado.
Incluem saldo segregado por OS, unitários/overflow de empenhos, entradas PT
e projeção de duração/atraso/garantia no Mobile.

O catálogo agora identifica seis itens como parciais, com referência aos PRs.
Os demais 2.494 continuam não auditados. Nenhum item amplo é marcado
como integralmente concluído apenas por associação a uma correção.

### Lote de proteção das mutações de certames

Bloqueia comando com item/histórico numérico inválido, acumulados negativos
ou quantidade que estoura a precisão. Ajuste não pode ultrapassar o disponível
sem o parâmetro booleano de autorização excepcional já existente.
Identificador de movimentação e correlação opcional não podem ser vazios.

A validação ocorre na criação de movimentos; a consulta e os registros
históricos permanecem preservados. Testes:
tests/certame-mutation-integrity.test.mjs.

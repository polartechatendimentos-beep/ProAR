# ProAR — Catálogo de 520 melhorias

Fonte: Catalogo_Completo_520_Melhorias_ProAR_3.0.xlsx, recebido em 14/10/2026.
520 itens em 20 domínios: 140 Alta, 260 Média e 120 Estratégica.

A origem marca seis itens Implementado v2.2.0. Isso não comprova que todos
os critérios desses itens estão presentes no repositório oficial. O catálogo
preserva esse texto em sourceStatus e usa status independente para a auditoria.

## MEL-136 — entrega parcial de Prefeituras

Árvore expansível compartilhada, pesquisa com ancestrais, seleção por IDs,
contadores de OS/equipamentos por nível e criação encadeada no cadastro.
Aplicada aos seletores existentes de OS, orçamento, venda, certame, PMOC,
obras/equipamentos e relatórios. Ordem conforme instrução explícita:
Matriz → Filial/Unidade → Setor → Ambiente.

Preserva registros e vínculos antigos. Referências cruzadas por customerId,
legados ambíguos, ciclos e pais ausentes não permitem seleção indevida.
A aplicação universal aos demais perfis e a auditoria completa das 520
melhorias permanecem pendentes.

## MEL-005 — foco de teclado

Regra compartilhada em app/globals.css para botões, links, inputs, selects,
textareas, summaries, role=button e tabindex usando :focus-visible.
Outline de 2px #38bdf8 com offset de 2px, preservado contra resets de outline.
Esta entrega não certifica a acessibilidade WCAG AA de todo o sistema.

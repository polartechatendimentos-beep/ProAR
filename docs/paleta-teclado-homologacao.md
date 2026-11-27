# Paleta do teclado da PolarTech

O tema escuro usa grafite, azul-ardósia e teclas foscas, com texto branco. A variante clara usa os mesmos tons de azul e cinza. O padrão novo é Escuro; preferências gravadas não foram substituídas (inclusive Automático no Mobile). Sol forte no Mobile, sinais de aviso/erro/sucesso, assinatura, etiqueta e documentos de impressão preservam seus respectivos tratamentos.

Tokens em `app/proar-keyboard-palette.css`; são consumidos pelo ERP, Agenda, Atendimento e Pendências, e Mobile, incluindo jornada. O shell de autenticação e as telas operacionais públicas utilizam as mesmas cores de navegação.

## Homologação
- ERP: login, início, Agenda, OS, Clientes, Equipamentos, PMOC, Obras, Vendas, Financeiro, Fiscal e Licitações; verifique filtros, modais, tabelas, foco e estados sem dados.
- Atendimento: tema escuro/claro, caixa de entrada, análise, chat, alertas e Pendências; verificar persistência da escolha.
- Mobile: 360 px e 390 px, OS e jornada; verificar seleção claro/escuro, Sol forte e ausência de corte horizontal.
- Aplicativo instalado: abrir com conexão depois da atualização e reabrir sem internet no aparelho de teste, usando uma sessão válida. Conferir manifestos e cache v8.
- Papéis timbrados, certificados e etiquetas: manter o estilo de impressão já aprovado. Nenhuma alteração de regras operacionais ou dados reais é necessária.

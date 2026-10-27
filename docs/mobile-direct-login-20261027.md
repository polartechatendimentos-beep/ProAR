# Login direto ProAR Mobile — 2026.10.27.3

Formulário de usuário/senha dentro de /mobile quando bootstrap retorna 401. Reutiliza POST /api/auth e cookie HttpOnly existente, sem abrir o ERP completo, criar credenciais ou modificar permissões. Identifica tenant em polartech.proar.online e mobile.polartech.proar.online. Confirma authenticated=true no servidor antes de atualizar bootstrap. Bloqueio de empresa e respostas inválidas são exibidos na tela.

Troca obrigatória de senha temporária usa o endpoint existente e acontece no formulário Mobile, sem redirecionar para a raiz. Acesso exige conexão, senha não é armazenada no código/Storage e erros HTML não são mostrados como conteúdo. Botão Sair encerra a sessão pelo endpoint existente, revoga lease offline local e preserva rascunhos criptografados de cada escopo. Nenhuma mudança no backend de autenticação, banco ou dados reais.

Testes de identificação de tenant e contrato de confirmação de login adicionados. Validação automática e CI necessários antes da publicação; fluxo autenticado com credenciais reais não executado nesta sessão.

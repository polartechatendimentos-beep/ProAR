# Implementação do modelo visual ProAR 3.0

Base utilizada: projeto consolidado oficial enviado em 12/08/2026.

## Alterações visuais
- Tema principal escuro em preto, azul-marinho, azul e branco.
- Sidebar compacta e persistente, com item ativo em azul.
- Cabeçalho escuro com busca, notificações, sincronização e perfil.
- Cards, tabelas, formulários, modais e abas adaptados para o mesmo design system.
- PDV, Orçamentos, Clientes, Equipamentos, Produtos, Serviços, Compras, Fornecedores, Financeiro, Obras, Licitações, OS, Relatórios e Configurações passam a utilizar o mesmo padrão visual.
- Responsividade reforçada para tablet e celular.

## Identidade
- Ícone oficial do ProAR substituído pela imagem P azul com floco de neve fornecida pelo usuário.
- `BY TAV's` incluído de forma discreta na marca e no cabeçalho.
- Mantidas as configurações de identidade por empresa/tenant; a alteração é a identidade padrão do produto ProAR.

## Preservação de dados
Nenhuma tabela, registro ou migração destrutiva foi criada nesta atualização. A implementação atua sobre componentes e CSS existentes e mantém os mesmos estados, IDs, APIs e persistência já usados pelo projeto.

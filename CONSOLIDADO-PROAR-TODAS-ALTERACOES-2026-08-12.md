# ProAR Gestão de Serviços — BY TAV's

## Projeto consolidado — 12/08/2026

Esta versão reúne em um único código-base as alterações realizadas nas versões anteriores, preservando os dados e funcionalidades existentes.

### Consolidação incluída
- Correções de sincronização e divergência entre aparelhos.
- Banco online como fonte principal e proteção contra sobrescrita por versões locais antigas.
- Multiempresa com ProAR Manager e trial de 7 dias.
- Subdomínio por empresa no padrão `nomefantasia.proar.online`.
- Isolamento de tenant/banco por empresa, sem fallback operacional para o banco mestre.
- Cadastro principal da empresa carregando identidade, logo e dados nos relatórios.
- Cadastro de clientes com CPF/CNPJ e consulta automática de CNPJ.
- Matriz, filiais, unidades e setores, incluindo consulta automática de CNPJ na filial/setor.
- Abas completas do cliente: dados gerais, unidades/setores, equipamentos, serviços executados, OS, orçamentos, pedidos/vendas, financeiro, documentos e histórico.
- Limite de crédito, saldo lançado e situação financeira.
- Cadastro técnico de equipamentos com cliente, unidade, tipo, marca, modelo, BTUs, número de série, tensão, fluido, local, instalação, preventiva e garantia.
- Ordem de serviço com inclusão posterior de produtos/serviços, fotos antes/depois, assinaturas e relatório completo.
- Preparação de emissão NFS-e via backend.
- Gerenciador de Vendas e Gerenciador de Orçamentos.
- Licitações com ficha completa em duplo clique e integração para documentos/editais do PNCP.
- Produtos e Serviços com cadastro ampliado, histórico de consumo, clientes, compras, vendas, orçamentos e OS.
- Relatórios com cabeçalho e dados da empresa ativa.
- Obras com melhorias de sincronização, estados, fotos e acompanhamento conforme versões anteriores.

### Regra de preservação
As alterações desta consolidação são incrementais. Não foram adicionadas migrações destrutivas para apagar clientes, OS, produtos, serviços ou demais dados já existentes.

### Infraestrutura
Domínio principal: `proar.online`
- `manager.proar.online` — administração TAV's
- `teste.proar.online` — trial
- `nomefantasia.proar.online` — empresa/tenant

Antes da publicação, executar `npm install` e `npm run build` no ambiente de implantação e aplicar apenas as migrações SQL incrementais incluídas no projeto.

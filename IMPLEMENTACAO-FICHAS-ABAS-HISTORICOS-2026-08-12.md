# Implementação — fichas, abas e históricos

Atualização incremental. Nenhum registro existente é excluído ou recriado.

## Fornecedores
Ficha completa com abas: Dados gerais, Compras, Produtos fornecidos, Financeiro, Documentos e Histórico. Compras e financeiro são vinculados aos registros existentes pelo fornecedor.

## Equipamentos
Ficha com Dados gerais, Dados técnicos, Ordens de serviço, Manutenções, Garantias e Histórico. São exibidos tipo, marca, modelo, BTUs, número de série, tensão, refrigerante, local, unidade e datas.

## Produtos
Ficha com Dados gerais, Estoque, Compras, Clientes e Histórico. O histórico usa compras, vendas, orçamentos e OS já cadastrados.

## Serviços
Ficha com Dados gerais, Clientes, Ordens de serviço, Orçamentos e Histórico.

## Compras
Ficha com Dados gerais, Itens, Pagamento, Financeiro, Documentos e Histórico.

## Persistência
Os campos cadastrais gerais de registros de módulos (documento, contato, telefone, razão social, fantasia, e-mail, endereço e inscrições) passam a ser preservados no ModuleRecord, sem alterar os registros antigos.

## Segurança e entrada pública preservadas
Também foram incorporadas as correções pendentes da auditoria: aliases públicos `/login`, `/auth` e `/signin`, `robots.txt` explícito, headers de hardening e remoção do catálogo padrão de serviços do bundle público. O catálogo padrão agora é retornado apenas por endpoint autenticado e com `Cache-Control: private, no-store`.

# Correção de Relatórios e Ordem de Serviço - 12/08/2026

Alterações aplicadas sem remoção de dados existentes.

## Cabeçalho dos relatórios
- Relatórios passam a usar os dados da empresa ativa/tenant: logo, nome fantasia, razão social, CNPJ/CPF, telefone, e-mail, endereço, cidade e UF.
- Relatório de Obras deixou de usar o texto fixo PolarTech e passou a usar a empresa ativa.
- Central de Relatórios ganhou cabeçalho institucional para impressão.
- Rodapés usam ProAR Gestão de Serviços - BY TAV's + empresa ativa.

## Ordem de Serviço
- O botão rápido de PDF/impressão no Gerenciador de OS agora gera o relatório completo.
- Inclusão das fotos Antes e Depois quando existentes.
- Inclusão da assinatura do cliente quando registrada.
- Inclusão da assinatura do técnico quando registrada.
- Cabeçalho da OS usa a empresa ativa, sem nome fixo no código.
- A impressão aberta dentro da OS também recebeu cabeçalho empresarial ampliado.

## Cadastro principal da empresa
- O carregamento do tenant foi ampliado para reconhecer também WhatsApp, CEP, inscrições estadual/municipal, tipo empresarial e regime tributário quando disponíveis no cadastro mestre.
- Nenhuma migração destrutiva foi executada.

## Validação
- Foi executada checagem TypeScript. O projeto enviado não contém node_modules, portanto a checagem completa retorna dependências ausentes de Next/React/Node. Não foram identificados erros sintáticos específicos das alterações desta entrega.

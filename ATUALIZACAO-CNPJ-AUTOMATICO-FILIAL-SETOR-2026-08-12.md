# Atualização — Busca automática de CNPJ em Filial/Setor

- Mantidas todas as funcionalidades e dados anteriores.
- Na aba Cliente > Cadastro de unidade e setor, o formulário de nova filial/unidade agora consulta CNPJ automaticamente pela rota interna `/api/cnpj/[cnpj]`.
- Preenchimento automático quando disponível: razão social, nome fantasia, telefone, e-mail, CEP, logradouro, número, complemento, bairro, cidade, UF, CNAE e situação cadastral.
- Todos os campos permanecem editáveis antes de salvar.
- O vínculo com a matriz/cliente principal continua obrigatório e preservado.
- Os novos dados cadastrais da filial são salvos no registro de `Unidades e setores`, sem remover campos legados.
- Caso a consulta de CNPJ falhe, o formulário permanece liberado para preenchimento manual.

# ProAR — Cadastro automático de cliente por CPF/CNPJ

Atualização incremental e não destrutiva.

## Implementado
- Campo único CPF/CNPJ na primeira aba do cadastro de cliente.
- Reconhecimento automático: até 11 dígitos = PF; 14 dígitos = PJ.
- Para CNPJ, consulta server-side via BrasilAPI / Minha Receita.
- Preenchimento automático de razão social, nome fantasia, e-mail, telefone, CEP, logradouro, complemento, bairro, cidade, UF, CNAE e situação cadastral quando disponíveis.
- Todos os dados preenchidos automaticamente permanecem editáveis antes de salvar.
- CPF não realiza consulta de dados pessoais; apenas é reconhecido e permite preenchimento manual.
- Falha da consulta não bloqueia o cadastro manual.
- Campos anteriores de crédito, situação financeira, validação de endereço e observações foram preservados.
- Estrutura Customer recebeu apenas campos opcionais, preservando clientes antigos.

## Observação
A consulta CNPJ depende de serviço externo. O backend do ProAR atua como intermediário para evitar CORS e centralizar tratamento de erro.

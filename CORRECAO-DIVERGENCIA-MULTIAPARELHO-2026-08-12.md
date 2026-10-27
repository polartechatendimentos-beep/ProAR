# Correção de divergência multiaparelho — 12/08/2026

## Falha encontrada
A versão anterior permitia que o identificador lógico da empresa fosse escolhido pelo `localStorage` do dispositivo em instalações legadas. Um computador podia consultar `proar_state` em um ID (por exemplo CNPJ ou outro ID salvo) enquanto um celular novo consultava `polartech-principal`. O resultado era exatamente o observado: clientes visíveis em um aparelho e ausentes em outro.

## Correções aplicadas
- O backend agora define um `PROAR_PRIMARY_COMPANY_ID` canônico para instalações legadas, com padrão `polartech-principal`.
- O dispositivo não escolhe mais qual linha do banco é principal.
- Na leitura, o servidor reconhece os IDs legados conhecidos (`main`, `polartech-principal` e o ID solicitado pelo aparelho), preserva o estado mais novo e acrescenta registros ausentes sem apagar clientes, OS ou cadastros de módulos.
- Quando encontra estados legados, consolida a recuperação no ID canônico.
- Tenants novos continuam 100% isolados e nunca participam dessa recuperação legada.
- Cache legado global só é aceito para a empresa principal; tenants nunca reutilizam cache de outra empresa.
- Login offline em cache só é usado quando o aparelho estiver realmente sem internet.
- Domínio padrão atualizado para `proar.online`.

## Configuração recomendada no Vercel
`PROAR_PRIMARY_COMPANY_ID=polartech-principal`
`PROAR_ROOT_DOMAIN=proar.online`
`NEXT_PUBLIC_PROAR_ROOT_DOMAIN=proar.online`

## Procedimento de recuperação
Após publicar esta versão, abrir primeiro o ProAR no computador que atualmente exibe todos os clientes e clicar em **Atualizar**. Isso permite que o backend reconheça o ID legado daquele aparelho e consolide os registros na base canônica. Em seguida, abrir o celular ou deixar o sistema em primeiro plano; a atualização automática deve carregar a mesma lista.

Nenhuma tabela, cliente, OS ou registro anterior é apagado por esta correção.

# ProAR — análise técnica e correções aplicadas (11/08/2026)

## Falha crítica encontrada
O projeto mantinha a base online no Supabase, porém também gravava snapshots completos no `localStorage`. A ação manual **Enviar** usava `_force:true`, permitindo que um aparelho sobrescrevesse o estado online mesmo quando outro aparelho possuía revisão mais nova. A aba Obra possuía comportamento equivalente com `force=true`.

## Correções aplicadas
- Banco online permanece como fonte principal quando há internet.
- Removido envio forçado da cópia local no fluxo geral e no mapa de obras.
- Botão **Enviar** virou **Sincronizar** e agora busca a versão oficial, em vez de promover o aparelho a fonte principal.
- Conflitos `409` preservam a revisão do servidor e atualizam também o cache local.
- Atualização automática do estado a cada 20 s, ao voltar para a aba e ao focar a janela.
- Fila offline deixa de sobrescrever silenciosamente uma revisão mais nova.
- Aba Obras mantém revisão online e sincronização periódica sem `force`.
- Cadastro de cliente ganhou limite de crédito, saldo lançado e situação financeira.
- Nova OS exibe situação de crédito e bloqueia cliente marcado como Bloqueado.
- Unidades/filiais/setores preservam CNPJ, responsável, telefone e endereço.
- OS já lançada agora permite adicionar/remover produtos e serviços pelo catálogo.
- Criada rota backend segura para integração NFS-e (`/api/nfse/issue`) sem expor token no navegador. A emissão efetiva depende das credenciais e contrato da API da Prefeitura/provedor.

## Próximos passos recomendados
1. Migrar o estado monolítico `proar_state.payload` para tabelas relacionais por entidade (clientes, unidades, OS, itens, obras, casas, histórico, financeiro). Isso elimina conflito de snapshot completo.
2. Criar `updated_at`, `version` e `updated_by` em cada registro e usar atualização otimista por registro.
3. Trocar fotos em base64 por Supabase Storage; hoje base64 dentro do estado aumenta muito o payload e piora sincronização em celular.
4. Criar tabela de fila/auditoria de eventos imutáveis para alterações de OS e Obra.
5. Implantar Supabase Realtime para clientes/OS/obras ou WebSocket equivalente; o polling de 20 s já reduz divergência, mas realtime é o ideal.
6. Separar saldo financeiro calculado de “saldo lançado”; o valor utilizado deve vir de contas a receber/pedidos/OS comprometidas.
7. Implementar baixa/reserva real de estoque por item da OS.
8. Validar integração NFS-e de Mirassol com documentação oficial/provedor e certificado/credenciais antes de liberar emissão em produção.

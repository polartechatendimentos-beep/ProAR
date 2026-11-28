# ProAR: continuidade sem internet

## Preparar o aparelho

Entre no sistema pela internet, no perfil e empresa corretos. No painel inicial, em Vendas ou em Ordens de serviço, abra **Continuidade sem internet**. Espere aparecer **aparelho preparado**. Use apenas um dispositivo confiável. A cópia de consulta fica no perfil de armazenamento do navegador; não é backup. Não limpe os dados do navegador e não use aba anônima para guardar rascunhos.

Depois de preparado, abrir novamente o PDV, a OS e o orçamento não depende da rede enquanto a autorização local ainda for válida. Uma recusa explícita do servidor nunca é substituída por uma sessão antiga. A cópia de consulta é isolada por empresa, usuário e perfil de acesso. A interface mostra a data dos dados: preços, estoque, agenda e cadastros locais podem estar desatualizados.

## Durante a falha

| Fluxo | Continua sem conexão | O que exige acesso online |
| --- | --- | --- |
| PDV | Consultar o catálogo preparado, montar carrinho e usar **Salvar rascunho neste computador**. Permite retomar o rascunho e registrar a forma pretendida de pagamento. | **Sincronizar** confere dados e registra um pedido **Aguardando conferência**. Finalização, baixa de estoque, caixa e confirmação de recebimento são etapas posteriores. Se a resposta de uma finalização online se perder, use **Conferir envio**, não abra uma segunda venda. |
| Ordem de serviço | Usar **Rascunho neste aparelho** ou **Revisar e guardar pedido** para registrar uma nova OS e uma preferência de atendimento. | Envie pela lista **Ordens guardadas neste aparelho**. O sistema checa o cliente, técnico e horário no banco; só então a agenda pode exibir a reserva. Conflitos ficam visíveis no pedido local. O envio de WhatsApp não faz parte da sincronização. |
| Orçamento | Montar orçamento novo, clicar **Guardar neste aparelho** e reabrir após recarregar a tela. | Gravar no banco, enviar, registrar aceite ou converter. Se o ID já existir no banco, conferir o registro antes de descartar a cópia local. |
| Técnico | O fluxo dedicado de OS continua em **Mobile**, com o pacote de ordens do técnico e os rascunhos do aparelho. | Identidade, agenda e versões das ordens são validadas na sincronização. |
| Fiscal e outros serviços externos | Consultar as informações locais permitidas, sem execução externa. | Pix, cartão, NFS-e/NF-e/NFC-e, WhatsApp e buscas de edital precisam da rede e do retorno do serviço. |

A versão não é contingência fiscal e não pode ser usada para afirmar que uma nota, Pix ou cartão foi autorizado. Tampouco substitui o controle online de estoque da empresa.

## Homologação antes do uso real

1. Entrem online num navegador de teste, preparem o aparelho e usem somente clientes e itens sintéticos.
2. Desliguem a rede, recarreguem as três telas e guardem um pedido de PDV, uma OS e um orçamento. Confirmem que não apareceu agendamento, venda no caixa ou documento fiscal.
3. Religuem a rede, confirmem a sincronização dos rascunhos e revisem o pedido de PDV no histórico antes da finalização. Simulem perda da resposta após a gravação e repitam pelo mesmo rascunho.
4. Em outro navegador, alterem o preço/estoque ou tentem reservar o horário escolhido enquanto a primeira sessão está offline. Confiram que o ProAR pede revisão em vez de sobrescrever ou duplicar.
5. Testem a sessão vencida e outro perfil. A cópia ou os rascunhos da conta anterior não devem aparecer.

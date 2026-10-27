# ProAR — Etiqueta permanente de equipamento (OS)

## Finalidade
Uma etiqueta física é vinculada ao **ID imutável do equipamento**, não ao número de uma OS. Após cada atendimento concluído, a página pública consulta as OS vinculadas ao mesmo equipamento, sem substituir a etiqueta.

## Fluxo do operador
1. Cadastrar o equipamento no cliente correto (ID estável). Não duplicar o cadastro a cada manutenção.
2. Ao criar uma OS, selecionar o equipamento na aba Equipamentos; salvar o vínculo por `equipmentIds` ou `equipmentId`.
3. Na OS, abrir **Equipamentos → Etiqueta permanente**, selecionar **Ativar etiqueta e histórico**. Essa alteração requer permissão `equipamentos.editar` e confirmação do banco.
4. Após ativação, clicar **Imprimir etiqueta** e colá-la no equipamento uma única vez. A mesma URL e o mesmo código são reutilizados nas próximas OS.
5. Ao finalizar uma nova OS vinculada ao equipamento, a consulta mostra automaticamente a manutenção no histórico.
6. Para revogar o acesso público, clicar **Desativar consulta**. O histórico interno não é apagado; o QR impresso passa a retornar 404 enquanto desativado.

## Dados públicos e privacidade
- **PolarTech:** URL canônica `https://polartech.proar.online/equipamento/PT-XXXXXXXXXXXX`, otimizada para celular. O código da URL é exatamente o código impresso na etiqueta. O QR Code não aponta para a tela de login nem para o painel administrativo.
- Outros tenants e links legados continuam aceitando o token assinado de identificação; nenhum vínculo de outra empresa é consultado pelo código curto da PolarTech.
- Exibe apenas: código da etiqueta, tipo/marca/modelo/capacidade técnica e até 15 manutenções concluídas com data e categoria genérica do serviço.
- **Não** publica cliente, CNPJ/CPF, endereço, telefone, técnico, assinatura, fotos, notas internas, preços ou dados financeiros.
- Não inclui OS não concluídas, canceladas, de outro equipamento ou de outro cliente quando o vínculo por `customerId` está disponível.
- O acesso é por posse do QR Code, sem login: avisar o cliente e obter autorização antes de ativar.
- QR Code SVG é gerado localmente pelo navegador; o token não é enviado a serviços de QR de terceiros.

## Segurança e operação
- O token é HMAC-SHA256 de empresa + ID do equipamento. A API verifica assinatura antes de consultar qualquer tenant.
- Cada leitura resolve a base de dados da empresa correspondente, sem migrações nem tabelas novas.
- O estado operacional é somente lido na consulta pública; o opt-in é persistido pelo fluxo existente de gravação com revisão e auditoria.
- O código impresso é `PT-` seguido de 12 caracteres hexadecimais determinísticos. **Não é numeração sequencial**; isso evita a disputa por um contador entre técnicos. O servidor resolve o código curto exclusivamente no tenant PolarTech, verificando unicidade e ativação antes de divulgar qualquer dado.
- Configure `PROAR_EQUIPMENT_LABEL_SECRET` estável no servidor **antes de imprimir etiquetas definitivas**. Sem ela, o sistema usa `PROAR_SESSION_SECRET` como compatibilidade, e a rotação desse segredo invalida links impressos.
- Nunca colocar o token completo em logs ou sistemas de análise; respostas públicas usam `no-store` e `noindex`.
- A arte de impressão inicial usa proporção 110 × 70 mm; validar fisicamente a leitura por Android/iPhone antes da produção em escala.

## Vínculos atuais e anteriores
- **Atuais:** OS com `equipmentIds` ou `equipmentId` igual ao ID permanente do equipamento entram automaticamente no histórico após conclusão.
- **Anteriores:** na aba Equipamentos da OS, o operador autorizado pode selecionar uma OS concluída do **mesmo cliente**, confirmar que se refere ao **mesmo equipamento físico** e criar vínculo em `historicalServiceOrderIds` sem modificar ou excluir a OS original.
- OS antigas com `customerId` ausente devem ser regularizadas antes de publicação; não se deve inferir propriedade apenas por nome, marca, modelo ou número de série.
- A API não divulga histórico de outro cliente e não permite associação duplicada a outra etiqueta ativa. Mudança de proprietário exige análise específica de privacidade; o histórico anterior não é liberado automaticamente.
- O operador pode desfazer o vínculo anterior, preservando a OS e a trilha de auditoria do cadastro.

## Critérios de homologação
- [ ] Criar equipamento e vinculá-lo a duas OS concluídas; ambos aparecem no mesmo QR.
- [ ] Conferir QR impresso: `https://polartech.proar.online/equipamento/PT-XXXXXXXXXXXX` com o código visível correspondente.
- [ ] Vincular uma OS antiga do mesmo cliente e verificar a ordenação do histórico; desvincular sem apagar a OS.
- [ ] Bloquear OS antiga de outro cliente, sem customerId, não concluída ou já associada a outra etiqueta.
- [ ] OS em aberto e cancelada não aparecem.
- [ ] OS de outro cliente/equipamento não aparece.
- [ ] QR lido por Android e iPhone após impressão física.
- [ ] Ativar/desativar respeita permissão de edição e confirmação do banco.
- [ ] Desativar retorna 404 sem remover histórico interno.
- [ ] Testar troca de empresa, banco dedicado e legado da PolarTech.
- [ ] Validar impressão 110 × 70 mm, QR com zona de silêncio e dados comerciais.
- [ ] Verificar estabilidade do segredo em Preview e Produção.
- [ ] Não publicar sem aprovação do PR, CI completo e validação em ambiente de homologação.

## Limitações atuais
- Equipamentos existentes só recebem histórico público após ativação explícita.
- O histórico depende de vínculos por ID. OS antigas sem `equipmentId(s)` precisam ser relacionadas corretamente, nunca por mera coincidência de nome.
- O código não é `PT-000001` sequencial. Um contador atômico específico por empresa pode ser desenvolvido separadamente, preservando os QR já emitidos.
- A impressão usa tipografia e cores da PolarTech; o logo gráfico original da imagem de referência ainda não foi incorporado como ativo vetorial.

## Digitação do número da etiqueta na Ordem de Serviço (13/10/2026)

Na OS → aba **Equipamentos**, o campo **Número da etiqueta permanente** aceita, por exemplo, `PT-000001` e o formato determinístico `PT-XXXXXXXXXXXX`.

1. Digitar o número e clicar **Localizar e vincular etiqueta**. O sistema consulta o banco da empresa com a sessão do operador, exige correspondência do `customerId` e vincula o equipamento à OS. O número validado fica gravado na OS em `equipmentLabelCode` após clicar **Salvar**.
2. Se o número ainda não estiver registrado, vincular previamente o equipamento físico correto à OS e clicar **Registrar número neste equipamento**. Somente usuários com permissão de editar equipamentos podem fazê-lo; a confirmação exige reconhecer que a etiqueta está fisicamente naquele equipamento.
3. O cadastro do equipamento guarda `permanentLabelCode`, que não é alterado silenciosamente nas manutenções seguintes. O portal e a impressão passam a usar esse código como URL canônica `https://polartech.proar.online/equipamento/PT-000001`. O código gerado anteriormente permanece aceito como alias para não inutilizar etiquetas já impressas.
4. O cadastro impede duplicação com etiquetas de outros equipamentos da mesma empresa, e o salvamento da OS revalida no servidor que a etiqueta informada pertence ao cliente e a um equipamento vinculado.
5. O histórico público continua limitado a OS concluídas, com vínculo pelo ID do equipamento ou por associação histórica explícita.

**Limitações de homologação:** o cadastro precisa ter `customerId` consistente. Em ambiente multiempresa, o código curto público é resolvido apenas na instância PolarTech; os demais tenants continuam com links assinados. Testar conflito de gravação concorrente, leitura do QR impresso e atualização dos dados em homologação antes de publicar.

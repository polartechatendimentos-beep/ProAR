# Integração operacional: roteiro de homologação

Esta branch integra alterações de interface e domínio. Não substitui o teste com permissões reais em ambiente isolado. Não habilitar o piloto no número comercial, emitir fiscal de produção ou restaurar sobre a base real.

| Área | Resultado a conferir |
| --- | --- |
| Central de Pendências | Um administrador vê fila de mensagens, agenda incompleta, envios incertos e alarmes de integridade. A verificação de links é limitada e indica cobertura parcial. |
| OS e link público | Alterar uma OS de ensaio, simular falha exclusiva na projeção e reprocessar em Pendências. O resultado não modifica a OS, o estoque nem o financeiro; só o recorte público existente. |
| Mobile | Em Android de teste, vincular dois aparelhos, salvar um concluído e um pendente offline e recarregar. Sincronizar, verificar o motivo e a foto; a OS fica em aberto até resolver. Conferir atalhos Relatório, Fotos e Checklist. |
| WhatsApp | Só em piloto autorizado com número interno. Validar duplicatas, desconexão antes do envio, aceitação sem entrega e interrupção após aceite. A fila fica desligada por padrão e não reenvia resultado incerto. |
| Fiscal, finanças e estoque | Em homologação fiscal, simular autorização, rejeição comprovada, tempo limite, reenvio e estorno. Conferir materiais, nota, título e baixa na rastreabilidade. Nenhuma repetição de emissão perante resultado incerto. |
| Conversão do orçamento | Converter uma vez, reexecutar o mesmo comando e tentar criar o segundo destino. Conferir totais, unidades e descontos. Revisão fiscal obrigatória para mistura de produtos e serviços. |
| Cadastro, PMOC e contratos | Verificar cliente/unidade/sala/equipamento com IDs. Testar homônimos e legados; não mesclar. Faturamento do Empenho deve considerar somente execução e saldo comprovados. |
| Licitações | Testar edital com prazo distinto da sessão, requisito > 1,0, lote incompleto e piso com revisão de outra pessoa. Nenhuma proposta ou lance enviado. |
| Isolamento e recuperação | Usar matriz de perfis e cópia de segurança em homologação, conforme `homologacao-restauracao-isolamento-proar.md`; origem e outra empresa permanecem intactas. |

Limites: as integrações fiscal e WhatsApp devem usar credenciais e dados de teste; verificação geral não dispara processos externos. A checagem nova de reenvio fiscal cobre NFS-e; NF-e/NFC-e e a restauração real permanecem casos de homologação. O carregamento tardio é dos módulos de interface, não uma mudança no contrato do carregamento e gravação do estado.

# Sugestões no campo de mensagem

Na central Atendimento, a IA fica imediatamente abaixo do texto digitado. Após uma pausa de 2 segundos e pelo menos 12 caracteres, o controle “Sugerir ao digitar” prepara uma mensagem completa para revisão. É possível desativar esse controle e usar Sugerir mensagem, Melhorar texto, Mais cordial ou Mais direto. Usar sugestão preenche o campo; Enviar resposta continua sendo uma ação separada.

A sugestão usa a conexão OpenAI já configurada na empresa, até 12 mensagens recebidas/enviadas desta conversa e até 8 modelos aprovados do setor. Notas internas e eventos administrativos são excluídos. O pedido de IA usa store:false. Campos de contato e dados de outras conversas não são carregados. Os modelos são exemplos de estilo e não comprovam preços, agenda ou condições atuais.

O administrador pode revisar o texto e salvar como referência da empresa, removendo nomes, telefones, endereços, datas e valores específicos. A referência vira uma resposta rápida, editável e removível em Assistente → Respostas rápidas. Essa memória é compartilhada apenas dentro da empresa. Não há retreinamento do modelo nem persistência automática de tudo que o atendente digita.

Troca de conversa, texto editado enquanto a consulta ocorre e cancelamento de uma consulta descartam respostas antigas. O cliente que pediu interrupção de mensagens fica bloqueado. Acesso à conversa e ao setor é validado no servidor; somente administradores aprovam referências compartilhadas. Sem credencial disponível, o formulário permanece utilizável e mostra a orientação para configurar a IA.

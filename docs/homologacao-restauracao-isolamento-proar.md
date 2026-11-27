# Ensaio de restauração, isolamento e desempenho do ProAR

**Estado inicial:** existem testes com dados artificiais no repositório. Eles não validam o backup operacional, a réplica do fornecedor, o banco de produção nem uma restauração real. O ensaio a seguir só deve usar infraestrutura e credenciais de homologação, com dados fictícios.

## 1. Restaurar sem tocar nas bases vigentes

**Responsável:** administrador de banco, com um segundo operador confirmando o projeto, o banco e a conta. **Janela e critérios:** registrar previamente o RPO/RTO esperados, os recursos cobertos e a pessoa que decide liberar ou abortar. Não executar se o destino não estiver comprovadamente vazio e isolado.

1. Criar duas empresas artificiais em homologação, **A** e **B**, com o mesmo código comercial de cliente, OS e nome de login, mas marcadores e senhas de teste diferentes. Conferir os dois logins e anotar separadamente as contagens e referências. A e B nunca devem compartilhar credenciais. Manter os serviços externos desligados na origem e no destino do ensaio, inclusive WhatsApp, meios de pagamento, emissão fiscal, e-mail e rotinas automáticas.
2. Fazer backup **só da origem A de homologação**. Usar o backup/exportação oficialmente suportado no provedor e guardar o artefato cifrado em local privado do ambiente. Registrar data UTC, versão do PostgreSQL, revisão/migrações, tamanho e SHA-256. Não copiar senhas/chaves para tickets, chats ou linha de comando. Conferir a lista de objetos do arquivo antes de restaurar. Se a origem guardar dados de várias empresas no mesmo banco, este roteiro não autoriza exportar o banco compartilhado: preparar uma origem artificial exclusiva.
3. Depois do backup, alterar apenas um campo fictício de A para verificar o ponto de recuperação. Criar **um novo banco ou branch dedicado e descartável** com rede e credenciais próprias para receber a cópia. Não usar opções que apaguem objetos, recriem bancos ou mudem o alias de produção. Não apontar a aplicação de produção para a cópia. Abortagem segura: interromper o ensaio e isolar o destino descartável.
4. Restaurar com parada no primeiro erro no destino. Quando o artefato for PostgreSQL custom-format e os utilitários da versão estiverem instalados, os comandos abaixo são exemplos com valores fictícios no arquivo de serviços local. Usar somente após a conferência humana da origem e do destino:

   ```sh
   pg_dump --dbname='service=proar_homolog_a_origem' --format=custom --file=proar-a-sintetico.dump --no-owner --no-privileges
   sha256sum proar-a-sintetico.dump
   pg_restore --list proar-a-sintetico.dump
   pg_restore --dbname='service=proar_homolog_a_destino_novo' --single-transaction --exit-on-error --no-owner --no-privileges proar-a-sintetico.dump
   ```

   Para recuperação gerenciada ou point-in-time, criar uma cópia no provedor no instante de teste, nunca usar promoção ou restauração no mesmo lugar. Comprovar de forma independente a cobertura de arquivos/anexos e do cadastro de tenants. O banco sozinho não comprova recuperação de arquivos externos, configuração, autenticação ou segredos. No teste, provisionar somente credenciais fictícias no destino.
5. Verificar em A restaurada: contagens esperadas por módulo, relacionamento cliente → OS, revisão, marcador antigo presente e marcador pós-backup ausente; registrar amostra de leitura e edição de uma OS fictícia que seja feita apenas no destino. Verificar que o marcador pós-backup continua na origem A; recalcular indicadores de B, que precisam ser idênticos aos anotados antes. Se houver diferença ou ausência de evidência, não aprovar a restauração.
6. Medir tempo a partir da solicitação de recuperação até a aplicação restaurada passar nos controles; relatar o intervalo entre o ponto recuperado e o evento de teste para avaliar RPO. Guardar relatório enxuto sem cópia de dados, sem credenciais e sem nomes reais. Remover o destino e artefatos fictícios apenas segundo o prazo de retenção da homologação e a autorização do responsável.

## 2. Matriz de isolamento com controles

| Controle | Cenário | Resultado esperado |
|---|---|---|
| Positivo A | Administrador A abre cliente e OS artificiais de A | Apenas os marcadores de A são exibidos |
| Positivo B | Administrador B abre seu cliente e sua OS com os mesmos códigos | Apenas os marcadores de B são exibidos |
| Limite A/B | Na homologação, vincular sessão da empresa A a uma seleção incompatível com B por teste controlado | A política rejeita a seleção ou mantém o escopo da sessão; nada de B é exibido ou modificado |
| Limite B/A | Repetir com a sessão B e a seleção A | Mesmo comportamento |
| Papel técnico | Técnico A abre a Agenda e consulta sua OS atribuída | Apenas OS atribuídas; valores internos e credenciais não saem da base |
| Plano/perfil | Perfil sem acesso abre uma rota de módulo pela UI ou por link direto | Módulo não é renderizado e o servidor não fornece registros sem a permissão |
| Resultado de restauração | A restaurada é editada e B é consultada novamente | Só o destino A muda; o hash e os registros de B permanecem iguais |

Teste local sem infraestrutura: `node --experimental-strip-types --test tests/tenant-restore-drill.test.mjs tests/state-access.test.mjs tests/tenant-auth-boundary.test.mjs tests/role-navigation-workspace.test.mjs`. O primeiro executa exportação/validação/restauração do **fixture JSON em memória** e funções reais de projeção e identidade. Não substitui o teste HTTP autenticado em dois ambientes fictícios e não comprova retenção ou recuperação no fornecedor.

## 3. Desempenho A/B antes de liberar

- **A (controle):** revisão anterior. **B (variante):** revisão com carregamento tardio dos painéis. Usar mesma fixture, perfil, plano, navegador, rede e máquina; sem clientes reais. Separar cache frio de retorno quente e alternar ordem das medições; pelo menos cinco coletas de cada variante. Não comparar builds de desenvolvimento com builds de produção.
- Em entrada no Painel inicial e em um link direto permitido, registrar JavaScript transferido inicial, tempo até a renderização útil e primeira abertura de Licitações/Fiscal/Diagnósticos (mediana e pior medição). Guardar baseline e traces anonimizados. Verificar nas requisições que chunks exclusivos dessas telas não aparecem no carregamento inicial, mas chegam ao abrir o módulo. Confirmar teclado, voltar/avançar, estados de carregamento e ausência de regressão nas permissões; registrar perdas de desempenho, não só ganhos.
- **Limite da comparação:** lazy loading reduz JavaScript inicial. O contrato atual carrega e salva um snapshot operacional com revisão; não fazer PUT de uma projeção parcial como se fosse a base inteira. Carga incremental por API exige contratos por módulo com permissões e gravação parcial transacional próprios, testados separadamente.

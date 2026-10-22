# Planejamento — cadastro de talhões e seleção no Teste Folha

**Data:** 22/10/2026  
**Status:** aprovado e implementado em 22/10/2026. Funções e regras publicadas; 30 testes locais, lint, tipos e bundle Android aprovados. Conferência visual no emulador pendente por bloqueio da revisão automática.

## 1. O que será entregue

Criar a tela **Talhões**, seguindo o padrão de Usuários para listagem, pesquisa, visualização, cadastro, alteração, confirmação de exclusão e mensagens de erro/sucesso. Substituir o texto fixo do Teste Folha por uma seleção dos registros da coleção `talhoes`.

O planejamento do histórico de análises ficará para depois desta etapa. Esta entrega prepara a identificação do talhão, sem implementar histórico, dashboard, armazenamento de fotos ou detecção de lesões.

## 2. Permissões definidas pelo usuário

| Recurso | Funcionário ativo | Admin ativo |
| --- | --- | --- |
| Ver “Talhões” no menu e acessar a tela | Sim | Sim |
| Pesquisar e visualizar talhões | Sim | Sim |
| Consultar talhões ativos e inativos na tela de cadastro | Sim | Sim |
| Ver a opção de cadastrar | Sim, desativada | Sim, ativa |
| Ver a opção de alterar | Sim, desativada | Sim, ativa |
| Ver a opção de excluir | Sim, desativada | Sim, ativa |
| Selecionar um talhão ativo no Teste Folha | Sim | Sim |

Para Funcionário, o botão de cadastro e as ações Alterar e Excluir **permanecem visíveis**, com aparência desativada e sem executar ações. Visualizar, pesquisar, atualizar a lista e fechar os diálogos continuam disponíveis. Exibir a orientação “Cadastro e alterações disponíveis apenas para administradores”.

Visualizar abre os dados em modo de leitura, com botão **Fechar**, sem botão Salvar. O menu de ações do registro continua acessível ao Funcionário para permitir a visualização.

Conta sem autenticação, inativa, com cadastro/exclusão pendente ou perfil não reconhecido não terá acesso. A interface não será a única proteção: o banco e as funções de gravação também verificarão essas permissões.

## 3. Campos do cadastro

### Campos preenchidos pelo Admin

| Campo no formulário | Campo no Firestore | Tipo | Obrigatório | Regra e exemplo |
| --- | --- | --- | --- | --- |
| Código do talhão | `codigo` | String | Sim | De 2 a 20 caracteres. Letras sem acento, números e hífen, normalizados para maiúsculas. Ex.: `TAL-002`. Único no sistema, inclusive entre talhões inativos. |
| Nome do talhão | `nome` | String | Sim | De 2 a 80 caracteres após remover espaços nas extremidades. Ex.: `Talhão da baixada`. Nomes podem se repetir, pois o código diferencia os registros. |
| Nome da propriedade | `propriedadeNome` | String | Sim | De 2 a 100 caracteres. Ex.: `Propriedade Exemplo`. Nesta versão será texto, sem exigir outra coleção de propriedades. |
| Localidade/comunidade | `localidade` | String | Não | Até 120 caracteres. Ex.: `Capivaras do Meio`. Vazio será salvo como `""`. |
| Município | `municipio` | String | Não | Até 100 caracteres. Se preenchido, exigir UF. |
| UF | `uf` | String | Não | Seleção de uma UF brasileira válida, em maiúsculas. Se preenchida, exigir Município. Sem endereço informado, ambos ficam `""`. |
| Área em hectares | `areaHa` | Number ou Null | Não | Quando informada: número finito, maior que zero e com até 4 casas decimais. Aceitar `2,5` no formulário e salvar `2.5` como número. Vazio será `null`, nunca zero ou texto `"2,5 ha"`. |
| Situação | `status` | String | Sim | `ATIVO` ou `INATIVO`. No cadastro, iniciar em `ATIVO`. Admin pode alterar a situação. |
| Observações | `observacoes` | String | Não | Até 500 caracteres. Ex.: `Acesso pela estrada lateral`. Vazio será salvo como `""`. |

**Recomendação:** manter a área opcional para não obrigar o cadastro de uma medida inventada. Ela poderá ser preenchida depois; relatórios futuros deverão diferenciar área desconhecida de zero.

O código será validado, por exemplo, pelo padrão `^[A-Z0-9][A-Z0-9-]{1,19}$`. Espaços internos, barras e caracteres fora desse padrão serão recusados com orientação no campo. Comprimentos excedidos serão informados, sem cortar silenciosamente o conteúdo.

As mesmas regras serão conferidas no aplicativo e no servidor. Não será possível criar campos extras ou definir informações administrativas enviando uma requisição modificada.

### Campos automáticos

| Campo | Tipo | Responsabilidade |
| --- | --- | --- |
| ID do documento | String, ID automático | Identificação permanente do talhão. Não usar nome ou código como ID. |
| `criadoEm` | Timestamp | Data de criação, definida pelo servidor. |
| `atualizadoEm` | Timestamp | Data da última alteração, definida pelo servidor. |
| `criadoPor` | String | UID do Admin que cadastrou, obtido da autenticação. |
| `atualizadoPor` | String | UID do Admin responsável pela última alteração. |
| `versao` | Number inteiro | Começa em 1 e aumenta a cada alteração, para impedir sobreposição de edições. |

Esses campos não serão editáveis no formulário. As datas serão apresentadas no horário local; o armazenamento usará Timestamp do Firestore.

Não haverá campos de senha, e-mail de acesso ou cadastro no Firebase Auth para o talhão. Também não serão incluídos nesta primeira versão GPS, desenho de perímetro, fotos, responsável exclusivo, safra ou cultivar. Safra/cultivar precisam de uma definição de ciclo de cultivo, para não confundir uma área física com seus plantios ao longo dos anos.

## 4. Como ficará a tela Talhões

Adicionar a opção **Talhões** ao menu lateral de Admin e Funcionário, com rota `/talhoes`. A tela não pode reutilizar o bloqueio atual de Usuários que esconde a página inteira quando o usuário não é Admin.

Seguir a identidade visual e as interações da tela de Usuários:

- Cabeçalho com título Talhões e botão de voltar.
- Pesquisa por código, nome ou propriedade, sem diferenciar maiúsculas e acentos.
- Botão de cadastro somente com ícone, ao lado da pesquisa, como em Usuários. Nome acessível: “Cadastrar talhão”.
- Filtro de situação: Todos, Ativos e Inativos; iniciar em Todos na tela de cadastro.
- Lista com código/nome, propriedade, localidade quando informada e indicação textual de Ativo/Inativo.
- Menu de ações por registro: Visualizar, Alterar e Excluir, respeitando a matriz de permissões.
- Atualização manual, carregamento, lista vazia, pesquisa sem resultados e falha de consulta como estados distintos.
- Formulário com rolagem, teclado adequado à área, erros abaixo dos campos, prevenção de duplo envio e confirmação antes de descartar alterações.

```text
←  Talhões

[ Buscar código, nome ou propriedade ] [ + ]
[ Todos ] [ Ativos ] [ Inativos ]

TAL-002 — Talhão da baixada             ⋮
Propriedade Exemplo
Capivaras do Meio                       Ativo

Menu do registro — Funcionário
Visualizar                              disponível
Alterar                                 desativado
Excluir                                 desativado
```

### Direção de design

Aplicar a skill **frontend-design** em `.agents/skills/frontend-design/SKILL.md` e seguir `GabrielCasagrande/GabrielCasagrande/ETICA-DESENVOLVIMENTO.md`.

Manter o verde `#1B5E20`, fundo `#F7F8F4`, branco `#FFFFFF`, texto `#1A1C19`, texto secundário `#596155` e bordas claras da tela de Usuários. Usar a fonte nativa existente e alinhamento à esquerda. A identificação do talhão e da propriedade terá prioridade sobre decoração.

As ações desativadas terão contraste legível, indicação acessível de desativadas e bloqueio real de interação; não depender somente de reduzir a opacidade. Manter áreas de toque de pelo menos 48 pontos nas novas ações e modais compatíveis com teclado e telas menores. Não instalar biblioteca visual ou criar um sistema genérico de formulários para esta entrega.

## 5. Cadastro, alteração e exclusão

### Cadastro

1. Admin abre o formulário, preenche e confirma.
2. Aplicativo valida e chama `cadastrarTalhao`, seguindo o padrão de chamada das operações de Usuários.
3. Servidor verifica a conta, o perfil Admin ativo e os campos.
4. Uma transação cria o talhão, reserva o código e registra a operação concluída.
5. Exibir “Talhão cadastrado” e atualizar a lista somente após a confirmação do servidor.

Um identificador de operação será reutilizado nas tentativas da mesma solicitação. Repetição por toque, timeout ou reconexão não poderá criar dois registros. Se o formulário mudar para outra intenção de cadastro, usar outra operação.

### Alteração

- Abrir os valores existentes e enviar a versão originalmente carregada.
- Permitir editar os campos do formulário, inclusive o código, sem alterar o ID permanente do documento.
- Na troca de código, reservar o novo e liberar o antigo na mesma transação, recusando códigos de outro talhão.
- Revalidar Admin, conteúdo e versão antes de gravar; aumentar `versao` e atualizar autoria/data.
- Se outro Admin já alterou o registro, preservar o formulário local, avisar sobre o conflito e orientar atualizar; não sobrescrever silenciosamente.
- Inativar impede novas seleções no Teste Folha, preservando o cadastro e seus vínculos.

### Exclusão

- Somente Admin poderá confirmar, com identificação clara do código e nome que serão excluídos.
- Proposta: permitir exclusão física apenas de talhão sem vínculos persistidos. Remover o documento e o índice do código na mesma transação.
- Se houver análises vinculadas, bloquear a exclusão e orientar **inativar o talhão**. Não apagar análises ou outros dados em cascata.
- A checagem considerará `analises` com `talhaoId` igual ao ID do talhão, mesmo que o módulo de histórico ainda não exista. Uma coleção sem documentos não exige criação antecipada.
- A futura gravação de análises deverá conferir o mesmo documento de talhão em sua transação, preservando a proteção contra exclusão simultânea. Esse contrato será retomado no planejamento de histórico.
- Uma seleção mantida apenas na memória de um aparelho não constitui vínculo persistido; o Teste Folha deverá detectar se o talhão foi excluído antes de iniciar outra análise.
- Repetir uma exclusão já concluída com a mesma operação deverá retornar a conclusão, sem afetar outro cadastro.

Não existe dependência do Firebase Auth para criar ou remover o talhão; a autenticação será usada para identificar e autorizar quem executa a operação.

## 6. Mudança no Teste Folha

Hoje o campo mostra o texto fixo “Talhão 02 • Capivaras do Meio”. Ele passará a representar uma seleção real de `talhoes`.

### Fluxo proposto

1. Ao entrar na tela, consultar os talhões `ATIVO` e apresentar “Selecione um talhão”. Não escolher automaticamente o primeiro da lista.
2. Ao tocar no campo, abrir um modal com busca por código, nome ou propriedade, lista rolável e botão Fechar.
3. Mostrar o código/nome e, em uma segunda linha, propriedade/localidade; ordenar de modo consistente por nome e código.
4. Ao selecionar, manter em estado local o ID e os dados atuais necessários à apresentação. O ID será o vínculo estável com o futuro histórico.
5. Exigir um talhão válido antes de iniciar a análise. Permitir fotografar/escolher a imagem antes dessa seleção, sem perder a foto.
6. Imediatamente antes de enviar a imagem à API, conferir no servidor que o documento ainda existe e está ativo. Se não estiver, limpar a seleção e orientar escolher outro; manter a foto disponível.
7. Durante a análise, bloquear a troca do talhão. Capturar o talhão da solicitação junto da foto, para uma resposta não aparecer associada a outra seleção.
8. Exibir no resultado o talhão daquela análise. Trocar o talhão depois do resultado inicia um novo contexto e limpa a classificação anterior, sem reaproveitá-la como se tivesse sido produzida no novo talhão.
9. Ao iniciar outra foto na mesma tela, pode manter a seleção atual visível, revalidando-a antes da próxima análise. Ao sair da conta ou trocar de usuário, limpar a seleção.

```text
Teste Folha

Talhão selecionado
TAL-002 — Talhão da baixada             ⌄
Propriedade Exemplo

[ foto da folha ]
[ Escanear folha agora ]
```

| Situação | Comportamento |
| --- | --- |
| Carregando | Informar carregamento e não tratar como ausência de cadastros. |
| Nenhum ativo | “Nenhum talhão ativo disponível.” Admin terá atalho para Talhões; Funcionário será orientado a solicitar o cadastro/ativação ao Admin. |
| Sem conexão ou sem permissão | Mostrar a falha e Tentar novamente; não apresentar uma lista fictícia ou assumir lista vazia. |
| Um único ativo | Ainda pedir seleção explícita; não vincular automaticamente uma análise. |
| Registro alterado | Atualizar os dados na próxima consulta; manter o vínculo pelo ID. |
| Excluído ou inativado | Invalidar a seleção ao conferir antes da análise e solicitar outra. |

Atualizar as consultas ao abrir a tela/seletor e ao retornar do cadastro, com ação de recarregar no seletor. A primeira versão não exige um listener global permanente. A consulta final antes da análise não poderá confiar apenas em dados de cache.

O modelo Python continua recebendo a imagem como hoje; ele não precisa conhecer o cadastro de talhões para classificar. O contexto escolhido fica no aplicativo nesta etapa. No futuro histórico, cada análise deverá guardar `talhaoId` e os valores de código/nome/propriedade no momento da análise, para uma renomeação posterior não alterar a apresentação do passado. Não criar documentos de análise neste escopo.

## 7. Arquitetura e proteção dos dados

Repetir o padrão de Usuários, adaptando somente o necessário:

| Operação | Caminho proposto |
| --- | --- |
| Consultar/listar | SDK Firestore já utilizado pelo aplicativo. |
| Cadastrar | Cloud Function callable `cadastrarTalhao`. |
| Alterar | Cloud Function callable `alterarTalhao`. |
| Excluir | Cloud Function callable `excluirTalhao`. |

Usar o projeto Firebase existente e a região `southamerica-east1`. Reaproveitar a configuração de conexão e as verificações de conta/perfil existentes, sem modificar o comportamento do módulo Usuários. A infraestrutura das chamadas seguirá a [documentação de funções callable](https://firebase.google.com/docs/functions/callable).

As regras de `talhoes` permitirão leitura para contas ativas com perfil `ADMIN` ou `FUNCIONARIO`, sem pendências. Escritas diretas pelo aplicativo serão negadas para ambos: Admin grava pelas funções. Coleções técnicas não terão leitura/escrita pelo cliente. Como operações administrativas de servidor não dependem dessas regras para autorizar o usuário final, as funções deverão fazer sua própria verificação de permissão. Ver [condições de segurança do Firestore](https://firebase.google.com/docs/firestore/security/rules-conditions).

Revalidar a permissão administrativa dentro da transação antes de gravar, inclusive se o perfil mudou enquanto o formulário estava aberto. A proteção de código único, gravações relacionadas e repetição de operações será transacional; essa abordagem segue as [operações atômicas do Firestore](https://firebase.google.com/docs/firestore/manage-data/transactions).

Não copiar etapas específicas de criação de contas de Usuários, como senha, envio de e-mail ou estados intermediários entre Auth e Firestore: o talhão será gravado somente no Firestore, em uma transação.

## 8. Coleções e campos no Firestore

### Coleção principal: `talhoes`

Um documento por talhão: `talhoes/{talhaoId}`. Exemplo ilustrativo dos campos, não um registro criado por este planejamento:

```text
talhoes / ID_AUTOMATICO
  codigo: "TAL-002"                    String
  nome: "Talhão da baixada"             String
  propriedadeNome: "Propriedade Exemplo" String
  localidade: "Capivaras do Meio"       String
  municipio: ""                        String
  uf: ""                               String
  areaHa: 2.5                          Number
  status: "ATIVO"                      String
  observacoes: ""                      String
  criadoEm: data do servidor           Timestamp
  atualizadoEm: data do servidor       Timestamp
  criadoPor: UID do Admin              String
  atualizadoPor: UID do Admin          String
  versao: 1                           Number inteiro
```

### Índice de unicidade: `_talhoes_por_codigo`

Documento com o próprio código normalizado como ID: `_talhoes_por_codigo/TAL-002`.

| Campo | Tipo | Conteúdo |
| --- | --- | --- |
| `talhaoId` | String | ID do documento correspondente em `talhoes`. |
| `criadoEm` | Timestamp | Data de criação desta reserva de código, pelo servidor. |

Esta coleção técnica garante a unicidade mesmo se dois Admins cadastrarem simultaneamente. Não é uma segunda lista de talhões e não aparece na interface. Não confundir com os índices de consulta configurados pelo próprio Firestore.

### Controle de repetição: `_operacoes_talhoes`

Documento por solicitação de gravação, com ID gerado para a operação e reutilizado em sua repetição.

| Campo | Tipo | Conteúdo |
| --- | --- | --- |
| `usuarioId` | String | UID do Admin solicitante. |
| `tipo` | String | `CADASTRAR`, `ALTERAR` ou `EXCLUIR`. |
| `talhaoId` | String | Talhão afetado. |
| `entradaHash` | String | Resumo dos parâmetros normalizados para impedir reutilização da mesma operação com outro conteúdo. |
| `concluida` | Boolean | `true` quando a transação foi concluída. |
| `criadaEm` | Timestamp | Data do servidor. |
| `resultado` | Map | Identificação do talhão e indicação do resultado, sem dados de autenticação. |

Na primeira versão, gravar esse registro concluído junto das alterações da transação. Uma transação abortada não deixa cadastro parcial. Os documentos de operação não serão apagados automaticamente junto do talhão, para não perder a proteção de repetição de solicitações antigas.

### Coleções existentes

Usar `usuarios/{uid}` para conferir `tipoUsuario`, `statusConta`, `cadastroPendente` e `exclusaoPendente`, conforme o módulo atual. Não criar outro perfil de usuário nem alterar `login_por_matricula` para cadastrar talhões.

Não criar `propriedades`, `analises`, Storage ou outra coleção de histórico nesta entrega. O bloqueio de exclusão já estará preparado para consultar `analises.talhaoId` caso existam registros desse futuro módulo.

## 9. Tutorial previsto para a entrega da integração

O tutorial final será entregue com os nomes e comandos efetivamente implementados. O procedimento recomendado já fica definido:

1. Publicar as regras de leitura de talhões e as três funções de gravação no projeto existente, preservando as funções de Usuários.
2. Entrar no app com um perfil `ADMIN` e `statusConta = ATIVO`.
3. Abrir Talhões, cadastrar o primeiro registro e confirmar.
4. Abrir Firebase Console → Firestore Database → Dados. Verificar `talhoes`, `_talhoes_por_codigo` e `_operacoes_talhoes`, com os campos descritos acima.
5. Conferir se o índice do código aponta para o mesmo ID do talhão e se a operação consta como concluída.
6. Abrir Teste Folha, selecionar o talhão ativo cadastrado e realizar a validação do fluxo.
7. Entrar como Funcionário e conferir: menu visível, consulta disponível e ações de cadastro/alteração/exclusão desativadas.
8. Inativar o talhão como Admin e confirmar que ele continua visível na tela de cadastro, mas não aparece como opção de uma nova análise.

**Não será necessário montar manualmente os documentos no Console:** o fluxo do aplicativo criará os documentos e suas coleções na primeira gravação, como permite o [modelo de gravação do Firestore](https://firebase.google.com/docs/firestore/manage-data/add-data). O Console será usado para conferência. Não inserir apenas um documento em `talhoes` sem seu índice, pois isso quebraria o controle de código único.

Se houver necessidade de cadastrar dados em lote ou importar cadastros antigos, planejar uma importação que valide e crie os mesmos vínculos. Não exigir do usuário o preenchimento manual de campos técnicos, hashes ou timestamps. Caso uma consulta da implementação exija índice composto, incluir sua configuração no repositório e os passos correspondentes no tutorial final.

## 10. Arquivos previstos após aprovação

| Arquivo | Mudança |
| --- | --- |
| `src/screens/Talhoes.js` | Nova tela de listagem e formulários com permissões por ação. |
| `src/app/talhoes.js` | Rota no padrão usado por Usuários. |
| `src/screens/Home.js` | Item Talhões para os dois perfis. |
| `src/services/talhoes.js` | Consultas e chamadas das operações de gravação. |
| `src/screens/TesteFolha.js` | Seleção dinâmica, estados de consulta e vínculo local ao resultado. |
| `functions/index.js` | Três funções de talhões e validações/transações necessárias. |
| `firestore.rules` | Leituras por perfil e bloqueio das escritas diretas/coleções técnicas. |
| Testes em `functions/test/` | Permissões, unicidade, conflitos e exclusão com vínculos. |
| `functions/README.md` e guia de Talhões | Documentação das chamadas, publicação e tutorial final do Firestore. |

Reutilizar estruturas somente quando houver uso real e sem criar uma arquitetura genérica de CRUD. Manter as funções de Usuários funcionando. Não alterar a API Python nem os pesos dos modelos para implementar o cadastro de talhões.

## 11. Critérios de aceite e testes

- Funcionário vê Talhões no menu, pesquisa e visualiza ativos/inativos; Cadastrar, Alterar e Excluir aparecem desativados.
- Tentativas de gravar como Funcionário são recusadas também por chamadas diretas às funções e por escrita direta no Firestore.
- Admin cadastra, consulta, altera, inativa/reativa e exclui quando não houver vínculos.
- Código repetido, inclusive com diferença apenas de maiúsculas, é recusado; dois cadastros concorrentes não reservam o mesmo código.
- Repetição da mesma operação não duplica cadastro, não reaplica uma alteração e não recria um talhão já excluído.
- Alterar código mantém o ID; falha em uma transação não deixa índice órfão.
- Conflito entre edições e perda de permissão durante o formulário são tratados sem sobrescrever dados.
- Área vazia, zero, negativa, inválida e decimal com vírgula recebem o tratamento especificado.
- Exclusão com vínculo em `analises.talhaoId` é bloqueada em teste de emulador; históricos não são removidos.
- Teste Folha consulta dados reais, exige seleção ativa e mantém a foto quando houver falha no talhão.
- Mudança/inativação/exclusão entre seleção e análise não deixa a tela usar um cadastro inválido.
- Trocar o talhão não reaproveita a classificação anterior; logout limpa a seleção.
- Falta de conexão, coleção vazia e falta de permissão não são confundidas.
- Após implementar: testes de regras/funções nos emuladores, lint, tipos e validação visual dos fluxos de Admin e Funcionário no aplicativo.

## 12. Resumo das escolhas propostas para aprovação

O requisito de permissões já está definido pelo usuário. As decisões complementares recomendadas são: código único no sistema, código/nome/propriedade obrigatórios, área e localização opcionais, leitura de ativos/inativos para ambos os perfis, seleção de talhão ativo obrigatória para analisar e exclusão física somente sem vínculos, usando inativação para preservar histórico.

A implementação foi autorizada pelo usuário e concluída no escopo acima. O guia de uso e das coleções está em `TUTORIAL_TALHOES.md`.

## 13. Registro da implementação — 22/10/2026

- Tela Talhões e rota implementadas; menu e consultas disponíveis aos dois perfis, ações administrativas desativadas para Funcionário e protegidas no servidor.
- Seleção de ativos integrada ao Teste Folha, com conferência no servidor, bloqueio durante análise e contexto do resultado. Troca de usuário reinicia o estado da tela; mudança de perfil reinicia os formulários de Talhões.
- Validação de campos compartilhada pelo aplicativo e funções em `functions/talhoes-validacao.js`, evitando divergência de regras.
- Funções `cadastrarTalhao`, `alterarTalhao` e `excluirTalhao` publicadas em `safracerta-ee9ce`, região `southamerica-east1`. Funções de Usuários preservadas e atualizadas no mesmo codebase.
- 11 testes novos de Talhões e os 19 testes de Usuários passaram nos emuladores do projeto `demo-safracerta`. Incluem regras, validações, transações, repetição de operações, conflitos e vínculos com análises.
- Lint, TypeScript e exportação Android aprovados. Em produção, as três funções retornaram HTTP 401 `UNAUTHENTICATED` nos testes sem sessão. Nenhum cadastro fictício foi criado no projeto real.
- A abertura automática do aplicativo no emulador foi recusada pela revisão automática, sem motivo específico informado. Não houve tentativa de contornar o bloqueio; a inspeção visual de Admin/Funcionário permanece pendente.
- Não foi criada persistência de análises, nem alterada a API Python ou seus modelos. As coleções serão criadas automaticamente quando o Admin fizer o primeiro cadastro real.

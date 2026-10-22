# Planejamento — histórico do Teste Folha

**Data:** 22/10/2026  
**Status:** aprovado pelo usuário, implementado e publicado em 22/10/2026. O texto abaixo registra o planejamento aprovado; a configuração entregue e as instruções de uso estão em [TUTORIAL_HISTORICO_ANALISES.md](TUTORIAL_HISTORICO_ANALISES.md).

## 1. Objetivo e funcionamento esperado

Guardar cada análise iniciada no Teste Folha, incluindo talhão, usuário, foto, data, resultado e eventuais falhas. Preparar consultas para o histórico e para um dashboard posterior.

No Firestore, a estrutura equivalente à tabela será a coleção `analises`. Cada documento representará uma tentativa. Os arquivos de imagem ficarão no Cloud Storage; o documento guardará os dados e o caminho da foto.

Uma análise será registrada antes de a imagem ser enviada à API. Assim, uma falha de conexão com o modelo não fará a tentativa desaparecer do histórico.

### O que conta como uma nova tentativa

- Um acionamento válido de Analisar folha, com foto e talhão selecionados, inicia uma nova tentativa.
- Falha, ausência de folha, imagem recusada e interrupção também ficam registradas quando a tentativa já tiver sido aceita no Firebase.
- Toques enquanto o botão estiver ocupado e tentativas sem foto ou sem talhão não geram registros.
- Reenviar uma solicitação cuja confirmação se perdeu utiliza o mesmo identificador; não duplica o histórico.
- Pedir outra análise, mesmo da mesma foto no mesmo talhão, gera outro documento. Quando partir de uma tentativa anterior, guardar esse vínculo.
- Sem conseguir registrar o início no Firebase, o aplicativo não executa o modelo. Deve manter a foto, informar que a análise ainda não foi iniciada e permitir tentar novamente. Não prometer registro remoto enquanto o aparelho estiver sem conexão.

## 2. Situação conferida antes da implementação

`src/screens/TesteFolha.js` já exige um talhão ativo antes de chamar `analisarFoto`. O resultado e o contexto do talhão ficam somente no estado da tela. Sair da tela não cria histórico.

`src/services/analiseFolha.js` envia a foto para `POST /analisar`, com limite de espera de 60 segundos. A API Python processa a imagem em memória e não grava resultados ou fotos no Firebase.

O cadastro de talhões já impede a exclusão física quando encontra documentos em `analises` pelo campo `talhaoId`. O novo fluxo deverá preservar exatamente esse vínculo.

A API pode funcionar na rede local. Sua configuração padrão usa `10.0.2.2:8000` no emulador. A proposta abaixo mantém o envio do aplicativo à API existente; não faz uma Cloud Function tentar acessar esse endereço local.

## 3. Estrutura do Firebase

### Coleções utilizadas

| Estrutura | Uso nesta entrega |
| --- | --- |
| `analises/{analiseId}` | Nova coleção: um documento por tentativa, com seu estado, contexto e resultado. |
| `talhoes/{talhaoId}` | Coleção existente: validação e identificação do talhão. |
| `usuarios/{uid}` | Coleção existente: autorização e identificação de quem iniciou a análise. |
| Cloud Storage: `analises/{usuarioId}/{analiseId}/foto.{extensao}` | Foto enviada para aquela análise, com extensão conferida pelo servidor. Não é uma coleção Firestore. |

Nesta versão, não criar coleções de doenças, fotos, resultados por usuário, estatísticas ou uma segunda coleção de operações. O próprio documento de análise será usado para reconhecer solicitações repetidas. Os índices necessários serão configurações do Firestore, não coleções adicionais.

### Campos de `analises/{analiseId}`

| Campo | Tipo Firestore | Conteúdo e regra |
| --- | --- | --- |
| ID do documento | String | Identificador único de tentativa, mantido durante reenvios da mesma solicitação. Não usar matrícula, data ou nome do talhão como ID. |
| `versaoEsquema` | Number inteiro | Começa em `1`; identifica o formato do documento. |
| `tipoTeste` | String | `TESTE_FOLHA`. Permite distinguir outro tipo de teste no futuro. |
| `status` | String | `AGUARDANDO_ENVIO`, `EM_PROCESSAMENTO`, `CONCLUIDA`, `FALHOU` ou `INTERROMPIDA`. |
| `usuarioId` | String | UID autenticado, definido no servidor. |
| `usuarioSnapshot` | Map | Nome completo, matrícula e tipo do usuário no início da tentativa, lidos de `usuarios`. Não copiar senha, telefone ou e-mail. |
| `talhaoId` | String | ID permanente do documento em `talhoes`. Obrigatório e imutável após a criação. |
| `talhaoSnapshot` | Map | Código, nome, propriedade, localidade, município, UF, área e versão no momento da tentativa, lidos do banco. |
| `origemFoto` | String | `CAMERA` ou `GALERIA`, identificando o fluxo de captura do aplicativo. |
| `foto` | Map | Situação e metadados descritos abaixo. O arquivo não entra no documento Firestore. |
| `resultado` | Map ou Null | Resposta validada produzida pela API. `null` enquanto não houver classificação válida. |
| `modelo` | Map ou Null | Identificação real do classificador/pesos e versão da API, fornecida pelo servidor de inferência. |
| `erro` | Map ou Null | Código, etapa e mensagem controlada quando não houver conclusão normal. Não gravar stack trace, tokens ou endereços internos. |
| `analiseAnteriorId` | String ou Null | Tentativa da qual o usuário pediu uma nova análise. Validar que ele pode acessar esse registro. |
| `criadoEm` | Timestamp | Aceite inicial no Firebase, com relógio do servidor. |
| `iniciadoEm` | Timestamp ou Null | Momento em que a API assume o processamento. |
| `finalizadoEm` | Timestamp ou Null | Encerramento por sucesso, falha ou interrupção. |
| `atualizadoEm` | Timestamp | Última transição persistida, definida pelo servidor. |
| `expiraEm` | Timestamp | Prazo para identificar tentativas abandonadas. Não será uma regra de exclusão automática de documentos. |
| `duracaoProcessamentoMs` | Number ou Null | Tempo medido no servidor de processamento; não incluir a espera até a foto chegar. |

`usuarioSnapshot` e `talhaoSnapshot` preservam a apresentação do passado. Renomear um talhão, mudar uma matrícula ou excluir uma conta não deverá reescrever análises antigas. Campos opcionais não conhecidos continuarão vazios ou nulos conforme o cadastro; não inventar localização ou área.

### Campos de `foto`

| Campo | Tipo | Conteúdo |
| --- | --- | --- |
| `situacao` | String | `PENDENTE`, `SALVA` ou `FALHA`. |
| `caminho` | String ou Null | Caminho do objeto no Storage, definido pelo servidor. |
| `geracao` | String ou Null | Versão do objeto armazenado, para identificar o arquivo exato. |
| `tipoMime` | String ou Null | JPEG, PNG ou WebP conferido pelo conteúdo da imagem. |
| `tamanhoBytes` | Number ou Null | Tamanho real do arquivo recebido. |
| `largura` / `altura` | Number ou Null | Dimensões orientadas conforme a imagem usada pela API. |
| `sha256` | String ou Null | Hash dos bytes recebidos, calculado na API. Impede associar outra foto ao mesmo processamento em um reenvio. |

A primeira versão guardará uma cópia da foto enviada, sem criar miniaturas ou cópias anotadas adicionais. A visualização deverá respeitar a orientação EXIF usada pela API. Os limites atuais de entrada são 10 MB e 25 milhões de pixels; deverão ser conferidos novamente na implementação.

Imagens inválidas ou que nem chegaram ao servidor não terão necessariamente um arquivo salvo. Isso deverá aparecer no detalhe como Foto indisponível, sem impedir a consulta da tentativa e de seu motivo de falha.

### Campos de `resultado`

Preservar o contrato efetivamente recebido da API, com validação de tipos e limites:

| Campo | Conteúdo |
| --- | --- |
| `classe_id` | Índice da classificação no modelo utilizado. |
| `classe` | Chave técnica, como `healthy` ou `brown_spot`; base para filtros por classificação. |
| `nome_exibicao` | Nome apresentado para aquela classificação, normalizado para português quando houver tradução conhecida. |
| `pontuacao` | Número entre 0 e 1. A interface pode exibir percentual, sem mudar o valor armazenado. |
| `top3` | Até três previsões, cada uma com índice, classe, nome e pontuação. |
| Demais campos suportados | Versão da resposta, dimensões, fonte da classificação, avisos e marcações, somente quando realmente retornados pela API. |

Identificar os pesos do classificador por versão ou hash calculado ao carregar o modelo; não usar apenas o nome genérico de um arquivo `.pt` como versão. Campos ausentes não serão preenchidos com valores fictícios.

Esta entrega não altera o treinamento nem acrescenta detecção de manchas. Eventuais marcações já existentes no contrato poderão ser preservadas no resultado, sem afirmar que uma caixa da folha é uma caixa da doença.

### Exemplo resumido e ilustrativo

```text
analises / identificador-da-tentativa
  tipoTeste: TESTE_FOLHA
  status: CONCLUIDA
  usuarioId: UID de quem analisou
  usuarioSnapshot:
    nomeCompleto: Nome no momento da análise
    matricula: Matrícula no momento da análise
    tipoUsuario: FUNCIONARIO
  talhaoId: ID permanente do talhão
  talhaoSnapshot:
    codigo: TAL-002
    nome: Talhão da baixada
    propriedadeNome: Propriedade Exemplo
  foto:
    situacao: SALVA
    caminho: analises/UID/identificador-da-tentativa/foto.jpg
  resultado:
    classe: brown_spot
    nome_exibicao: Mancha-parda
    pontuacao: 0.92
  criadoEm: Timestamp do servidor
  finalizadoEm: Timestamp do servidor
```

O exemplo não representa uma análise real nem deve ser cadastrado como dado de produção.

## 4. Fluxo de gravação proposto

1. Usuário seleciona um talhão, escolhe/tira a foto e toca em Analisar folha.
2. Aplicativo bloqueia envio duplicado e mantém um identificador de operação até receber confirmação sobre aquela tentativa.
3. Chama a nova função `iniciarAnalise`. A função valida autenticação, conta ativa e tipo Admin/Funcionário.
4. Em uma transação, o servidor lê o perfil e o talhão ativo, captura os snapshots e cria `analises/{analiseId}` com `AGUARDANDO_ENVIO`. Se a mesma operação já existir, devolve o registro existente sem reiniciar seu estado ou copiar novos dados do talhão.
5. Só depois desse aceite o aplicativo envia a foto à API existente, acrescentando o ID da análise e o ID token do Firebase no cabeçalho Authorization.
6. A API valida o token e a conta, confere a autoria e o prazo da tentativa e assume seu processamento por transação. Ao assumir dentro do prazo, define um novo prazo de processamento. O ID de outra pessoa ou uma tentativa encerrada não poderá receber uma nova imagem ou outro resultado.
7. A API valida a imagem, registra seu hash e salva a foto no Storage com caminho controlado. Uma tentativa não poderá sobrescrever o arquivo de outra. Falha de armazenamento encerra a tentativa com erro antes de executar o modelo.
8. A API processa a mesma imagem e grava o resultado final diretamente no Firestore pelo SDK de servidor. O aplicativo não enviará a classificação como fonte confiável do histórico.
9. O aplicativo acompanha somente o documento da análise em andamento. Exibe conclusão e Histórico salvo quando o servidor confirmar a gravação.
10. A consulta posterior usa o documento e a foto armazenados, sem chamar novamente o modelo.

As transações cobrem o estado no Firestore. Storage e inferência são operações externas e não fazem parte da mesma transação; por isso serão tratadas por etapas, com caminho de foto fixo e estados recuperáveis.

### Responsabilidades e mudanças técnicas

| Componente | Responsabilidade proposta |
| --- | --- |
| Cloud Function `iniciarAnalise` | Autorizar, validar o talhão, criar o histórico e reconhecer repetição de solicitação. |
| API Python `POST /analisar` | Validar token e tentativa, salvar foto, executar o modelo e persistir resultado/falha. Usar Firebase Admin SDK somente no servidor. |
| Cloud Function `registrarFalhaEnvioAnalise` | Permitir que o autor encerre uma tentativa que ainda está aguardando envio, com códigos limitados de falha de conexão/cancelamento. Não aceitar resultado ou alterar tentativa que a API já assumiu. |
| Cloud Function `obterFotoAnalise` | Autorizar a consulta e emitir um endereço de leitura temporário, proposto em cinco minutos, para a foto daquela análise. |
| Função agendada `encerrarAnalisesExpiradas` | Encerrar tentativas abandonadas sem apagar documentos ou fotos. Não roda o modelo. |

Adicionar ao servidor Python a dependência Firebase Admin SDK e configurar credenciais de servidor fora do aplicativo e do repositório. Definir permissões IAM para Firestore, objetos do bucket e verificação de contas, sem conceder administração de usuários ao serviço de inferência. A função que emite links temporários precisará também das permissões de assinatura da conta de serviço.

Não mover os modelos para a Cloud Function. A API existente continua executando o modelo. Para uso fora da rede local, sua publicação com HTTPS e autenticação deverá ser configurada no ambiente de hospedagem; abrir esta integração para qualquer celular não torna o servidor local automaticamente acessível pela internet.

## 5. Estados, interrupções e reenvios

```text
AGUARDANDO_ENVIO → EM_PROCESSAMENTO → CONCLUIDA
        │                 │
        ├─ FALHOU         ├─ FALHOU
        └─ INTERROMPIDA    └─ INTERROMPIDA
```

| Situação | Tratamento |
| --- | --- |
| Resultado válido, inclusive folha saudável | `CONCLUIDA`, com resultado. Saudável não é falha. |
| Imagem inválida, nenhuma folha ou alvo ambíguo | `FALHOU`, com código e etapa específicos, sem inventar classificação. |
| API indisponível antes de assumir a tentativa | Registrar falha de envio se houver conexão com o Firebase. Caso contrário, manter a tentativa pendente até sua reconciliação. |
| Aplicativo atinge 60 segundos de espera | Consultar o registro: pode já estar concluído ou continuar em processamento. Tempo limite no celular não prova falha do modelo. |
| Usuário sai da tela depois que a API recebeu a foto | O servidor assume a conclusão e a gravação; cancelar a espera da tela não apaga a tentativa nem a declara encerrada. |
| Servidor para antes de gravar o resultado | O registro inicial permanece. Ao expirar, vira `INTERROMPIDA`, com motivo. Não fabricar o resultado perdido. |
| Confirmação se perde depois de salvar | Consultar/repetir a mesma operação e recuperar o registro, sem criar outro documento ou repetir uma inferência já concluída. |
| Mesmo ID reenviado durante processamento | Devolver que a tentativa já está em andamento, sem iniciar processamento paralelo. |
| Usuário pede Tentar novamente depois de falha terminal | Criar nova tentativa com `analiseAnteriorId`, preservando a anterior. |

Proposta inicial: prazo de dez minutos por tentativa e reconciliação a cada cinco minutos. A tarefa buscará apenas registros pendentes vencidos, com paginação. Ao encerrar, fará transação para não substituir uma conclusão simultânea. Os valores poderão ser ajustados conforme o tempo real da API e sua capacidade.

Gravações finais também conferirão o estado atual: uma resposta atrasada não poderá reabrir uma tentativa já encerrada. Reenvios de resultado poderão recuperar uma conclusão já confirmada, mas não trocar seu conteúdo. Não repetir automaticamente a inferência após uma interrupção sem confirmação do usuário.

O hash da foto, a existência do objeto e sua geração permitirão reconhecer um upload já realizado. Se o servidor cair entre salvar o arquivo e registrar seus metadados, a reconciliação deverá recuperar a referência para que o arquivo não fique sem vínculo no histórico.

## 6. Talhões e usuários depois da análise

- A criação da tentativa deverá ler o talhão na mesma transação que cria a análise. Essa leitura coordena a criação do vínculo com uma exclusão simultânea.
- Qualquer tentativa persistida com `talhaoId`, mesmo falha ou interrompida, já constitui histórico e impede a exclusão física daquele talhão pelo fluxo existente. Admin poderá inativá-lo.
- Inativar ou renomear o talhão depois do aceite da tentativa não altera o snapshot nem exige descartar o processamento já aceito.
- A exclusão de uma conta não apagará o histórico. O UID e o snapshot identificam a autoria passada; o antigo usuário perde o acesso à conta.
- Nesta entrega, ninguém altera manualmente a classificação, a pontuação, o talhão ou a autoria de uma tentativa encerrada. Uma nova análise será outro registro.
- Não incluir exclusão de histórico na primeira versão. Preservar os registros até definição expressa de retenção ou descarte.

## 7. Permissões propostas

Estas permissões foram aprovadas e configuradas na entrega de 22/10/2026.

| Ação | Funcionário ativo | Admin ativo |
| --- | --- | --- |
| Iniciar análise em talhão ativo | Sim | Sim |
| Ver histórico e detalhe | Somente suas tentativas | Todas as tentativas |
| Ver a foto | Somente de suas tentativas | De todas as tentativas |
| Consultar falhas e interrupções | Somente suas tentativas | Todas as tentativas |
| Alterar resultado ou contexto encerrado | Não | Não |
| Apagar histórico | Não nesta versão | Não nesta versão |

Contas inativas, com pendências ou tipos não reconhecidos não terão acesso. As permissões do histórico são próprias: poder visualizar um talhão não concede acesso automático às análises de outros funcionários.

### Firestore

Adicionar um bloco para `analises/{analiseId}` com leitura para Admin ativo ou para o próprio autor ativo. Escritas diretas do aplicativo continuarão bloqueadas; Cloud Functions e a API autenticada de servidor serão responsáveis pelas gravações.

Funcionário deverá consultar com `where("usuarioId", "==", uid)`. Regras não filtram automaticamente uma consulta de toda a coleção. Admin poderá consultar todos dentro dos filtros e limites previstos. Preservar os blocos de Usuários, Talhões e login por matrícula.

### Storage

Os uploads serão feitos pelo servidor da API. O aplicativo não terá permissão de gravar, sobrescrever ou excluir arquivos diretamente. A consulta usará `obterFotoAnalise`, que confere perfil e autoria antes de assinar um endereço temporário.

Guardar apenas caminho e geração no documento, sem URL pública permanente ou token de download. A função recebe o ID da análise e busca o caminho autorizado no banco; não aceita um caminho arbitrário de arquivo. Links temporários concedem acesso a quem os possui até expirarem; não persistir esses links nem compartilhá-los como identificador da foto. A mesma regra vale após mudança de permissão: links já emitidos podem funcionar até o vencimento curto.

As regras Firestore e Storage são separadas. O tutorial final deverá trazer os arquivos exatos para publicação e as permissões IAM utilizadas pelos serviços de servidor.

## 8. Tela Histórico e mudanças no Teste Folha

Adicionar Histórico ao menu de Admin e Funcionário. Histórico será uma consulta de registros, sem formulário de cadastro/edição/exclusão semelhante ao de Usuários.

### Teste Folha

- Manter a seleção atual de talhão e foto.
- Ao iniciar, apresentar as etapas Registrando análise, Enviando foto, Analisando e Histórico salvo.
- Só confirmar salvamento após confirmação do banco. Se a classificação aparecer antes da confirmação, informar Salvando histórico; não chamar isso de salvo.
- Resultado concluído terá data, talhão, classificação, pontuação e ação Ver no histórico.
- Quando a tentativa continuar no servidor, oferecer Acompanhar no histórico. Ao reabrir o aplicativo, o usuário poderá encontrá-la pela lista.
- Trocar a foto, sair da conta ou abrir outra análise não poderá misturar respostas, fotos ou talhões entre tentativas.
- Toda conclusão será recuperável por ID quando o histórico tiver sido confirmado. Testes anteriores à integração, que só existiam na memória da tela, não podem ser reconstruídos automaticamente.

### Lista e detalhe

```text
← Histórico

[ Período ] [ Talhão ] [ Situação ]
[ Classificação ]
Admin: filtro adicional por usuário

22/10/2026 10:35 — Concluída
TAL-002 — Talhão da baixada
Mancha-parda — pontuação 92%
                                        Ver análise

22/10/2026 10:31 — Falhou
TAL-002 — Talhão da baixada
Nenhuma folha identificada
                                        Ver tentativa
```

Lista com as mais recentes primeiro, páginas de vinte registros e ação Carregar mais. Sem baixar todas as fotos ou a coleção inteira para montar a tela. No detalhe: foto quando disponível, datas, usuário, dados históricos do talhão, resultado/top três ou motivo de falha, modelo utilizado e opção Nova análise.

Filtros iniciais: período, talhão, situação e classe; Admin terá também usuário. Não incluir pesquisa textual ampla nesta etapa. Talhões inativos com histórico continuam disponíveis nos filtros.

### Direção de design

Aplicar a skill `.agents/skills/frontend-design/SKILL.md` e seguir `GabrielCasagrande/GabrielCasagrande/ETICA-DESENVOLVIMENTO.md` na implementação.

Preservar a identidade agrícola existente: verde `#1B5E20`, fundo `#F7F8F4`, branco `#FFFFFF`, texto `#1A1C19` e secundário `#596155`. Fonte nativa, conteúdo à esquerda e prioridade para data, talhão e classificação. Usar linhas agrupadas por data, sem criar um dashboard decorativo dentro da lista.

Situações terão texto legível, além de cor. Erro técnico e previsão de uma condição na folha não usarão a mesma apresentação. Ações com área de toque de pelo menos 48 pontos, texto ampliável, rolagem e estados distintos para carregamento, ausência de análises, filtro sem resultados e falha de consulta.

## 9. Preparação para o dashboard

A coleção permitirá consultar volume de tentativas e conclusões por período, talhão e usuário; distribuição por classe; falhas por motivo; pontuações e tempos de processamento.

Usar apenas `CONCLUIDA` nos gráficos de classificação. Falhas, interrupções e pendências compõem indicadores operacionais separados. Uma nova análise intencional da mesma foto conta como outra tentativa, sem afirmar que representa outra planta.

Pontuação do modelo não mede gravidade, porcentagem de área doente ou incidência real na lavoura. Não calcular hectares afetados multiplicando a área do talhão pela pontuação. Doença, praga e dano ambiental também não deverão ser agrupados como se fossem a mesma condição sem um catálogo aprovado.

Nesta entrega, preparar os dados e as consultas; a construção do dashboard fica para a etapa seguinte. Começar com consultas filtradas e agregações do Firestore. Resumos diários ou mensais só serão adicionados quando volume e requisitos do dashboard justificarem essa manutenção.

### Índices e limites

Adicionar `firestore.indexes.json` ao projeto e vinculá-lo ao `firebase.json`. Publicar índices conforme as combinações realmente oferecidas pelos filtros.

Prever consultas ordenadas por `criadoEm` decrescente, combinando esse campo com `usuarioId`, `talhaoId`, `status` e `resultado.classe`. Funcionário acrescenta sempre `usuarioId`. A reconciliação usará estado pendente e `expiraEm`. Combinações extras deverão ser testadas; um único índice não atende automaticamente todas as consultas.

Desabilitar indexação dos mapas grandes sem uso em filtros, como top três, marcações e dados de erro detalhados. Preservar os campos usados nas consultas. Encerrar listeners ao sair da tela ou trocar de conta; não manter um listener global de todo o histórico.

## 10. Implementação após aprovação

1. Definir validadores, campos e índices; criar as funções de início, falha de envio, foto temporária e reconciliação.
2. Configurar bucket, regras Storage e credenciais/IAM dos servidores. Não colocar credenciais no Expo nem no Git.
3. Adaptar a API Python para autenticação, persistência da foto e encerramento confiável do documento, mantendo a classificação atual.
4. Integrar o Teste Folha ao novo fluxo, incluindo identidade da tentativa, listener e recuperação por ID.
5. Criar lista e detalhe de Histórico, com permissões e filtros propostos.
6. Testar a integração em ambiente local/emuladores, publicar os componentes aprovados e conferir o fluxo com dados autorizados.
7. Entregar `TUTORIAL_HISTORICO_ANALISES.md`, com campos, regras, índices, configuração da API, publicação e onde acompanhar o uso.

Arquivos previstos: `src/screens/TesteFolha.js`, `src/services/analiseFolha.js`, novos serviços/telas/rotas de histórico, menu e navegação, `functions/index.js` e arquivos específicos de análises se necessários, testes, `firestore.rules`, novo `storage.rules`, novo `firestore.indexes.json`, `firebase.json`, servidor Python e suas dependências/documentação. Separar somente o necessário para manter o código legível; não criar uma arquitetura genérica de histórico.

### Verificações de aceite

- Um clique válido gera um documento, foto vinculada quando recebida e resultado ou motivo de falha.
- Reenvio da mesma operação não duplica documentos, não troca a foto nem reinicia resultado concluído.
- Duas requisições simultâneas não executam a mesma tentativa em paralelo.
- Fechar a tela e abrir o histórico recupera o estado confirmado pelo servidor.
- Falha de API, Storage ou Firestore não produz falso aviso Histórico salvo.
- Falta de folha é registrada sem classificação inventada; folha saudável é conclusão válida.
- Tentativas abandonadas são encerradas sem substituir conclusão simultânea.
- Funcionário não consulta documentos ou fotos de outra pessoa, inclusive por ID direto; Admin ativo consulta todas.
- Conta revogada ou inativa não inicia operações nem recebe novos links de foto.
- Renomear/inativar talhão ou excluir usuário preserva o contexto histórico.
- Exclusão de talhão concorre corretamente com criação de análise e fica bloqueada quando há vínculo.
- Filtros, índices, paginação, orientação da imagem e troca de conta são verificados.
- Regressão de Usuários/Talhões, lint, tipos, testes da API e compilação Android passam.

## 11. Configuração, uso e decisões para aprovação

O primeiro registro aceito criará a coleção `analises` automaticamente. Não é necessário criar documentos de exemplo no Console. O bucket Storage precisa estar configurado, além de regras, IAM, índices e funções. A integração de servidor Python também precisa ser atualizada; publicar apenas as regras não implementa o histórico.

Haverá uso de documentos, leituras, gravações, armazenamento/transferência de fotos, funções e tarefa agendada. Não prometer gratuidade com base apenas na quantidade de análises. Manter os limites descritos e orientar a consulta de uso no Firebase/Google Cloud no tutorial final. Não haverá descarte automático de dados nesta primeira proposta.

Decisões aprovadas e implementadas: guardar a foto, registrar também falhas/interrupções, Funcionário consultar apenas as próprias análises, Admin consultar todas e não permitir edição/exclusão de histórico. O dashboard permanece para uma próxima etapa.

## 12. Referências técnicas

- [Modelo de documentos e criação de coleções no Firestore](https://firebase.google.com/docs/firestore/data-model).
- [Transações e gravações em lote](https://firebase.google.com/docs/firestore/manage-data/transactions).
- [Verificação de ID tokens no servidor](https://firebase.google.com/docs/auth/admin/verify-id-tokens).
- [Cloud Storage pelo SDK de servidor](https://firebase.google.com/docs/storage/admin/start).
- [Consultas e regras de acesso](https://firebase.google.com/docs/firestore/security/rules-query).
- [Funções agendadas](https://firebase.google.com/docs/functions/schedule-functions).
- [Agregações do Firestore](https://firebase.google.com/docs/firestore/query-data/aggregation-queries).

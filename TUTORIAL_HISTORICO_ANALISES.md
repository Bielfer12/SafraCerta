# Histórico de análises — uso e configuração

## Entrega e validação em 22/10/2026

O aplicativo, a API e a configuração Firebase foram atualizados. As quatro funções estão ativas em `safracerta-ee9ce`, os 16 índices estão prontos e as regras Firestore/Storage foram publicadas. O agendamento para encerrar tentativas expiradas está habilitado a cada cinco minutos.

O serviço Windows `SafraCertaAPI` foi reiniciado com a autorização do usuário. A API responde com versão `3.0.0`, `historico_obrigatorio: true` na saúde e HTTP 401 para análise sem autenticação. As credenciais do servidor ficam fora do repositório.

Passaram 77 testes distintos: 41 de funções e permissões nos emuladores, 16 da API, 6 de integração Python com Firebase emulado e 14 de utilitários/sessão do aplicativo. Lint, tipos e exportação Android também passaram. A lista vazia e o seletor de classificação foram conferidos visualmente no Android; o detalhe com dados reais ainda depende de uma nova análise feita pelo usuário. Nenhum registro fictício foi criado em produção.

Recarregue o aplicativo pelo Expo para receber as novas telas. O histórico começa nas novas análises; a coleção aparece automaticamente quando o primeiro início é aceito.

## O que passa a ser armazenado

Cada início aceito no Teste Folha cria um documento em `analises`. O registro existe antes de enviar a foto ao modelo. Uma análise concluída guarda o resultado e a foto; falhas e interrupções também permanecem no histórico, sem classificação inventada.

O primeiro uso cria a coleção automaticamente. Não criar registros de exemplo no banco real nem cadastrar uma conta Auth para a análise.

## Usar no aplicativo

1. Entre com uma conta Admin ou Funcionário ativa.
2. Abra Teste Folha, selecione um talhão ativo e escolha uma imagem pela câmera ou galeria.
3. Toque no botão de análise. A tela mostra o registro inicial, o envio e o processamento.
4. Após confirmação do servidor, o resultado mostra Histórico salvo e Ver no histórico.
5. Pelo menu Histórico, consulte tentativas anteriores, resultados, fotos e motivos de falha.

Admin consulta todas as tentativas e pode filtrar por usuário. Funcionário consulta somente as próprias. Há filtros de período, talhão, situação e classificação, com páginas de vinte registros. Para filtrar uma conta removida, Admin pode informar o UID que aparece no detalhe de uma análise antiga.

Nova análise inicia outro registro, vinculado à tentativa anterior quando acionado no detalhe. Reenviar a mesma solicitação cuja confirmação se perdeu conserva o identificador e não duplica o histórico.

Um tempo limite no celular não significa que o servidor falhou: consulte o histórico antes de repetir. Tentativas abandonadas são encerradas por uma tarefa executada a cada cinco minutos, após um prazo de dez minutos sem conclusão. O prazo é renovado quando a API assume o processamento.

## Coleções e campos

A única coleção nova é `analises/{analiseId}`. `talhoes`, `usuarios` e suas coleções técnicas existentes continuam com suas finalidades atuais. Fotos ficam no Storage.

| Campo principal | Tipo | Finalidade |
| --- | --- | --- |
| `versaoEsquema` | Number inteiro | `1`, versão do formato armazenado. |
| `tipoTeste` | String | `TESTE_FOLHA`. |
| `status` | String | `AGUARDANDO_ENVIO`, `EM_PROCESSAMENTO`, `CONCLUIDA`, `FALHOU` ou `INTERROMPIDA`. |
| `usuarioId` | String | UID autenticado do autor. |
| `usuarioSnapshot` | Map | `nomeCompleto`, `matricula` e `tipoUsuario` no início da tentativa. |
| `talhaoId` | String | ID permanente do talhão. |
| `talhaoSnapshot` | Map | `codigo`, `nome`, `propriedadeNome`, `localidade`, `municipio`, `uf`, `areaHa` e `versao` no início da tentativa. |
| `origemFoto` | String | `CAMERA` ou `GALERIA`. |
| `foto` | Map | Situação, caminho, geração, tipo MIME, tamanho em bytes, largura, altura e SHA-256 da foto. Valores desconhecidos começam como `null`. |
| `resultado` | Map ou Null | Classe técnica, nome retornado, pontuação, top três e demais dados validados da API. Não usar em gráficos enquanto não houver conclusão. |
| `modelo` | Map ou Null | Nome, hash dos pesos do classificador e versão da API. |
| `erro` | Map ou Null | `codigo`, `etapa` e `mensagem` controlada da falha. |
| `analiseAnteriorId` | String ou Null | Tentativa que originou uma nova análise. |
| `criadoEm` | Timestamp | Aceite inicial no servidor. |
| `iniciadoEm` | Timestamp ou Null | Início do processamento na API. |
| `finalizadoEm` | Timestamp ou Null | Encerramento da tentativa. |
| `atualizadoEm` | Timestamp | Última atualização de estado. |
| `expiraEm` | Timestamp | Prazo usado pela reconciliação; não exclui o documento. |
| `duracaoProcessamentoMs` | Number ou Null | Tempo no servidor, sem o envio inicial da foto pelo aplicativo. |

`foto.situacao` pode ser `PENDENTE`, `SALVA` ou `FALHA`. Uma foto que não chegou à API ou foi recusada pode estar indisponível, mantendo o restante da tentativa consultável.

Renomear um usuário ou talhão não reescreve os snapshots. Qualquer análise vinculada, inclusive falha, impede a exclusão física do talhão pelo cadastro existente; use Inativo para preservar o histórico. Não há edição ou exclusão do histórico nesta entrega.

## Fotos e permissões

O bucket usado é `safracerta-ee9ce.firebasestorage.app`, na região `southamerica-east1`. Caminho de cada foto:

```text
analises/{usuarioId}/{analiseId}/foto.jpg
```

PNG e WebP usam suas próprias extensões, conferidas pelo servidor. O documento guarda o caminho e a geração do objeto. Não armazena imagem em Base64 ou URL pública permanente.

As regras Storage bloqueiam acesso direto do aplicativo. A função `obterFotoAnalise` confere conta e autoria e gera um endereço de leitura válido por cinco minutos. No detalhe, Atualizar acesso à foto emite outro endereço. Um endereço já emitido pode funcionar até expirar, mesmo após uma alteração de permissão.

As regras Firestore permitem que um Admin ativo consulte todas as análises e que um Funcionário ativo consulte as próprias. Escritas diretas ficam bloqueadas, inclusive para Admin. O aplicativo usa funções para iniciar a tentativa; a API Python grava a foto e o resultado com credenciais de servidor.

Os arquivos de regras completos são `firestore.rules` e `storage.rules`. Os índices estão em `firestore.indexes.json`, vinculados no `firebase.json`. Não substituir essas proteções por `allow write: if true`.

## Servidor Python

A API agora exige ID token do Firebase e `analise_id` junto da foto. Uma API antiga que apenas classifica a imagem não completa o histórico. Não colocar credenciais administrativas no aplicativo ou em variáveis `EXPO_PUBLIC_*`.

Nesta máquina, as credenciais do serviço ficam fora do repositório, em `C:\ProgramData\SafraCerta\firebase-api.json`, com permissões limitadas no Windows. A conta de serviço é `safracerta-analises-api@safracerta-ee9ce.iam.gserviceaccount.com`.

Permissões usadas: leitura/escrita Firestore, consulta de contas Auth e criação/leitura de objetos somente no bucket configurado. Ela não recebe administração de usuários. A conta de execução das Cloud Functions recebe leitura de objetos no bucket e permissão para assinar seus próprios links temporários.

Para outra máquina, configure credenciais de servidor autorizadas pelo administrador fora do Git e informe as variáveis abaixo. A credencial existente desta máquina não é um arquivo de exemplo para distribuir.

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS='CAMINHO_FORA_DO_PROJETO\credencial-api.json'
$env:GOOGLE_CLOUD_PROJECT='safracerta-ee9ce'
$env:SAFRACERTA_STORAGE_BUCKET='safracerta-ee9ce.firebasestorage.app'
```

Na pasta `deep_learning/SafraCerta_API/api_modelo`:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app:app --host 0.0.0.0 --port 8000 --workers 1
```

Nesta máquina, o serviço Windows SafraCertaAPI usa a mesma pasta e possui essas variáveis no XML do serviço. Após atualizar os arquivos ou as variáveis, reinicie o serviço:

```powershell
Restart-Service SafraCertaAPI
Invoke-RestMethod http://127.0.0.1:8000/saude
```

A saúde deve retornar `historico_obrigatorio: true`. O contrato de resultado continua na versão 2; a versão do serviço passou para 3.0.0. A integração não treina ou troca os modelos atuais.

No emulador Android, o endereço padrão do aplicativo é `http://10.0.2.2:8000/docs`. Para celular físico, configure `EXPO_PUBLIC_API_DOCS_URL` com o endereço acessível da API. Ela continua dependendo de o servidor estar ligado. Uso público exige endereço HTTPS e a configuração de hospedagem correspondente.

## Publicar o Firebase

Com o projeto e a conta autorizados, na raiz do repositório:

```powershell
$env:FUNCTIONS_DISCOVERY_TIMEOUT='120'
.\functions\node_modules\.bin\firebase.cmd deploy --config firebase.json --project safracerta-ee9ce --only "functions:usuarios:iniciarAnalise,functions:usuarios:registrarFalhaEnvioAnalise,functions:usuarios:obterFotoAnalise,functions:usuarios:encerrarAnalisesExpiradas,firestore,storage" --non-interactive
```

As quatro funções pertencem ao codebase existente `usuarios` e ficam em `southamerica-east1`. As três primeiras são callable; `encerrarAnalisesExpiradas` é agendada. Os índices podem levar algum tempo para ficar prontos. Publicar regras sozinho não atualiza o servidor Python nem o aplicativo.

## Verificar em ambiente de testes

Use Java 21 ou versão compatível para os emuladores. Na pasta `functions`:

```powershell
npm run test:emulators
```

Esse comando usa exclusivamente `demo-safracerta`. Os testes criam contas, fotos e documentos locais. Não apontar as variáveis de emuladores para serviços de produção.

Para os testes Python de unidade, na pasta da API:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m unittest test_app
```

Para a integração Python, mantenha os emuladores Auth, Firestore e Storage ligados e execute na pasta da API, depois dos testes Node, sem executar as duas suítes simultaneamente:

```powershell
$env:GCLOUD_PROJECT='demo-safracerta'
$env:GOOGLE_CLOUD_PROJECT='demo-safracerta'
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'
$env:FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099'
$env:FIREBASE_STORAGE_EMULATOR_HOST='127.0.0.1:9199'
$env:STORAGE_EMULATOR_HOST='http://127.0.0.1:9199'
.\.venv\Scripts\python.exe -m unittest test_historico_emuladores
```

Abra outro terminal sem essas variáveis para executar o servidor de produção. Os modelos são simulados nos testes de integração; as leituras/gravações em Firebase usam os emuladores reais.

## Acompanhar uso e preparar o dashboard

- Firestore Database → Uso: operações e armazenamento de documentos/índices.
- Storage → Uso: volume de fotos e transferência.
- Functions e Google Cloud Logging: execução e falhas das funções.
- Google Cloud Scheduler: execução da reconciliação.
- Faturamento → Relatórios: custos consolidados do projeto e conta Blaze.

As fotos e operações consomem os serviços contratados. A entrega não configura descarte automático. O histórico inicia com as novas tentativas; testes antigos mantidos apenas na memória não podem ser recuperados.

Para o dashboard, filtrar `status == CONCLUIDA` antes de agrupar por classificação. Falhas e interrupções pertencem aos indicadores operacionais. Pontuação do modelo não mede gravidade ou porcentagem de área afetada; uma análise não equivale necessariamente a uma planta diferente.

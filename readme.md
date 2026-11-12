# SafraCerta

Aplicativo mobile de diagnóstico para o cultivo do fumo. O agricultor fotografa uma folha pelo celular, um modelo de visão computacional analisa a imagem e o aplicativo mostra a doença mais provável, guardando cada análise no histórico do talhão.

Projeto desenvolvido como **Projeto Integrador**.

## Sumário

- [Sobre o projeto](#sobre-o-projeto)
- [Equipe](#equipe)
- [Funcionalidades](#funcionalidades)
- [Como funciona](#como-funciona)
- [Tecnologias](#tecnologias)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Como rodar](#como-rodar)
- [Testes](#testes)
- [Modelos de IA](#modelos-de-ia)
- [Documentação complementar](#documentação-complementar)
- [Licença](#licença)

## Sobre o projeto

Pequenos produtores de fumo dependem diretamente dessa cultura para o sustento da família. É comum as plantas apresentarem manchas, amarelamento ou murchamento nas folhas, sintomas que podem indicar doenças ou pragas.

Sem conhecimento técnico e sem acesso fácil a um técnico agrícola na região, o agricultor muitas vezes só percebe o problema quando ele já se espalhou. As decisões acabam sendo tomadas por tentativa e erro, o que gera atraso no tratamento, gasto com insumos aplicados de forma inadequada e, nos casos mais graves, perda de parte da colheita.

O SafraCerta propõe encurtar esse caminho: a foto da folha é analisada na hora e o resultado chega direto no celular, como apoio à próxima decisão do agricultor.

### Beneficiário

O projeto foi desenvolvido com base na realidade de **Flávio Borghezan Zanelato**, agricultor de fumo em Grão Pará/SC (IE 01.126.313-0), cuja produção depende do cultivo de fumo como principal fonte de renda.

## Equipe

- Ana Paula Bet Gesser
- Gabriel Fillipe Casagrande Fernandes
- Guilherme Rabello Carrer
- Laís Kaminski Casagrande
- Nathan Rocha Gomes

## Funcionalidades

- **Diagnóstico da folha:** foto pela câmera ou pela galeria, com a classificação mais provável, as três hipóteses principais e a pontuação de cada uma.
- **Localização na foto:** a folha analisada é marcada sobre a imagem. A marcação de lesões está ligada em caráter experimental.
- **Talhões:** cadastro e consulta dos talhões da propriedade. Toda análise fica ligada a um talhão.
- **Histórico:** lista das análises feitas, com filtros por período, talhão, situação, classificação e usuário, e a tela de detalhe de cada uma.
- **Usuários:** cadastro e gerenciamento das contas.
- **Acesso por perfil:** o login é feito por matrícula e senha. O Funcionário acessa Home, Teste folha, Talhões e Histórico. O Admin acessa também Usuários.
- **Resumo no Início:** a Home mostra o total de tentativas, a taxa de conclusão e as classificações mais frequentes do período, com filtros e detalhes por talhão, usuário e falha. O Funcionário vê só as próprias análises; o Admin vê todas.

## Como funciona

1. O usuário escolhe o talhão e fotografa a folha no aplicativo.
2. O aplicativo registra a tentativa no Firebase e envia a foto para a API de análise.
3. A API confere a conta do usuário, localiza a folha na imagem e classifica a doença.
4. A foto e o resultado são salvos no histórico, e o aplicativo mostra o diagnóstico.

```text
Aplicativo (Expo / React Native)
   │
   ├── Firebase: login, banco de dados, fotos e funções de servidor
   │
   └── API de análise (Python / FastAPI) ── modelos YOLO de classificação e detecção
```

## Tecnologias

| Camada | Tecnologia |
| --- | --- |
| Aplicativo mobile | React Native 0.86 com Expo SDK 57 e Expo Router |
| Autenticação | Firebase Authentication |
| Banco de dados | Cloud Firestore |
| Armazenamento das fotos | Firebase Storage |
| Regras de negócio no servidor | Cloud Functions (Node.js 22), região `southamerica-east1` |
| API de análise | Python 3.11, FastAPI e Uvicorn |
| Modelos de IA | Ultralytics YOLO (classificação e detecção), executados em CPU |
| Treinamento | Notebooks no Google Colab e no Kaggle |
| Design e prototipagem | Figma e Stitch |
| Versionamento e tarefas | GitHub e GitHub Projects |

## Estrutura do repositório

```text
SafraCerta/
├── src/
│   ├── app/            Rotas do aplicativo (Expo Router)
│   ├── screens/        Telas
│   ├── components/     Componentes usados em mais de uma tela
│   ├── services/       Comunicação com o Firebase e com a API
│   ├── context/        Sessão do usuário logado
│   └── utils/          Funções de apoio
├── functions/          Cloud Functions (usuários, talhões e análises)
├── deep_learning/
│   ├── SafraCerta_API/ API de análise e serviço do Windows
│   ├── modelos/        Pesos usados pela API
│   ├── notebooks/      Preparação dos dados e treinamentos
│   ├── entrega/        Modelo de classificação e relatório de avaliação
│   └── resultados/     Pacotes gerados pelos treinamentos
├── tests/              Testes do aplicativo
├── firestore.rules     Regras de acesso do banco
├── storage.rules       Regras de acesso das fotos
└── firebase.json       Configuração do Firebase e dos emuladores
```

## Como rodar

O sistema tem duas partes que precisam estar no ar: o **aplicativo** e a **API de análise**. O Firebase já fica na nuvem.

### Pré-requisitos

- [Node.js 22](https://nodejs.org/)
- [Python 3.11](https://www.python.org/) de 64 bits (somente para a API de análise)
- Windows com permissão de administrador, para criar o serviço da API com o WinSW (o WinSW já vem no repositório)
- Aplicativo **Expo Go** no celular, ou o Android Studio com um emulador
- Acesso ao projeto do Firebase: peça a um integrante da equipe os dois arquivos que não ficam no repositório (ver abaixo)

### 1. Baixar o projeto e instalar as dependências

```bash
git clone https://github.com/Bielfer12/SafraCerta.git
cd SafraCerta
npm install
cd functions
npm install
cd ..
```

### 2. Configurar o Firebase no aplicativo

Crie o arquivo `.env.local` na raiz do projeto com as chaves do Firebase. Ele não vai para o GitHub.

-- Pedir para alguem do grupo o .env.local.

### 3. Subir a API de análise

A API roda no Windows como um serviço, chamado **SafraCerta API**, que inicia junto com o computador e fica ligado sem janela aberta. Quem cria e controla esse serviço é o [WinSW](https://github.com/winsw/winsw), um programa que transforma qualquer executável em serviço do Windows. Ele já vem no repositório, não precisa baixar:

- `deep_learning\SafraCerta_API\SafraCertaServico.exe` é o WinSW.
- `deep_learning\SafraCerta_API\SafraCertaServico.xml` é a configuração: qual Python usar, a porta 8000, a credencial do Firebase e os modelos.

**a) Instalar as dependências da API.** Na pasta `deep_learning\SafraCerta_API\api_modelo`, execute `instalar_windows.bat` uma vez. Ele cria o ambiente Python (`.venv`) e instala as dependências.

**b) Guardar a credencial do Firebase.** A API grava as fotos e os resultados no Firebase, por isso precisa de uma credencial de servidor (um arquivo `.json` de conta de serviço). Peça o arquivo a um integrante da equipe e salve exatamente neste caminho, que é o que o serviço procura:

```text
C:\ProgramData\SafraCerta\firebase-api.json
```

Esse arquivo é uma senha de acesso ao projeto. Ele fica fora da pasta do repositório e nunca vai para o GitHub.

**c) Criar e iniciar o serviço.** Abra o PowerShell **como administrador** e execute:

```powershell
cd C:\caminho\do\SafraCerta\deep_learning\SafraCerta_API
.\SafraCertaServico.exe install
.\SafraCertaServico.exe start
```

**d) Conferir.** Espere cerca de um minuto e abra `http://127.0.0.1:8000/saude` no navegador. A API está pronta quando a página responder.

Comandos do dia a dia, sempre no PowerShell como administrador e na mesma pasta:

| Para | Comando |
| --- | --- |
| Ver se está rodando | `.\SafraCertaServico.exe status` |
| Parar | `.\SafraCertaServico.exe stop` |
| Reiniciar (depois de editar o `.xml` ou trocar um modelo) | `.\SafraCertaServico.exe restart` |
| Remover o serviço | `.\SafraCertaServico.exe uninstall` |

Se o serviço não subir, o motivo fica registrado em `deep_learning\SafraCerta_API\logs`. As causas mais comuns são a credencial fora do caminho acima e a porta 8000 já em uso. Antes de remover o serviço, feche a janela "Serviços" do Windows, senão a remoção fica pendente.

Para um teste rápido sem criar o serviço, dá para abrir a API em uma janela: defina a credencial com `$env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\ProgramData\SafraCerta\firebase-api.json'` e execute `iniciar_windows.bat`. Nesse modo a API para quando a janela fecha e a detecção de lesões fica desligada. Não use os dois modos ao mesmo tempo, porque ambos ocupam a porta 8000.

Mais detalhes em [deep_learning/SafraCerta_API/api_modelo/README.md](deep_learning/SafraCerta_API/api_modelo/README.md).

### 4. Rodar o aplicativo

```bash
npx expo start -c
```

- **Emulador Android:** pressione `a` no terminal. O aplicativo já procura a API em `http://10.0.2.2:8000`, que é o endereço do computador visto pelo emulador.
- **Celular físico:** leia o QR Code com o Expo Go. O celular e o computador precisam estar na mesma rede, e o aplicativo precisa saber o IP do computador. Acrescente no `.env.local`, trocando pelo IP da sua máquina:

```env
EXPO_PUBLIC_API_DOCS_URL=http://192.168.0.10:8000/docs
```

### 5. Entrar no aplicativo

O acesso é por matrícula e senha. As contas são criadas por um usuário Admin, na tela Usuários. Para o primeiro acesso, peça uma conta a um integrante da equipe.

## Modelos de IA

| Modelo | O que faz | Situação |
| --- | --- | --- |
| Classificação (`best_classificao.pt`) | Indica a doença mais provável entre 16 classes | Acurácia de 83,24% no conjunto de teste (Top-1) |
| Detecção de folha (`best_deteccao.pt`) | Localiza a folha na foto antes de classificar | Treinado com poucas imagens; em uso como filtro de entrada |
| Detecção de lesões (`best_lesoes.pt`) | Marca regiões suspeitas na folha | Piloto experimental, treinado com 20 imagens |

As 16 classes vêm do conjunto de dados público TPDD e incluem a folha saudável e doenças como antracnose, canela-preta, mancha-parda, mancha-alvo, mancha olho-de-rã, queima bacteriana e as viroses TMV, CMV, PVY e TSWV.

O resultado é um apoio à decisão e não substitui a avaliação de um técnico agrícola. A acurácia acima foi medida nas imagens do conjunto de dados, e não em fotos tiradas no campo com o aplicativo.

## Documentação complementar

- [deep_learning/README.md](deep_learning/README.md) — conjuntos de dados e preparação das imagens
- [deep_learning/entrega/RELATORIO_AVALIACAO.md](deep_learning/entrega/RELATORIO_AVALIACAO.md) — avaliação do modelo de classificação
- [deep_learning/SafraCerta_API/api_modelo/README.md](deep_learning/SafraCerta_API/api_modelo/README.md) — API de análise, serviço do Windows e detector de lesões
- [functions/README.md](functions/README.md) — Cloud Functions, regras e publicação no Firebase

## Licença

Projeto de uso acadêmico, desenvolvido para fins de Projeto Integrador.

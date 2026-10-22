# SafraCerta — classificação e localização da folha

A API usa os dois pesos em `deep_learning/modelos/`: `best_classificao.pt` para as 16 classes e `best_deteccao.pt` para localizar a **folha inteira**. O detector disponível tem somente a classe `folha`; suas caixas não localizam manchas ou doenças.

O TesteFolha já envia a foto uma vez, mostra a classificação e desenha a caixa sobre a imagem. Os controles permitem ocultar as marcações e ampliar a foto sem repetir a inferência. A classificação continua usando a imagem completa: a adoção de recortes depende de uma comparação com imagens rotuladas, pois caixas do piloto podem cortar bordas da folha.

## Instalação no Windows

A versão 3.0.0 exige histórico registrado, autenticação Firebase e acesso de servidor ao Firestore/Storage. Configure as credenciais fora do repositório antes de iniciar, conforme `TUTORIAL_HISTORICO_ANALISES.md`, na raiz. O aplicativo registra a tentativa pela função `iniciarAnalise` e envia `analise_id` e o ID token do usuário junto da foto. A API salva a foto e o resultado no servidor; repetir uma tentativa em andamento/concluída não executa o modelo novamente.

1. Instale Python 3.11 de 64 bits com o launcher `py`.
2. Abra `instalar_windows.bat` nesta pasta. Ele cria `.venv`, atualiza pip e instala PyTorch 2.11.0/torchvision 0.26.0 para CPU e as dependências. A primeira instalação exige internet.
3. Abra `iniciar_windows.bat` e espere `Application startup complete`. Mantenha o computador ligado e sem suspensão.

Os caminhos dos pesos independem do diretório do terminal. Para usar outra pasta, defina `SAFRACERTA_MODELOS_DIR` antes de iniciar; ela deve conter os dois nomes acima. A inicialização falha se faltar um peso ou se a tarefa/classe do detector estiver incorreta. Não baixa outro peso automaticamente.

Execução alternativa, dentro desta pasta:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app:app --host 0.0.0.0 --port 8000 --workers 1
```

Use somente um worker: os modelos são carregados uma vez e as inferências compartilham um bloqueio. Cada worker extra criaria outra cópia dos modelos. Se um serviço já estiver usando a porta 8000, não abra uma segunda instância nessa porta.

## Aplicativo e conexão

As configurações ficam em `src/config/api.js`. `EXPO_PUBLIC_API_DOCS_URL` aceita a URL da documentação terminando em `/docs`; o aplicativo deriva a base da API. O endereço padrão no emulador Android é `http://10.0.2.2:8000/docs`.

Para um celular físico, use o IPv4 do computador e mantenha ambos na mesma rede. Confira `http://SEU_IP:8000/saude` no navegador do celular. O Firewall deve permitir TCP 8000 na rede privada. `localhost` no celular aponta para o celular, não para o computador.

Esta execução continua sendo para rede local. Para hospedagem pública, configure HTTPS e limites no servidor. A API verifica o ID token Firebase e o perfil ativo. O modelo usa `save=False`; a integração de histórico grava a foto recebida no Cloud Storage e o resultado ou falha em `analises`, sem gerar arquivos de predição da Ultralytics.

## Contrato da versão 2

- `GET /saude`: disponibilidade dos modelos e `versao_resposta: 2`.
- `GET /classes`: os índices e nomes originais das 16 classes de classificação.
- `POST /analisar`: cabeçalho `Authorization: Bearer ID_TOKEN`, multipart com `analise_id` da tentativa já registrada e campo `foto`, JPEG/PNG/WebP, até 10 MB e 25 milhões de pixels. Não defina manualmente o Content-Type multipart no aplicativo. Uma solicitação já em processamento retorna HTTP 202 com ID/situação; uma concluída retorna o resultado persistido. Sem token, retorna HTTP 401. O histórico é a fonte de confirmação de salvamento.

Os campos anteriores (`classe_id`, `classe`, `nome_exibicao`, `pontuacao`, `top3`, `modelo` e `aviso`) permanecem. A resposta acrescenta os campos abaixo. **Este exemplo é ilustrativo e não representa uma previsão real:**

```json
{
  "versao_resposta": 2,
  "imagem": {"largura": 1200, "altura": 1600},
  "fonte_classificacao": "imagem_completa",
  "deteccao_folha": {
    "estado": "concluido",
    "itens": [{"id": 1, "classe": "folha", "pontuacao": 0.93, "caixa_xyxyn": [0.12, 0.10, 0.88, 0.92]}]
  },
  "deteccao_lesoes": {"estado": "nao_disponivel", "itens": []}
}
```

As coordenadas são `[x1, y1, x2, y2]` normalizadas entre 0 e 1 na imagem completa **depois da orientação EXIF**. O Ultralytics já restitui as caixas ao tamanho original; não se deve aplicar outra transformação de letterbox. O aplicativo usa `contain` e considera as margens do visor ao desenhar.

O detector roda a 640 pixels, com pontuação mínima 0,25. Na primeira entrega, o alvo deve ser uma folha principal. Candidatas com IoU de pelo menos 0,7 em relação à melhor caixa são tratadas como duplicatas; regiões distintas geram orientação para outra captura. Esses parâmetros são escolhas iniciais do piloto, sem calibração em fotos reais do app. O modelo foi treinado com poucas imagens e caixas da folha principal; não garante rejeitar todo objeto estranho nem localizar todas as folhas de uma cena.

Erros: 400 arquivo vazio/inválido; 413 limites excedidos; 415 formato não aceito; 422 foto ausente, nenhuma folha localizada ou alvo ambíguo; 500 falha técnica de inferência. Sem folha, a API não executa o classificador. O app descarta respostas de uma foto anterior e permite tentar novamente.

## Detector de lesões: integração preparada

Não existe peso de lesões no material fornecido. Para a segunda etapa, preparar imagens originais com regiões anotadas e revisadas, treinar e validar um detector com a classe única `lesao`, preservando os pesos atuais. O planejamento completo está em `PLANEJAMENTO_DETECCAO_FOLHA.md`, na raiz.

Depois da validação, pode-se configurar explicitamente o novo peso antes de iniciar:

```powershell
$env:SAFRACERTA_MODELO_LESOES = 'C:\SafraCerta\deep_learning\modelos\best_lesoes.pt'
```

Essa variável é opcional e não aponta para um arquivo existente nesta entrega. A API recusa um peso de folhas como detector de lesões. O contrato diferencia:

| Estado de `deteccao_lesoes` | Significado na tela |
| --- | --- |
| `nao_disponivel` | O modelo de lesões não foi configurado. |
| `concluido`, lista vazia | O modelo executou sem encontrar regiões acima do limiar; isso não garante saúde. |
| `concluido`, com itens | Regiões numeradas sobre a imagem e listadas com pontuações próprias. |
| `erro` | Falha técnica somente nas lesões; mantém a classificação como resultado parcial e permite nova tentativa. |

O futuro detector usa a imagem completa; a hipótese de doença da folha não é atribuída automaticamente a cada região. Resultados divergentes são apresentados separadamente. Caixas não medem área afetada nem severidade.

## Serviço do Windows

O repositório inclui `../SafraCertaServico.xml`, cujo executável e diretório apontam para `api_modelo` ao lado do wrapper. Um serviço já instalado com uma cópia em Downloads pode continuar executando o código antigo mesmo após editar o projeto.

Na instalação conferida em 21/10/2026, o XML ativo está em `C:\Users\gffernandes\Downloads\SafraCerta_API_Windows\SafraCerta_API\SafraCertaServico.xml`. Esse arquivo foi atualizado para executar a API do projeto em `C:\SafraCerta\deep_learning\SafraCerta_API\api_modelo`; o serviço foi reiniciado e a versão 2 está ativa na porta 8000. O wrapper permanece em Downloads.

No XML usado pelo serviço instalado, os campos devem apontar para:

```xml
<executable>C:\SafraCerta\deep_learning\SafraCerta_API\api_modelo\.venv\Scripts\python.exe</executable>
<arguments>-m uvicorn app:app --host 0.0.0.0 --port 8000 --workers 1</arguments>
<workingdirectory>C:\SafraCerta\deep_learning\SafraCerta_API\api_modelo</workingdirectory>
```

Faça backup do XML antes de alterar. Reiniciar o serviço exige PowerShell como administrador:

```powershell
Restart-Service -Name SafraCertaAPI
Invoke-RestMethod http://127.0.0.1:8000/saude
```

Confira `versao_resposta: 2`, `detector_folha_carregado: true` e `detector_lesoes_carregado: false` enquanto não houver o novo peso. Se houver falha na inicialização, confira os logs do wrapper, restaure o XML anterior e reinicie o serviço.

## Verificação

Dentro desta pasta:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m unittest test_app -v
```

Na raiz do projeto: `npm run test:folha`, `npm run lint` e `npx tsc --noEmit --incremental false`. `VALIDACAO.md` distingue testes de contrato, inferência real e avaliação de acurácia.

Referências: [Ultralytics Predict](https://docs.ultralytics.com/modes/predict/), [FastAPI UploadFile](https://fastapi.tiangolo.com/tutorial/request-files/) e [Expo Image](https://docs.expo.dev/versions/v57.0.0/sdk/image/). O checkpoint informa licença AGPL-3.0; preserve os termos aplicáveis ao distribuir projeto/modelo.

# Validação — integração de detecção, 21/10/2026

## Pesos conferidos

| Arquivo | SHA-256 | Origem comparada |
| --- | --- | --- |
| `deep_learning/modelos/best_deteccao.pt` | `5c98ac27641693c9e277e4318dd76b8438dcd415499106eb6f7e83dfb257c31e` | `resultados/SafraCerta_deteccao_treino_folha_20261011_141733/weights/best.pt` |
| `deep_learning/modelos/best_classificao.pt` | `f88151dbe61407e220a239b0e637733e5eb3ef35f781c1624149e4264c7c6fc9` | `entrega/treinamento/weights/best.pt` |

O `data.yaml` do detector contém somente `0: folha`. O LEIA-ME descreve caixas aproximadas da folha principal, com revisão humana pendente. Não há modelo de lesões nem anotações de manchas no material localizado.

## Testes automatizados de contrato e coordenadas

`test_app.py` contém 10 testes com modelos simulados. Eles verificam o comportamento do código, sem medir acurácia:

- Contrato versão 2 e preservação dos campos de classificação.
- Diferença entre lesões indisponíveis, execução sem regiões e falha técnica parcial.
- Ausência de folha interrompe o fluxo antes da classificação e não reutiliza resposta anterior.
- Regiões distintas provocam erro de alvo ambíguo; caixas sobrepostas não duplicam a folha.
- Orientação EXIF de 90 graus aplicada antes de medir e inferir.
- Coordenadas limitadas à imagem original.
- Falha do detector de folha produz HTTP 500, sem confundir com ausência de folha.
- Peso com classe `folha` recusado como modelo de lesões.
- JPEG/PNG/WebP, arquivo vazio/inválido, limite de bytes, formato recusado e campo ausente.

Os 10 testes passaram no Windows/Python 3.11, na `.venv` do projeto, com PyTorch `2.11.0+cpu`, Ultralytics `8.4.174`, FastAPI `0.158.1` e Pillow `12.3.0`. `pip check` não encontrou dependências incompatíveis. Uma execução anterior também passou no ambiente do serviço antigo, com PyTorch `2.14.1+cpu`.

`npm run test:folha` passou nos 7 testes de validação de resposta e geometria. Inclui API antiga, coordenadas inválidas, IDs repetidos, foto vertical/horizontal com margens e recálculo para ampliação.

Lint, TypeScript e exportação do bundle Android passaram. A exportação verifica a compilação; a interface com câmera, galeria e foto real ainda requer conferência visual no aparelho, inclusive no iOS. Não foi executada automação da interface nesta entrega.

## Execução com os pesos reais

Na `.venv` do projeto, os dois pesos carregaram com as tarefas corretas: classificação com 16 classes e detecção com a classe única `folha`. `/saude` retornou versão 2, ambos carregados e detector de lesões indisponível. `/classes` retornou as 16 classes.

Uma imagem JPEG sintética uniforme de 600 × 800 pixels retornou HTTP 422, sem folha localizada. O classificador também foi executado diretamente nessa imagem para conferir o funcionamento da inferência real; seu rótulo não foi interpretado como resultado de avaliação. A primeira chamada de detecção nesse ensaio levou aproximadamente 6,77 segundos; o ensaio completo, incluindo carregamento e classificação direta, levou 66,1 segundos. Esses tempos de uma execução sintética não representam a latência de fotos reais do aplicativo.

Esse ensaio confirma o carregamento e a execução dos arquivos fornecidos. O contrato de sucesso com caixas e as situações do futuro detector de lesões foram verificados com modelos simulados; falta a validação completa com fotos reais.

## Ativação do serviço: concluída em 21/10/2026

Na primeira entrega, o serviço Windows `SafraCertaAPI` executava a cópia antiga em `C:\Users\gffernandes\Downloads\SafraCerta_API_Windows\SafraCerta_API`. A primeira autorização de administrador foi cancelada, mantendo a versão 1 naquela ocasião.

Após o novo pedido de integração, foi conferido diretamente o checkpoint `best_deteccao.pt`: tarefa `detect`, classes `{0: 'folha'}`. O usuário autorizou a execução administrativa pelo Windows. A primeira tentativa encontrou erro na atribuição do XML, antes de salvar alterações; a correção foi testada sem gravação no mesmo PowerShell antes de reaplicar.

O XML instalado foi atualizado com backup para usar o Python e o diretório da API em `C:\SafraCerta\deep_learning\SafraCerta_API\api_modelo`. O serviço foi reiniciado com sucesso. Backup da configuração anterior: `C:\Users\gffernandes\Downloads\SafraCerta_API_Windows\SafraCerta_API\SafraCertaServico.xml.backup-deteccao-20261021-162711`.

Verificação por HTTP na porta 8000: `/saude` versão 2 com classificador e detector de folha carregados, detector de lesões indisponível; `/classes` com 16 classes; `/openapi.json` versão 2.0.0. O envio multipart de uma imagem JPEG sintética uniforme retornou 422 com a orientação de folha não localizada, comprovando a execução do novo fluxo no serviço ativo. Isso não substitui a avaliação com fotos reais ou a inspeção visual no aparelho.

## Limites da avaliação

O classificador mantém a imagem completa como entrada. A comparação de acurácia entre imagem completa e recorte não foi feita: não foram localizadas imagens originais rotuladas disponíveis para essa avaliação. Montagens `val_batch` não foram usadas como fotos de teste.

O piloto de detecção informa 38 imagens de treino, 10 de validação e 10 de teste, somente com exemplos positivos. As métricas de folhas não medem localização de manchas e não calibram a rejeição de imagens sem folha. Pontuação mínima 0,25 e IoU 0,7 para duplicatas permanecem parâmetros iniciais que precisam ser avaliados em fotos reais.

A marcação de lesões possui contrato e renderização preparados e testes com simulação. Isso não equivale a um modelo de lesões treinado ou validado. Não foram alterados pesos ou métricas do treinamento.

## Registro anterior da versão 1

O documento anterior registrava inferência real do classificador em Linux/Python 3.12 com imagem JPEG sintética, rotas de saúde/classes e validações de arquivo. Imagem sintética comprova execução, sem medir acurácia. A avaliação de classificação informada pela equipe (185 imagens, 83,24%) não foi reproduzida nesta integração.

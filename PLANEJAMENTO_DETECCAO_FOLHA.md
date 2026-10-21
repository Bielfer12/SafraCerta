# Planejamento — classificação e localização na foto da folha

**Data:** 21/10/2026  
**Status:** aprovado pelo usuário. Etapa 1 implementada em 21/10/2026; integração do futuro detector de lesões preparada. A etapa 2 depende de anotações e de um peso de lesões treinado e validado.

## 1. Resultado pretendido

Na tela Testa Folha (`TesteFolha.js`, apresentada como **Diagnosticar**), o usuário escolhe ou fotografa uma folha e aciona o botão de análise existente. Uma única solicitação deve produzir:

1. A classificação da folha, mantendo as outras possibilidades já apresentadas.
2. A localização da folha analisada na imagem.
3. Quando houver um modelo de lesões treinado e validado, a localização das regiões suspeitas, com caixas sobre a própria foto.

A classificação da folha e a localização de lesões são resultados diferentes. Uma caixa em volta da folha não deve ser apresentada como localização da doença.

## 2. O que os arquivos atuais realmente permitem

O treino indicado está em `deep_learning/resultados/SafraCerta_deteccao_treino_folha_20261011_141733/`.

| Evidência consultada | Constatação |
| --- | --- |
| `args.yaml` | Tarefa `detect`, modelo inicial `yolo26n.pt`, entrada de treino de 640 pixels. |
| `data.yaml` | Uma única classe: `0 = folha`. |
| `LEIA-ME.txt` e `manifesto.json` | Uma caixa aproximada envolvendo a folha principal. Não há anotações de manchas. A revisão humana das caixas está pendente. |
| `metricas_teste.json` | 38 imagens de treino, 10 de validação e 10 de teste. O mAP50 informado é 0,995 e o mAP50–95 é aproximadamente 0,696, para localizar **folhas** nesse conjunto piloto. |
| `teste_final/val_batch1_pred.jpg` | As marcações envolvem as folhas inteiras, inclusive onde existem sintomas visíveis. |
| `notebooks/SafraCerta_deteccao_e_classificacao.ipynb` | Já contém o fluxo detector de folha → recorte → classificador. O próprio notebook registra limitações e ausência de confirmação das classes reais das fotos. |

Conferências por SHA-256:

- `deep_learning/modelos/best_deteccao.pt` é idêntico a `weights/best.pt` desse treino: `5c98ac27641693c9e277e4318dd76b8438dcd415499106eb6f7e83dfb257c31e`.
- `deep_learning/modelos/best_classificao.pt` é idêntico ao peso em `deep_learning/entrega/treinamento/weights/best.pt`: `f88151dbe61407e220a239b0e637733e5eb3ef35f781c1624149e4264c7c6fc9`.
- O nome atual `best_classificao.pt` será respeitado; qualquer renomeação futura deverá ajustar as referências juntas.

**Conclusão:** os dois pesos existentes permitem planejar a localização da folha e sua classificação. Para apontar manchas, será necessário um novo treino com anotações de lesões. Os resultados altos do piloto não medem detecção de doença nem demonstram desempenho geral em fotos do aplicativo.

### Situação encontrada no planejamento, antes da implementação

- A API FastAPI em `deep_learning/SafraCerta_API/api_modelo/app.py` executa somente classificação e retorna `classe_id`, `classe`, `nome_exibicao`, `pontuacao` e `top3`.
- O caminho de peso configurado nela é `api_modelo/modelos/best.pt`; esse arquivo não foi encontrado no checkout analisado. Os pesos disponíveis estão em `deep_learning/modelos/`. Corrigir essa configuração faz parte da integração, antes de testar o serviço.
- O ambiente `.venv` referido pelos BAT e pelo XML do serviço Windows também não foi encontrado nesse checkout. A instalação local e o estado do serviço precisam ser conferidos na implementação.
- `src/services/analiseFolha.js` envia a imagem uma vez, em multipart com o campo `foto`, para `POST /analisar`, com limite de espera de 60 segundos.
- O visor usa `expo-image` com `contentFit="cover"`. Esse comportamento pode cortar partes da imagem e precisa ser ajustado para alinhar as caixas corretamente.
- O texto atual informa que a análise não localiza doenças. Ele deverá ser atualizado conforme a capacidade efetivamente disponibilizada em cada etapa.

## 3. Entrega em duas etapas

### Etapa 1 — usar os dois modelos existentes

Entregar a integração da localização da folha com a classificação e mostrar a caixa da folha no visor.

Fluxo proposto:

```text
Selecionar/fotografar → Analisar → enviar a foto uma vez
                                  ↓
                       Validar e corrigir orientação
                                  ↓
                       Detectar a folha principal
                                  ↓
                       Preparar o alvo de classificação
                                  ↓
                       Classificar + retornar coordenadas
                                  ↓
                       Foto com caixa da folha + resultado
```

O notebook existente servirá de referência para o recorte. Antes de trocar a entrada do classificador, comparar a imagem completa com o recorte em imagens de validação: algumas caixas do piloto deixam partes da folha de fora. Adotar recorte e eventual margem somente se a avaliação justificar. Se houver regressão, manter a classificação da imagem completa e informar essa origem no resultado técnico da API.

O primeiro fluxo será para **uma folha principal por foto**. Não prometer análise de todas as folhas da cena: o detector não foi anotado para esse objetivo. Se houver candidatos distintos que tornem o alvo ambíguo, orientar uma foto mais próxima de uma única folha; caixas sobrepostas precisam de tratamento validado para não contar a mesma folha duas vezes.

Nesta etapa, a interface deve informar: **“Folha localizada. Localização das manchas ainda não disponível.”** A etapa 1 não conclui a parte de manchas solicitada.

### Etapa 2 — marcar manchas e regiões suspeitas

Adicionar um detector específico de lesões, depois de preparar e validar os dados de treinamento.

```text
                       Foto normalizada
                      /        |        \
            Localizar folha  Classificar  Localizar lesões
                      \        |        /
                    Uma resposta da API
                              ↓
             Foto com regiões suspeitas numeradas
               + classificação da folha + legenda
```

Proposta inicial: uma classe de localização **`lesao`**, entendida como região visual suspeita. O classificador continua responsável pela hipótese de doença da folha. Não atribuir automaticamente essa hipótese a cada caixa de lesão.

Se a equipe quiser identificar o tipo de doença em cada região, será preciso anotar classes específicas por região e validar esse resultado separadamente. As 16 classes de classificação incluem condições com sintomas difusos, que nem sempre correspondem a manchas isoladas.

## 4. Preparação do modelo de lesões

1. Definir com alguém que conheça os sintomas o que conta como uma região: mancha isolada, agrupamento de manchas ou outra lesão visível. Registrar essa regra para evitar rótulos inconsistentes.
2. Selecionar imagens originais e fotos reais semelhantes às capturas do app, com variação de luz, distância, fundo, orientação e intensidade dos sintomas.
3. Marcar as regiões suspeitas com caixas e revisão humana. Incluir folhas saudáveis e exemplos difíceis sem lesões, como sombras, reflexos, nervuras e fundos parecidos.
4. Anotar as regiões relevantes de forma consistente. As pastas de classificação podem fornecer imagens, mas seus nomes não fornecem as coordenadas das lesões.
5. Separar treino, validação e teste por planta/captura quando possível; verificar duplicatas e imagens derivadas para evitar vazamento entre as divisões.
6. Treinar um detector YOLO compatível com o ambiente existente. Manter registros de versão, classes, pesos e parâmetros. Não substituir os pesos atuais de folha e classificação.
7. Escolher limiar de pontuação e parâmetros usando validação. O teste final fica reservado para avaliação, sem ajustar o modelo com base nele.
8. Avaliar precisão, recall, mAP, lesões não encontradas e falsos positivos, inclusive em folhas saudáveis e imagens sem folha. Conferir também o alinhamento visual das caixas em fotos reais.

O novo peso poderá ser publicado no projeto como `deep_learning/modelos/best_lesoes.pt`, depois dessa validação. Não existe esse modelo no material analisado. Não há base para prometer um prazo ou uma quantidade suficiente de fotos antes de definir e revisar o dataset.

### Caixas ou contornos?

- **Caixas:** primeira entrega recomendada para mostrar aproximadamente onde estão as regiões suspeitas. Usa componentes já disponíveis no aplicativo.
- **Contornos preenchidos:** evolução com um modelo de segmentação e dataset anotado com polígonos ou máscaras. Permite representar o formato da região, mas requer outro preparo de dados e renderização.

O número de caixas será chamado de **regiões marcadas**. Não será apresentado como quantidade exata de manchas, porcentagem de área doente ou severidade. Medir área afetada exigiria máscaras confiáveis tanto da folha quanto das lesões e uma avaliação específica.

## 5. Alterações propostas na API

Ampliar a API Python existente e reutilizar a conexão atual do aplicativo. Não criar outro serviço de inferência só para detecção.

- Resolver os caminhos dos modelos de forma independente do diretório do terminal, usando a pasta `deep_learning/modelos/` como origem padrão.
- Carregar os modelos uma vez na inicialização, verificar suas tarefas e classes e manter o bloqueio de inferência do serviço com um worker na primeira entrega.
- Manter a leitura única da imagem, os limites de 10 MB e 25 milhões de pixels e a aceitação atual de JPEG, PNG e WebP.
- Aplicar a orientação EXIF antes de medir dimensões, detectar e recortar. Os resultados devem sempre usar esse mesmo sistema de coordenadas.
- Usar o detector de folha na resolução de referência de 640 pixels. Os 224 pixels da classificação não devem ser reutilizados automaticamente para detectar lesões pequenas.
- Preservar os campos de classificação de sucesso e acrescentar as dimensões da imagem e os resultados espaciais. O envio continua por `POST /analisar`, com uma única foto.
- Na etapa 1, retornar explicitamente que o detector de lesões não está disponível. Peso de lesões ausente não pode produzir uma resposta equivalente a “nenhuma lesão encontrada”.
- Ampliar `/saude` com a disponibilidade de cada modelo, preservando a informação de classificação já existente.
- Não salvar fotos, recortes ou imagens anotadas automaticamente em disco ou no Firebase. Usar `save=False` e processamento em memória, mantendo o comportamento atual.

Proposta dos novos campos da resposta, sem repetir os campos de classificação já existentes:

```json
{
  "versao_resposta": 2,
  "imagem": { "largura": 1200, "altura": 1600 },
  "fonte_classificacao": "imagem_completa",
  "deteccao_folha": {
    "estado": "concluido",
    "itens": [
      {
        "id": 1,
        "classe": "folha",
        "pontuacao": 0.93,
        "caixa_xyxyn": [0.12, 0.10, 0.88, 0.92]
      }
    ]
  },
  "deteccao_lesoes": {
    "estado": "nao_disponivel",
    "itens": []
  }
}
```

**Exemplo ilustrativo de contrato; dimensões, pontuação e caixa não são uma inferência realizada neste planejamento.** `fonte_classificacao` será `recorte_folha` ou `imagem_completa`, conforme o caminho realmente executado.

Na etapa 2, `deteccao_lesoes.estado` será `concluido` e cada item terá `id`, `classe`, `pontuacao` e `caixa_xyxyn`. Lista vazia com estado `concluido` significa somente que o modelo não encontrou regiões acima do limiar. Estado `erro` indica falha técnica e preserva a classificação quando for possível apresentá-la com clareza como resultado parcial.

### Situações especiais

| Situação | Resposta/comportamento proposto |
| --- | --- |
| Nenhuma folha encontrada | Retornar erro de análise compreensível, por exemplo HTTP 422 com `detail` textual, e orientar outra foto. Não apresentar uma doença escolhida sem um alvo adequado. Isso não garante que o detector rejeitará todo objeto que não seja folha. |
| Alvo ambíguo entre folhas distintas | Orientar captura de uma única folha antes de concluir a análise. |
| Detector de lesões ainda não implantado | Mostrar classificação e localização da folha com estado `nao_disponivel` para lesões. |
| Detector de lesões executou e não marcou regiões | Mostrar “Nenhuma região suspeita localizada”. Não converter isso em garantia de folha saudável. |
| Classificador e detector de lesões discordam | Exibir os resultados separados e indicar a divergência, sem esconder um deles ou forçar concordância. |
| Falha somente na detecção de lesões | Identificar resultado parcial e oferecer nova tentativa. Não exibir a falha como lista vazia bem-sucedida. |
| API antiga sem os novos campos | Continuar exibindo a classificação e informar indisponibilidade da localização; nunca inventar caixas. |
| Troca de imagem durante a análise | Cancelar a espera e descartar respostas antigas, preservando o controle de solicitação que já existe. |

## 6. Como a tela ficará

Aplicar a skill **frontend-design** em `.agents/skills/frontend-design/SKILL.md` e seguir `GabrielCasagrande/GabrielCasagrande/ETICA-DESENVOLVIMENTO.md`. A proposta mantém a identidade da tela atual e concentra a informação visual na foto.

### Direção visual

| Elemento | Proposta |
| --- | --- |
| Paleta existente | Verde `#00450D`, verde claro `#94F990`, fundo `#FAFAF5`, branco `#FFFFFF` e texto `#1A1C19`. |
| Destaque das lesões | Laranja escuro `#B95000`, com contorno, número e legenda. Não depender apenas de cor para explicar a marcação. |
| Tipografia | Fonte nativa já usada; manter a hierarquia atual, sem instalar uma fonte para esta funcionalidade. |
| Alinhamento | Textos e resultados à esquerda; imagem centralizada e sem distorção. |
| Controles | Áreas de toque de pelo menos 48 pontos para alternar marcações, ampliar e voltar. |

Após analisar, a foto permanece no visor. A caixa da folha é identificada como **Folha analisada**. Quando o modelo de lesões estiver validado, as regiões suspeitas aparecem com números, preservando a visibilidade da folha. A legenda relaciona esses números à lista de regiões abaixo.

```text
┌────────────────────────────────────┐
│  ←  Diagnosticar                   │
│                                    │
│  ┌──────────────────────────────┐  │
│  │ Foto completa da folha      │  │
│  │                              │  │
│  │      ┌─ 1 ─┐                │  │
│  │      │     │      ┌─ 2 ─┐  │  │
│  │      └─────┘      └─────┘  │  │
│  │                              │  │
│  └──────────────────────────────┘  │
│  Ocultar marcações   Ampliar       │
│                                    │
│  Classificação da folha            │
│  Mancha-parda                      │
│  Pontuação do modelo: 87%           │
│                                    │
│  Regiões suspeitas                 │
│  1  Região marcada · 81%            │
│  2  Região marcada · 76%            │
│                                    │
│  Outras possibilidades             │
│  ...                               │
│                                    │
│  Analisar outra foto               │
└────────────────────────────────────┘
```

**Wireframe da etapa 2, com nomes e pontuações fictícios. Não representa resultados do detector atual.** Na etapa 1, a lista de regiões é substituída pela mensagem de indisponibilidade da localização de manchas.

- **Ocultar/mostrar marcações:** alterna somente a visualização, sem reenviar a imagem ou executar os modelos novamente.
- **Ampliar:** abre a mesma imagem e as mesmas caixas em uma visualização maior. Zoom por gestos pode ser uma evolução; a primeira entrega não exige uma nova biblioteca de gestos.
- **Durante a análise:** manter a foto e mostrar “Analisando folha e regiões suspeitas…” apenas quando essa capacidade estiver ativa. Não simular porcentagem de progresso nem revelar caixas antes da resposta.
- **Resultado:** manter classificação e outras possibilidades, com pontuações próprias. A pontuação de classificação não é a pontuação de uma caixa de lesão.
- **Acessibilidade:** a lista textual descreve as regiões para quem não distingue cores ou não consegue interpretar a sobreposição. Elementos decorativos das caixas não devem bloquear os controles da imagem.
- **Texto explicativo:** atualizar o aviso atual para descrever a etapa disponibilizada. Na entrega completa, por exemplo: “As marcações indicam regiões suspeitas. Os resultados do modelo não confirmam um diagnóstico.”

### Alinhamento entre imagem e caixas

Usar `expo-image` com `contentFit="contain"` e posicionamento central. Medir o espaço visível com `onLayout`. As coordenadas da API são normalizadas entre 0 e 1 em relação à imagem completa, depois da orientação EXIF.

Para imagem `Wi × Hi` dentro de um visor `Wv × Hv`:

```text
escala = min(Wv / Wi, Hv / Hi)
larguraRenderizada = Wi × escala
alturaRenderizada  = Hi × escala
deslocamentoX = (Wv - larguraRenderizada) / 2
deslocamentoY = (Hv - alturaRenderizada) / 2

esquerda = deslocamentoX + x1 × larguraRenderizada
topo    = deslocamentoY + y1 × alturaRenderizada
largura = (x2 - x1) × larguraRenderizada
altura  = (y2 - y1) × alturaRenderizada
```

Validar números finitos e limites `0 ≤ x1 < x2 ≤ 1` e `0 ≤ y1 < y2 ≤ 1`. Se algum modelo trabalhar em um recorte, converter suas coordenadas de volta para a imagem completa no servidor antes de responder. Não aplicar manualmente outra transformação de letterbox aos resultados que o Ultralytics já restituiu ao tamanho original.

A imagem enviada pode já ter sido recortada pela galeria: nesse caso, as caixas referem-se a esse arquivo selecionado. Testar a orientação em câmera e galeria, no Android e no iOS. Preservar proporções e recalcular a sobreposição ao mudar o tamanho do visor ou abrir a ampliação.

## 7. Arquivos previstos para a implementação aprovada

| Arquivo | Mudança prevista |
| --- | --- |
| `deep_learning/SafraCerta_API/api_modelo/app.py` | Caminhos dos pesos, carregamento de modelos, integração de inferência, coordenadas e novos campos da resposta. |
| `deep_learning/SafraCerta_API/api_modelo/README.md` e `VALIDACAO.md` | Documentar capacidades reais, instalação, contrato e verificações efetivamente executadas. |
| `src/services/analiseFolha.js` | Validar os campos espaciais e estados, manter cancelamento e compatibilidade com resposta antiga. |
| `src/screens/TesteFolha.js` | Exibir imagem, marcações, legenda, disponibilidade e controles de visualização. |
| `src/components/ImagemAnaliseFolha.js` | Componente pequeno reutilizado de fato no visor e na ampliação; imagem e caixas com o mesmo cálculo. Sem criar um sistema genérico de visualização. |
| `deep_learning/notebooks/` | Notebook específico de preparação, treino e avaliação de lesões na etapa 2, com parâmetros e resultados registrados. |
| `deep_learning/modelos/` | Manter os dois pesos existentes e adicionar o peso de lesões somente após sua validação. |

Na primeira etapa, usar `View`, `Text`, `Pressable`, `Modal` e `expo-image` já instalados. Não há necessidade inicial de SVG, Canvas, conversão para TFLite ou execução do PyTorch dentro do celular para desenhar caixas.

## 8. Testes e critérios de aceite

### Etapa 1

- Carregar os dois pesos corretos e comprovar suas tarefas/classes no ambiente instalado. Não assumir o modelo a partir apenas do nome do arquivo.
- Enviar uma única foto e receber classificação, dimensões e caixa da folha no mesmo resultado.
- Comparar classificação da imagem completa e do recorte, registrando regressões e partes da folha cortadas.
- Validar caixas em imagens verticais, horizontais, quadradas e com rotação EXIF, no visor e na ampliação.
- Testar fotos sem folha e candidatos ambíguos; documentar falhas e limitações do pequeno detector piloto.
- Confirmar cancelamento, troca rápida de foto, API fora do ar e erro de envio, sem reaproveitar caixas da foto anterior.
- Confirmar que o app antigo recebe os campos de classificação esperados nas respostas de sucesso, e que o app atualizado funciona com API antiga sem localização.

### Etapa 2

- Validar o novo detector em imagens com lesões anotadas e em exemplos negativos, mantendo os resultados do teste final separados do ajuste de parâmetros.
- Conferir associação entre imagem, coordenadas, classes e pontuações, sem trocar o nome de uma doença pela classe genérica de lesão.
- Testar zero, uma e várias regiões; diferenças entre modelos; indisponibilidade e falha técnica do detector de lesões.
- Testar lesões nas bordas, próximas entre si e pequenas, além de sombras e nervuras que possam causar marcações falsas.
- Verificar no dispositivo que alternar marcações e ampliar não faz novas requisições.
- Medir latência e memória em CPU, inclusive a primeira inferência e solicitações em sequência. Manter inicialmente o timeout de 60 segundos; revisar servidor e cliente juntos se a medição justificar mudança.

Para qualquer implementação de código, executar lint e tipos do aplicativo, testes apropriados da API e inspeção visual em dispositivo ou emulador. Registrar métricas do modelo separadamente dos testes de funcionamento do software. Não considerar o recurso pronto apenas porque a API devolve HTTP 200.

## 9. Execução e publicação

O processamento continua na API Python existente, inicialmente em rede local. A integração terá de conferir o ambiente Python, os pesos, o serviço Windows e o endereço usado pelo app antes de testar a tela.

A etapa de inferência deste planejamento não depende das Cloud Functions administrativas de usuários. Hospedar a API Python para acesso fora da rede local será uma decisão separada, com configuração, autenticação e dimensionamento próprios. Não incluir uma nova publicação nem modificar faturamento nesta etapa de planejamento.

O planejamento não inclui persistência de fotos/histórico, análise contínua de vídeo, diagnóstico por talhão, recomendações de tratamento ou cálculo de severidade. Esses recursos exigiriam decisões adicionais de produto e de dados.

## 10. Ordem proposta e condição para concluir a solicitação

1. Aprovar o planejamento e a entrega em etapas.
2. Regularizar o ambiente e os caminhos dos modelos na API.
3. Integrar folha + classificação e validar o recorte contra o comportamento atual.
4. Integrar as caixas da folha na tela e na ampliação.
5. Preparar e revisar o dataset de lesões; treinar e avaliar o modelo específico.
6. Integrar as regiões suspeitas à mesma API e ao mesmo botão de análise.
7. Concluir os testes visuais e de inferência em fotos reais.

**A solicitação de apontar manchas somente estará concluída após as etapas de dataset, treinamento, validação e integração do detector de lesões.** A primeira entrega pode aproveitar os arquivos atuais, mas não será apresentada como detecção de manchas.

Neste planejamento foram lidos código, configurações, métricas, notebooks e arquivos de orientação; conferidos hashes; e inspecionada uma montagem de previsões. Não foi executada uma nova inferência, reproduzido o treinamento ou validada a tela com detecção funcionando.

### Registro da implementação após aprovação — 21/10/2026

- API versão 2 e tela integradas com localização da folha, classificação, marcações opcionais e ampliação da foto.
- A classificação permanece na imagem completa. Não foram localizadas fotos originais rotuladas para comparar recortes; não houve mudança de entrada sem essa avaliação.
- Contrato preparado para um detector separado de classe `lesao`, com estados de indisponibilidade, resultado vazio e falha parcial. Nenhum modelo de manchas foi criado ou presumido a partir do peso de folhas.
- Testes de software e carregamento dos pesos estão registrados em `deep_learning/SafraCerta_API/api_modelo/VALIDACAO.md`. A inspeção visual no aparelho e a avaliação com fotos reais continuam pendentes.
- Os pesos e resultados do treinamento fornecido foram preservados.
- A ativação no serviço Windows foi concluída após o novo pedido de integração em 21/10/2026: XML com backup, execução da API do projeto e saúde versão 2 confirmada na porta 8000. A primeira tentativa de autorização havia sido cancelada; essa pendência foi resolvida. O detector real informa tarefa `detect` e classe `folha`.

## Referências técnicas

- [YOLO: detecção por caixas](https://docs.ultralytics.com/tasks/detect/).
- [Resultados de inferência e coordenadas `xyxy`/`xyxyn`](https://docs.ultralytics.com/modes/predict/).
- [Formato dos datasets de detecção](https://docs.ultralytics.com/datasets/detect/).
- [YOLO: segmentação com máscaras e contornos](https://docs.ultralytics.com/tasks/segment/).
- [Expo SDK 57 — imagem, proporção e `contentFit`](https://docs.expo.dev/versions/v57.0.0/sdk/image/).
- [FastAPI — envio de arquivos](https://fastapi.tiangolo.com/tutorial/request-files/).

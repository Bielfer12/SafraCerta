# Relatorio de avaliacao do SafraCerta

## Status da entrega

Os resultados de teste e o modelo PyTorch treinado foram preservados em
`avaliacao_teste/` e `treinamento/weights/best.pt`. A exportacao TFLite e a
comparacao automatica estao implementadas em
`exportar_e_comparar.py`. No Windows, o script usa o caminho intermediario
SavedModel porque o exportador LiteRT nativo do Ultralytics exige Linux x86 ou
macOS. O resultado final continua sendo gravado como
`SafraCerta_classificador_float32.tflite`.

Para concluir a exportacao:

```bash
pip install ultralytics tensorflow pillow pandas
python exportar_e_comparar.py
```

O script exige o dataset de teste em `dataset_test/` e imagens de campo em
`campo/`. Ele gera `SafraCerta_classificador_float32.tflite`,
`comparacao_pt_tflite.csv` e `previsoes_campo.csv`.

## Dataset

| Split | Imagens |
|---|---:|
| Treino | 1.569 |
| Validacao | 225 |
| Teste | 185 |
| Total | 1.979 |

O conjunto possui 16 classes. O modelo foi treinado com `imgsz=224`, batch 32,
50 epocas no maximo, patience 10 e seed 42.

## Ordem das classes

A ordem oficial esta em `classes.txt` e e parte do contrato do modelo:

```text
0 anthracnose
1 black_shank
2 brown_spot
3 cmv
4 frog_eye
5 genetic_abnormality
6 healthy
7 nematodes
8 potato_tuber_moth
9 pvy
10 sunscald
11 target_spot
12 tmv
13 tswv
14 weather_fleck
15 wildfire
```

## Resultado no teste

| Metrica | Resultado |
|---|---:|
| Acuracia Top-1 | 83,24% |
| Acuracia Top-5 | 99,46% |
| Precisao macro | 73,02% |
| Recall macro | 75,37% |
| F1 macro | 73,33% |

As metricas detalhadas por classe estao em
`avaliacao_teste/metricas_por_classe.csv`. A matriz de confusao esta em
`avaliacao_teste/matriz_confusao_teste.png` e a versao normalizada em
`avaliacao_teste/confusion_matrix_normalized.png`.

## Principais erros

Os pares mais frequentes observados em `previsoes_teste.csv` foram:

| Real | Prevista | Quantidade |
|---|---|---:|
| pvy | cmv | 4 |
| healthy | tswv | 3 |
| wildfire | pvy | 2 |
| tmv | wildfire | 2 |
| cmv | black_shank | 2 |
| wildfire | cmv | 2 |

`anthracnose`, `genetic_abnormality` e `tswv` possuem somente uma imagem no
teste. As metricas zero dessas classes nao permitem concluir que o modelo
falha de forma geral; e necessario ampliar a amostra.

## Imagem de campo

`campo.jpg` foi copiada para esta entrega como exemplo de imagem inédita.
Ela mostra uma lavoura em plano aberto, e nao uma folha individual com
diagnostico confirmado. Por isso, nao e correto atribuir acuracia ou usar essa
imagem em uma matriz de confusao. Ela deve ser avaliada apenas
qualitativamente pelo script, junto com novas fotos de folhas capturadas no
campo.

## Entrada e saida

O treinamento usa imagens redimensionadas para 224 x 224 pixels. O formato
exato do arquivo TFLite deve ser registrado pelo script apos a exportacao,
consultando `get_input_details()` e `get_output_details()`. Para o modelo de
classificacao espera-se:

- entrada: `[1, 224, 224, 3]`, layout NHWC;
- saida: `[1, 16]`, uma pontuacao por classe;
- normalizacao: registrada pelo tipo e pela quantizacao retornados pelo
  interpretador.

## Comparacao PyTorch versus TFLite

A comparacao deve usar as mesmas 185 imagens do teste, na mesma ordem. O
arquivo `comparacao_pt_tflite.csv` sera produzido pelo script e registrara a
classe, confianca e indicador `mesma_classe` de cada modelo. A concordancia
nao deve ser presumida antes dessa execucao.

## Arquivos

- `classes.txt`: ordem das 16 classes;
- `treinamento/weights/best.pt`: modelo original;
- `avaliacao_teste/`: metricas, previsoes e matrizes;
- `campo.jpg`: exemplo de imagem inédita;
- `exportar_e_comparar.py`: exportacao e comparacao reproduziveis;
- `SafraCerta_classificador_float32.tflite`: sera gerado ao executar o script.

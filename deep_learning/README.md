# Deep Learning - SafraCerta

Esta pasta contém os arquivos relacionados à preparação dos datasets
e aos modelos de Deep Learning utilizados pelo SafraCerta.

## Dataset principal

O primeiro dataset preparado para o projeto é o TPDD_Honglin_CLS,
disponibilizado no Hugging Face.

Dataset:
https://huggingface.co/datasets/TamAko783/TPDD_Honglin_CLS

## Resultado da preparação

- Classes: 16
- Train: 1.295 imagens
- Validation: 138 imagens
- Test: 138 imagens
- Total: 1.571 imagens

### Verificações

- Imagens inválidas: 0
- Grupos de duplicatas exatas: 0
- Duplicatas exatas entre splits: 0
- Possíveis duplicatas visuais entre splits: 0

As divisões originais de treino, validação e teste foram preservadas.

## Dataset no repositório

As imagens não são armazenadas diretamente neste repositório.

O notebook de preparação realiza o download do dataset e cria
automaticamente a estrutura necessária para YOLO Classification.

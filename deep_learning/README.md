# Deep Learning - SafraCerta

Esta pasta contém os arquivos relacionados à preparação dos datasets
e aos modelos de Deep Learning utilizados pelo SafraCerta.

## Objetivo

Preparar e documentar imagens de folhas de tabaco para posterior
treinamento de um modelo de classificação.

As imagens dos datasets não são armazenadas diretamente neste repositório.

---

## 1. TPDD_Honglin_CLS

Fonte: https://huggingface.co/datasets/TamAko783/TPDD_Honglin_CLS

### Resultado da preparação
- Classes: 16
- Train: 1.295 imagens
- Validation: 138 imagens
- Test: 138 imagens
- Total: 1.571 imagens

### Verificações
- Imagens inválidas: 0
- Grupos de duplicatas exatas: 0
- Duplicatas exatas entre splits: 0
- Possíveis duplicatas visuais entre splits no limiar analisado: 0

As divisões originais de treino, validação e teste foram preservadas.

Notebook: `notebooks/prepare_tpdd_dataset.ipynb`

---

## 2. Tobacco Disease Classification - Roboflow

Fonte: https://universe.roboflow.com/project-h7z8y/tobacco-disease-classification

O projeto-fonte possui 442 imagens distribuídas em 8 classes.

Classes utilizadas:
- black_shank
- cmv
- healthy
- pvy
- tmv
- wildfire

Classes não utilizadas:
- bacterialwilt: 23 imagens
- Tagetspot: 4 imagens

Após a seleção restaram 415 imagens.
Foram removidas 7 imagens duplicadas ou near-duplicates.

### Resultado da preparação
- Train: 274 imagens
- Validation: 87 imagens
- Test: 47 imagens
- Total: 408 imagens

Após a limpeza: 0 pares com pHash <= 5.

### Limitações

A página pública do Roboflow não documenta suficientemente a
procedência primária das imagens nem o processo original de
validação dos rótulos.

O pHash é uma heurística e não garante detectar todas as imagens
derivadas, recortadas ou transformadas.

Notebook: `notebooks/prepare_roboflow_tobacco_classification.ipynb`

---

## 3. Dataset combinado SafraCerta

Os dois datasets foram combinados preservando seus splits.

### Resultado final
- Classes: 16
- Train: 1.569 imagens
- Validation: 225 imagens
- Test: 185 imagens
- Total: 1.979 imagens

O Roboflow complementa as classes:
- black_shank
- cmv
- healthy
- pvy
- tmv
- wildfire

Os arquivos recebem prefixos de origem:
- `tpdd__`
- `roboflow__`

### Integridade final
- Imagens analisadas: 1.979
- Imagens inválidas: 0
- Grupos de duplicatas exatas por SHA-256: 0
- Duplicatas exatas entre train/val/test: 0

A comparação TPDD x Roboflow não encontrou correspondências
com pHash <= 5 no limiar utilizado.

### Limitações

O dataset apresenta desbalanceamento entre classes.

As classes `anthracnose`, `genetic_abnormality` e `tswv` possuem
somente 1 imagem em validação e 1 imagem em teste.

---

## Armazenamento

As imagens não são versionadas no GitHub devido ao tamanho do dataset.

A versão preparada deve ser disponibilizada em armazenamento
compartilhado da equipe para posterior treinamento.

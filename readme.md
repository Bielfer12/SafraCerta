# 🌿 SafraCerta

Aplicativo mobile de diagnóstico inteligente para o cultivo do fumo. O SafraCerta usa a câmera do celular e um modelo de Inteligência Artificial multimodal para identificar doenças, pragas e outras irregularidades nas folhas da plantação — ajudando o agricultor a tomar decisões mais rápidas e reduzir perdas na colheita.

## 📌 Sobre o projeto

Pequenos produtores de fumo dependem diretamente dessa cultura para o sustento da família. É comum as plantas apresentarem manchas, amarelamento ou murchamento nas folhas — sintomas que podem indicar doenças como mofo azul, murcha bacteriana e podridão da raiz, além de pragas como pulgões e lagartas.

Sem conhecimento técnico e sem acesso fácil a um técnico agrícola na região, o agricultor muitas vezes só percebe o problema quando ele já se espalhou, tomando decisões por tentativa e erro — o que gera atrasos no tratamento, gastos com insumos aplicados de forma inadequada e, em casos mais graves, perda de parte da colheita.

O **SafraCerta** propõe resolver esse problema: o agricultor fotografa a folha do fumo pelo app, a imagem é analisada por um modelo de IA multimodal, e o resultado do diagnóstico chega de forma rápida e acessível, direto no celular.

### Beneficiário

Este projeto foi desenvolvido com base na realidade de **Flávio Borghezan Zanelato**, agricultor de fumo em Grão Pará/SC (IE 01.126.313-0), cuja produção depende do cultivo de fumo como principal fonte de renda.

## ⚙️ Funcionalidades

- 📷 Captura de fotos das folhas do fumo direto pelo app
- 🧠 Análise da imagem por um modelo de IA multimodal
- 📋 Diagnóstico de doenças, pragas e irregularidades na plantação
- 🕓 Histórico de diagnósticos por usuário/lavoura
- 📶 Pensado para funcionar em regiões com conectividade instável (fila de sincronização)

## 🛠️ Tecnologias utilizadas

| Camada | Tecnologia |
|---|---|
| Aplicativo mobile | [React Native](https://reactnative.dev/) |
| Banco de dados | [PostgreSQL](https://www.postgresql.org/) |
| Análise de imagens | Modelo de IA multimodal |
| Design e prototipagem | [Figma](https://www.figma.com/) e [Stitch](https://stitch.withgoogle.com/) |
| Versionamento | [GitHub](https://github.com/) |
| Gestão de tarefas | [GitHub Projects](https://github.com/features/issues) |

## 🔄 Como funciona

1. **Captura da imagem** — o agricultor fotografa a folha do fumo pelo app, direto no campo.
2. **Análise multimodal por IA** — o modelo identifica possíveis doenças, pragas ou irregularidades na planta.
3. **Diagnóstico acessível** — o resultado é exibido de forma rápida e clara, apoiando a próxima decisão do agricultor.

## 👥 Equipe

- Ana Paula Bet Gesser
- Gabriel Fillipe Casagrande Fernandes
- Guilherme Rabello Carrer
- Laís Kaminski Casagrande
- Nathan Rocha Gomes

Projeto desenvolvido como **Projeto Integrador**.

## 🚀 Como rodar o projeto

> ⚠️ Ajuste os comandos abaixo conforme a estrutura final do repositório.

```bash
# Clonar o repositório
git clone https://github.com/sua-org/safracerta.git
cd safracerta

# Instalar dependências do app (React Native)
npm install

# Rodar o app
npx react-native run-android
# ou
npx react-native run-ios
```

### Banco de dados

```bash
# Configurar variáveis de ambiente do PostgreSQL no arquivo .env
DATABASE_URL=postgres://usuario:senha@localhost:5432/safracerta
```

## 📋 Gestão do projeto

O acompanhamento de tarefas e o backlog do time são feitos pelo **GitHub Projects**, vinculado às issues deste repositório.

## 📄 Licença

Este projeto é de uso acadêmico, desenvolvido para fins de Projeto Integrador.
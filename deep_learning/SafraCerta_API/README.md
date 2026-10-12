# APIs do SafraCerta

Esta pasta agrupa os serviços de API do projeto. Cada nova API deve ficar em uma subpasta própria, com código, dependências e documentação isolados.

## Estrutura

```text
SafraCerta_API/
├── api_modelo/               # Classificação de imagens de folhas
│   ├── app.py
│   ├── modelos/
│   ├── requirements.txt
│   ├── instalar_windows.bat
│   ├── iniciar_windows.bat
│   ├── README.md
│   └── VALIDACAO.md
├── logs/                     # Logs locais do serviço do Windows
├── SafraCertaServico.exe     # Wrapper registrado no Windows
└── SafraCertaServico.xml     # Configuração do serviço
```

## API do modelo

A documentação de instalação, execução e testes está em [`api_modelo/README.md`](api_modelo/README.md).

Para iniciar manualmente no Windows:

```bat
cd deep_learning\SafraCerta_API\api_modelo
iniciar_windows.bat
```

O serviço `SafraCertaAPI` continua registrado pelo executável da raiz. O XML usa caminhos relativos e inicia o Uvicorn dentro de `api_modelo`.

## Adicionar outra API

Crie uma nova subpasta ao lado de `api_modelo`. Mantenha nela o código, o arquivo de dependências, os testes e a documentação específicos do novo serviço.

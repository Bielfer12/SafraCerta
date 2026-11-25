# SafraCerta — Configuração e testes no Android físico

## 1. Objetivo

Este documento reúne as configurações que foram necessárias para executar o SafraCerta em um celular Android físico, além dos problemas encontrados durante os testes e como foram resolvidos.

O objetivo é facilitar a configuração do ambiente para os outros integrantes do grupo.

## 2. Preparação do ambiente

Para executar o projeto, foram utilizadas as seguintes ferramentas:

- VS Code
- Git e Node.js
- Python 3.11
- Expo Go compatível com SDK 57
- API do SafraCerta
- Firebase

Após clonar o repositório, é necessário instalar as dependências:

```bash
git clone https://github.com/Bielfer12/SafraCerta.git
cd SafraCerta
npm install
```

Também é necessário configurar os arquivos fornecidos pela equipe:

- `.env` na raiz do projeto.
- `firebase-api.json` em `C:\ProgramData\SafraCerta\firebase-api.json`.

**Importante:** esses arquivos podem conter credenciais e não devem ser enviados ao GitHub.

## 3. Instalação da API

A API utiliza Python 3.11.

Para instalar as dependências, executar o arquivo:

`deep_learning/SafraCerta_API/api_modelo/instalar_windows.bat`

Para iniciar manualmente:

```powershell
cd C:\SafraCerta\deep_learning\SafraCerta_API\api_modelo
.\iniciar_windows.bat
```

Durante os primeiros testes, a API apresentou um erro porque não encontrava as credenciais do Firebase.

O problema foi resolvido configurando a variável de ambiente:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\ProgramData\SafraCerta\firebase-api.json"
```

Para configurar a variável permanentemente no Windows, utilizar o PowerShell como administrador:

```powershell
[Environment]::SetEnvironmentVariable("GOOGLE_APPLICATION_CREDENTIALS", "C:\ProgramData\SafraCerta\firebase-api.json", "Machine")
```

Também foi configurado o serviço `SafraCertaAPI`, permitindo iniciar a API pelo Windows.

Para verificar seu estado:

```powershell
Get-Service SafraCertaAPI
```

Para iniciá-lo, caso esteja parado, executar como administrador:

```powershell
Start-Service SafraCertaAPI
```

A documentação da API pode ser acessada no notebook pelo endereço:

`http://127.0.0.1:8000/docs`

## 4. Configuração do Expo Go

O SafraCerta utiliza o Expo SDK 57.

Durante os testes, o aplicativo não abriu inicialmente porque o Expo Go instalado no celular estava utilizando o SDK 58.

Para resolver, foi necessário instalar no Android uma versão do Expo Go compatível com o SDK 57, disponível em:

https://expo.dev/go

Após instalar a versão compatível, o aplicativo conseguiu iniciar normalmente.

## 5. Configuração da comunicação com a API

Um dos principais problemas foi que o SafraCerta abria no Android, mas não conseguia enviar imagens para o diagnóstico.

Isso acontecia porque o celular não conseguia acessar a API executada no notebook.

No projeto, o arquivo `src/config/api.js` utiliza a variável `EXPO_PUBLIC_API_DOCS_URL` para determinar o endereço da API.

Para utilizar um celular físico, foi adicionada a seguinte configuração no `.env`:

```env
EXPO_PUBLIC_API_DOCS_URL=http://192.168.0.9:8000/docs
```

O endereço `192.168.0.9` foi o IP local do notebook utilizado nos testes. **Cada integrante deve verificar o IP do próprio computador**, pois ele pode ser diferente.

No Windows, o IP pode ser identificado pelo comando:

```powershell
ipconfig
```

O notebook e o celular precisam estar conectados à mesma rede Wi-Fi.

## 6. Configuração do Firewall do Windows

Mesmo com a API funcionando, o celular inicialmente não conseguia acessá-la pela rede.

Foi identificado que o Wi-Fi do notebook estava configurado como rede pública.

Em uma rede doméstica confiável, o perfil foi alterado para privado utilizando o PowerShell como administrador:

```powershell
Set-NetConnectionProfile -InterfaceAlias "Wi-Fi" -NetworkCategory Private
```

Também foi necessário permitir conexões de entrada nas portas utilizadas pelo SafraCerta:

- Porta `8000`: API Python.
- Porta `8081`: servidor Expo/Metro.

As regras foram criadas com os seguintes comandos, executados como administrador:

```powershell
New-NetFirewallRule -DisplayName "SafraCerta API" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow -Profile Private -RemoteAddress LocalSubnet
```

```powershell
New-NetFirewallRule -DisplayName "SafraCerta Expo 8081" -Direction Inbound -Protocol TCP -LocalPort 8081 -Action Allow -Profile Private -RemoteAddress LocalSubnet
```

Essas regras são destinadas aos testes na rede local privada. Não é necessário desativar o Firewall do Windows.

## 7. Verificação da conexão

Antes de testar o diagnóstico, é importante confirmar que o celular consegue acessar os servidores do notebook.

No navegador do Android, acessar:

**API:**

`http://IP_DO_NOTEBOOK:8000/docs`

**Expo:**

`http://IP_DO_NOTEBOOK:8081/status`

No teste realizado, o servidor Expo retornou:

`packager-status:running`

Isso confirmou que a comunicação com o Expo estava funcionando.

## 8. Executando o aplicativo

Com a API iniciada, abrir o terminal na raiz do projeto:

```powershell
cd C:\SafraCerta
npx expo start -c
```

Após aparecer o QR Code:

1. Conectar o notebook e o Android à mesma rede Wi-Fi.
2. Abrir o Expo Go compatível com SDK 57.
3. Escanear o QR Code.
4. Aguardar o SafraCerta carregar.

O notebook precisa permanecer ligado, com o Expo e a API em execução durante os testes.

## 9. Resultado dos testes

Após os ajustes, foi possível:

- Abrir o SafraCerta no celular Android físico.
- Realizar login.
- Acessar a funcionalidade de diagnóstico.
- Enviar uma imagem para análise.
- Receber o resultado do diagnóstico por meio da API.

O principal problema encontrado estava na comunicação entre o celular e os servidores executados no notebook.

Depois de configurar o endereço IP, o perfil de rede e as regras do firewall, o aplicativo e o diagnóstico por imagem funcionaram corretamente.

## 10. Observações importantes

- O endereço IP utilizado no `.env` depende da rede em que o notebook está conectado.
- Se o IP mudar, será necessário atualizar a configuração.
- O Expo Go precisa ser compatível com o SDK utilizado no projeto.
- O `.env` e a chave administrativa do Firebase não devem ser enviados ao repositório.
- Essa configuração foi validada em ambiente de desenvolvimento, utilizando um notebook como servidor local. Para disponibilizar o aplicativo ao cliente de maneira independente, será necessário definir uma estratégia de hospedagem e distribuição.

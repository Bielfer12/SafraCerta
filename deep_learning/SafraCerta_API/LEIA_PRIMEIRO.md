# SafraCerta — API Python no Windows

Esta API usa o best.pt original enviado no ZIP. É classificação de 16 classes: não retorna caixas ou máscaras. Não precisa de TFLite, GPU NVIDIA, Firebase ou dataset para iniciar. O YOLO faz o pré-processamento da imagem no Python.

## 1. Instalar (uma vez)

1. Instale Python **3.11 de 64 bits**, com o Python Launcher (`py`).
2. Extraia TODO este ZIP, por exemplo em `C:\SafraCerta_API`. Não execute os arquivos dentro do ZIP.
3. Abra `instalar_windows.bat`. Ele cria `.venv` e instala PyTorch para CPU e as dependências. A primeira instalação exige internet e pode demorar.
4. Se houver erro, mantenha a janela e copie a mensagem. Não precisa ativar o ambiente pelo PowerShell.

## 2. Iniciar

Abra `iniciar_windows.bat` e espere aparecer `Application startup complete`.
A API carrega o modelo uma vez. Mantenha o terminal aberto e o notebook ligado e sem suspensão.
Para parar: Ctrl+C. Para voltar: abra o mesmo BAT.

No notebook, acesse http://127.0.0.1:8000/docs.
Abra **POST /analisar**, clique **Try it out**, escolha uma foto no campo `foto` e clique **Execute**.
A documentação /docs pode precisar de internet para carregar seus recursos de interface.
Teste simples sem essa interface: http://127.0.0.1:8000/saude.

Alternativa pelo terminal, dentro desta pasta:

```bat
.venv\Scripts\python.exe -m uvicorn app:app --host 0.0.0.0 --port 8000 --workers 1
```

## 3. Acessar pelo celular

- Coloque notebook e celular na mesma rede Wi-Fi.
- No Windows, execute `ipconfig` e encontre o **Endereço IPv4** do adaptador Wi-Fi ativo (exemplo: 192.168.1.100).
- No navegador do celular, abra `http://SEU_IP:8000/saude`. Deve retornar status ok.
- Se o Windows solicitar acesso para Python, permita somente na rede privada de confiança. Se não conectar, confira o Firewall para TCP 8000 na rede privada. Não desligue o Firewall inteiro nem abra portas no roteador.
- Redes de convidados podem bloquear comunicação entre aparelhos. O IP pode mudar ao reconectar.
- `localhost` no celular aponta para o próprio celular, não para o notebook. `0.0.0.0` é o endereço de escuta, não a URL do cliente.
- No emulador padrão do Android Studio, use `http://10.0.2.2:8000` para alcançar o notebook hospedeiro.

## 4. Conectar o TesteFolha

Copie a função de `react_native_exemplo.ts`, ajuste `API_URL` e passe a URI retornada pela biblioteca de câmera. Envie multipart/form-data com o campo **foto**. Não use Base64 nem defina manualmente Content-Type.
A função recebe JPEG por padrão. Ao enviar PNG/WebP, informe tipo e nome corretos.
O arquivo é um exemplo de integração; adapte o componente de câmera e seus estados. A câmera atual do projeto não foi fornecida.

Para desenvolvimento Android em HTTP, se ocorrer `CLEARTEXT communication not permitted`, mescle esta configuração na tag `<application>` do manifesto de debug existente (`android/app/src/debug/AndroidManifest.xml`):

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <application android:usesCleartextTraffic="true" />
</manifest>
```

Recompile o app após mudar o manifesto. Se já houver uma network security config, ajuste a configuração de debug correspondente. Não sobrescreva outras configurações. Para Expo, o ajuste depende do tipo de build/configuração nativa. Para produção, use HTTPS.

## 5. Rotas e resposta

- GET /saude: disponibilidade.
- GET /classes: classes e índices do modelo.
- POST /analisar: recebe foto JPEG, PNG ou WebP, até 10 MB e 25 milhões de pixels.

Exemplo ilustrativo (não é previsão real de uma imagem):

```json
{
  "classe_id": 6,
  "classe": "healthy",
  "nome_exibicao": "Saudável",
  "pontuacao": 0.92,
  "top3": [
    {"classe_id": 6, "classe": "healthy", "nome_exibicao": "Saudável", "pontuacao": 0.92},
    {"classe_id": 2, "classe": "brown_spot", "nome_exibicao": "brown_spot", "pontuacao": 0.05},
    {"classe_id": 10, "classe": "sunscald", "nome_exibicao": "sunscald", "pontuacao": 0.02}
  ],
  "modelo": "YOLO26n-cls",
  "aviso": "Previsão experimental. A pontuação não garante acerto nem valida que a foto seja de uma folha de fumo."
}
```

Nomes de doenças permanecem nos rótulos originais; traduções devem ser validadas pela equipe. O classificador sempre escolhe entre suas classes e não verifica se a imagem é realmente de fumo. Não há limiar arbitrário de diagnóstico implementado.

Erros: 400 imagem vazia/corrompida; 413 tamanho excedido; 415 formato não aceito; 422 campo foto ausente; 500 falha de inferência. As fotos não são gravadas pela aplicação nem enviadas a serviços de IA externos. Histórico/Firebase ficam para a integração do app.

## 6. Execução e hospedagem

Nesta primeira versão você inicia pelo BAT, sem instalar serviço do Windows. A API para se o processo fechar ou o notebook suspender. Para iniciar automaticamente no futuro, configure um serviço/gerenciador ou hospede o mesmo projeto em servidor.
Esta versão é destinada a testes em rede local, sem autenticação. Antes de disponibilizar na internet, inclua HTTPS, autenticação (por exemplo, validação do token Firebase), limites de requisições e configuração do servidor. Não basta abrir a porta do notebook.

O bloqueio de inferência serializa chamadas ao modelo. Use um worker durante testes locais; cada worker adicional carregaria outra cópia do modelo.

## 7. Conteúdo e referências

- app.py: API, leitura da imagem, inferência e resposta.
- modelos/best.pt: modelo original do ZIP recebido.
- requirements.txt: Ultralytics fixado na versão 8.4.174 do treinamento.
- instalar_windows.bat / iniciar_windows.bat: instalação e execução.
- react_native_exemplo.ts: envio da foto e timeout de 60 s (não cancela inferência já iniciada no servidor).
- VALIDACAO.md: testes realizados neste ambiente.

Fontes técnicas: https://fastapi.tiangolo.com/tutorial/request-files/ e https://docs.ultralytics.com/modes/predict/.
O checkpoint informa licença AGPL-3.0; preserve os termos aplicáveis ao distribuir o projeto/modelo.

# Validação realizada

- Checkpoint do ZIP é idêntico, por SHA-256, ao best.pt previamente fornecido.
- Carregamento e inferência reais com Ultralytics 8.4.174 em CPU.
- Requisição multipart via TestClient com imagem JPEG sintética: HTTP 200, top 3 consistente e classe/índice corretos.
- Saúde e listagem das 16 classes: aprovadas.
- Foto vazia e arquivo inválido: HTTP 400.
- Arquivo acima de 10 MB: HTTP 413.
- Campo foto ausente: HTTP 422.
- Formato BMP: HTTP 415.

Testado em Linux/Python 3.12 neste ambiente. Os BAT e a instalação Windows/Python 3.11 foram preparados, mas não executados no Windows. Integração com celular, câmera e Firewall ainda deve ser testada pela equipe.
A imagem sintética verifica execução; não mede acurácia. Não foram usadas as montagens val_batch como fotos de teste, pois contêm múltiplas imagens e rótulos.
O resumo de avaliação enviado pela equipe registra 185 imagens e acurácia de 83,24%; essa avaliação não foi reproduzida aqui.

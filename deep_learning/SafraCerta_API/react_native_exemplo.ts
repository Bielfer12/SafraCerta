// Copie esta função para o app. Troque o IP pelo IPv4 do notebook.
const API_URL = 'http://192.168.1.100:8000';

export type Previsao = {
  classe_id: number;
  classe: string;
  nome_exibicao: string;
  pontuacao: number;
};
export type Analise = Previsao & {
  top3: Previsao[];
  modelo: string;
  aviso: string;
};

// Recebe URI da câmera/galeria. MIME e nome devem corresponder ao arquivo real.
export async function analisarFoto(
  uri: string,
  tipo = 'image/jpeg',
  nome = 'folha.jpg',
): Promise<Analise> {
  const dados = new FormData();
  const fotoUri = uri.startsWith('/') ? `file://${uri}` : uri;
  dados.append('foto', { uri: fotoUri, type: tipo, name: nome } as any);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const resposta = await fetch(`${API_URL}/analisar`, {
      method: 'POST',
      body: dados,
      signal: controller.signal,
      // Não defina Content-Type: o fetch acrescenta o boundary do multipart.
    });
    const json = await resposta.json();
    if (!resposta.ok) {
      throw new Error(typeof json.detail === 'string' ? json.detail : 'Falha no envio da foto.');
    }
    return json as Analise;
  } finally {
    clearTimeout(timer);
  }
}

// Dentro do componente TesteFolha, após capturar a foto:
// setCarregando(true);
// try {
//   const resultado = await analisarFoto(foto.uri); // adapte à biblioteca de câmera
//   setResultado(resultado);
// } catch (erro) {
//   Alert.alert('Análise indisponível', 'Confira a conexão e se a API está ligada.');
// } finally {
//   setCarregando(false);
// }
// JSX: <Text>{resultado?.nome_exibicao}</Text>

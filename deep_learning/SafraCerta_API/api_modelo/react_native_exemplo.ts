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

export async function analisarFoto(
  uri: string,
  analiseId: string,
  idToken: string,
  tipo = 'image/jpeg',
  nome = 'folha.jpg',
): Promise<Analise | null> {
  const dados = new FormData();
  const fotoUri = uri.startsWith('/') ? `file://${uri}` : uri;
  dados.append('foto', { uri: fotoUri, type: tipo, name: nome } as any);
  dados.append('analise_id', analiseId);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const resposta = await fetch(`${API_URL}/analisar`, {
      method: 'POST',
      body: dados,
      headers: { Authorization: `Bearer ${idToken}` },
      signal: controller.signal,
    });
    const json = await resposta.json();
    if (resposta.status === 202) return null;
    if (!resposta.ok) {
      throw new Error(typeof json.detail === 'string' ? json.detail : 'Falha no envio da foto.');
    }
    return json as Analise;
  } finally {
    clearTimeout(timer);
  }
}

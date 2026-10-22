import { fetch } from "expo/fetch";
import { File } from "expo-file-system";
import { API_BASE_URL } from "../config/api";
import { analiseValida } from "../utils/localizacaoFolha";
import { autenticacao } from "./firebase";

const TIMEOUT_MS = 60_000;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export class ApiTimeoutError extends Error {
  constructor() {
    super("A análise excedeu o tempo limite de 60 segundos.");
    this.name = "ApiTimeoutError";
  }
}

const lerResposta = async (resposta) => {
  const texto = await resposta.text();

  if (!texto) return null;

  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
};

const obterMensagemErro = (json, status) => {
  if (typeof json?.detail === "string") return json.detail;
  if (typeof json?.message === "string") return json.message;

  if (Array.isArray(json?.detail)) {
    const mensagens = json.detail
      .map((item) => item?.msg)
      .filter((mensagem) => typeof mensagem === "string");
    if (mensagens.length > 0) return mensagens.join(" ");
  }

  return `A API não conseguiu analisar a foto (erro ${status}).`;
};

export async function analisarFoto(foto, analiseId, signal) {
  const dados = new FormData();
  const fotoUri = foto.uri.startsWith("/") ? `file://${foto.uri}` : foto.uri;
  const arquivo = new File(fotoUri);

  dados.append("foto", arquivo, foto.nome);
  dados.append("analise_id", analiseId);
  const conta = autenticacao.currentUser;
  if (!conta) throw new ApiError("Entre na sua conta para continuar.", 401);
  const token = await conta.getIdToken();
  if (autenticacao.currentUser?.uid !== conta.uid) throw new ApiError("A conta foi alterada. Entre novamente.", 401);

  const controller = new AbortController();
  let tempoEsgotado = false;
  const cancelar = () => controller.abort();
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(() => {
    tempoEsgotado = true;
    controller.abort();
  }, TIMEOUT_MS);

  signal?.addEventListener("abort", cancelar, { once: true });

  try {
    const resposta = await fetch(`${API_BASE_URL}/analisar`, {
      method: "POST",
      body: dados,
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    const json = await lerResposta(resposta);
    if (resposta.status === 202 && json?.analiseId === analiseId) return null;

    if (!resposta.ok) {
      throw new ApiError(obterMensagemErro(json, resposta.status), resposta.status);
    }

    if (!analiseValida(json)) {
      throw new ApiError("A API retornou uma resposta inválida.", resposta.status);
    }

    return json;
  } catch (erro) {
    if (tempoEsgotado) throw new ApiTimeoutError();
    throw erro;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancelar);
  }
}

import { collection, doc, getDocFromServer, getDocsFromServer, limit, onSnapshot, orderBy, query, startAfter, Timestamp, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { autenticacao, banco, funcoes } from "./firebase";

export const SITUACOES_ANALISE = {
  AGUARDANDO_ENVIO: "Aguardando envio",
  EM_PROCESSAMENTO: "Em processamento",
  CONCLUIDA: "Concluída",
  FALHOU: "Falhou",
  INTERROMPIDA: "Interrompida",
};
export const analisePendente = (status) =>
  ["AGUARDANDO_ENVIO", "EM_PROCESSAMENTO"].includes(status);
export const novaAnaliseId = () => doc(collection(banco, "analises")).id;
export const dataAnalise = (data) =>
  data
    ?.toDate?.()
    .toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) ||
  "Aguardando confirmação";

function traduzirErro(erro) {
  const codigo = String(erro.code || "").replace("functions/", "");
  const mensagens = {
    "permission-denied":
      "Seu perfil não tem acesso a esta análise. Confira sua sessão.",
    unauthenticated: "Sua sessão expirou. Entre novamente.",
    unavailable:
      "Sem conexão com o histórico. Confira a internet e tente novamente.",
    "not-found": "A análise, a foto ou o serviço ainda não está disponível.",
    "deadline-exceeded":
      "A confirmação demorou. Tente novamente com os mesmos dados.",
    "failed-precondition":
      "A consulta ainda não está disponível. Confira os filtros ou aguarde a preparação dos índices.",
  };
  const falha = new Error(
    codigo === "failed-precondition" && erro.message?.includes("talhão")
      ? erro.message
      : mensagens[codigo] ||
        "Não foi possível acessar o histórico. Tente novamente.",
  );
  falha.code = erro.code;
  return falha;
}

export async function operacaoAnalise(nome, dados) {
  try {
    return (await httpsCallable(funcoes, nome, { timeout: 130000 })(dados))
      .data;
  } catch (erro) {
    throw traduzirErro(erro);
  }
}

export async function buscarAnalise(id) {
  try {
    const registro = await getDocFromServer(doc(banco, "analises", id));
    if (!registro.exists()) throw { code: "not-found" };
    return { ...registro.data(), id: registro.id };
  } catch (erro) {
    throw traduzirErro(erro);
  }
}

export function acompanharAnalise(id, receber, falhar) {
  return onSnapshot(
    doc(banco, "analises", id),
    { includeMetadataChanges: true },
    (registro) => {
      if (registro.metadata.fromCache || registro.metadata.hasPendingWrites)
        return;
      if (registro.exists()) receber({ ...registro.data(), id: registro.id });
      else falhar(traduzirErro({ code: "not-found" }));
    },
    (erro) => falhar(traduzirErro(erro)),
  );
}

export async function listarAnalises(filtros, admin, pagina = null) {
  const uid = autenticacao.currentUser?.uid;
  if (!uid) throw traduzirErro({ code: "unauthenticated" });
  const restricoes = [];
  if (!admin || filtros.usuarioId)
    restricoes.push(where("usuarioId", "==", admin ? filtros.usuarioId : uid));
  for (const campo of ["talhaoId", "status"])
    if (filtros[campo]) restricoes.push(where(campo, "==", filtros[campo]));
  if (filtros.classe)
    restricoes.push(where("resultado.classe", "==", filtros.classe));
  if (filtros.inicio)
    restricoes.push(
      where("criadoEm", ">=", Timestamp.fromDate(filtros.inicio)),
    );
  restricoes.push(orderBy("criadoEm", "desc"));
  if (pagina) restricoes.push(startAfter(pagina));
  restricoes.push(limit(20));
  try {
    const resposta = await getDocsFromServer(
      query(collection(banco, "analises"), ...restricoes),
    );
    return {
      itens: resposta.docs.map((registro) => ({
        ...registro.data(),
        id: registro.id,
      })),
      pagina: resposta.docs.at(-1) || null,
      temMais: resposta.size === 20,
    };
  } catch (erro) {
    throw traduzirErro(erro);
  }
}

// Quantidade máxima de análises lidas para montar o dashboard. Limita leituras
// do Firestore e o volume baixado em conexões instáveis. Quando há mais registros
// no filtro, `truncado` fica verdadeiro e a tela avisa.
export const LIMITE_DASHBOARD = 500;

// Usa apenas filtros que já têm índice em firestore.indexes.json:
// usuarioId/talhaoId (opcionais) + criadoEm. Funcionário sempre consulta só o
// próprio usuarioId, como exigem as regras do Firestore.
export async function listarAnalisesPainel(filtros, admin) {
  const uid = autenticacao.currentUser?.uid;
  if (!uid) throw traduzirErro({ code: "unauthenticated" });
  const restricoes = [];
  if (!admin || filtros.usuarioId)
    restricoes.push(where("usuarioId", "==", admin ? filtros.usuarioId : uid));
  if (filtros.talhaoId)
    restricoes.push(where("talhaoId", "==", filtros.talhaoId));
  if (filtros.inicio)
    restricoes.push(
      where("criadoEm", ">=", Timestamp.fromDate(filtros.inicio)),
    );
  restricoes.push(orderBy("criadoEm", "desc"), limit(LIMITE_DASHBOARD + 1));
  try {
    const resposta = await getDocsFromServer(
      query(collection(banco, "analises"), ...restricoes),
    );
    return {
      itens: resposta.docs
        .slice(0, LIMITE_DASHBOARD)
        .map((registro) => ({ ...registro.data(), id: registro.id })),
      truncado: resposta.size > LIMITE_DASHBOARD,
    };
  } catch (erro) {
    throw traduzirErro(erro);
  }
}

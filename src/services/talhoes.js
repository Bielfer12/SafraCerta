import { collection, doc, getDocFromServer, getDocsFromServer, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { banco, funcoes } from "./firebase";

export function novaOperacaoTalhao() {
  return doc(collection(banco, "_operacoes_talhoes")).id;
}

function erroConsulta(erro) {
  const mensagens = {
    "permission-denied":
      "Seu perfil não tem acesso aos talhões. Confira sua sessão com o administrador.",
    unavailable: "Sem conexão com o banco. Confira a internet e tente novamente.",
    unauthenticated: "Sua sessão expirou. Entre novamente.",
  };
  const falha = new Error(
    mensagens[erro.code] || "Não foi possível consultar os talhões. Tente novamente.",
  );
  falha.code = erro.code;
  return falha;
}

export async function listarTalhoes(somenteAtivos = false) {
  try {
    const referencia = collection(banco, "talhoes");
    const consulta = somenteAtivos ? query(referencia, where("status", "==", "ATIVO")) : referencia;
    const resposta = await getDocsFromServer(consulta);
    return resposta.docs
      .map((registro) => ({ ...registro.data(), id: registro.id }))
      .sort(
        (a, b) =>
          String(a.nome).localeCompare(String(b.nome), "pt-BR") ||
          String(a.codigo).localeCompare(String(b.codigo), "pt-BR"),
      );
  } catch (erro) {
    throw erroConsulta(erro);
  }
}

export async function confirmarTalhaoAtivo(id) {
  let registro;
  try {
    registro = await getDocFromServer(doc(banco, "talhoes", id));
  } catch (erro) {
    throw erroConsulta(erro);
  }
  if (!registro.exists() || registro.data().status !== "ATIVO") {
    const erro = new Error(
      "Este talhão foi excluído ou inativado. Selecione outro talhão para analisar a foto.",
    );
    erro.code = "talhao/indisponivel";
    throw erro;
  }
  return { ...registro.data(), id: registro.id };
}

export async function executarOperacaoTalhao(nome, dados) {
  try {
    return (await httpsCallable(funcoes, nome, { timeout: 130000 })(dados)).data;
  } catch (erro) {
    const mensagens = {
      "functions/unavailable":
        "Sem conexão com o serviço de talhões. Confira a internet e tente novamente.",
      "functions/deadline-exceeded":
        "A confirmação demorou para chegar. Tente novamente com os mesmos dados.",
      "functions/not-found":
        "O serviço de talhões ainda não está disponível ou o registro foi removido. Atualize a lista.",
      "functions/unauthenticated": "Sua sessão expirou. Entre novamente.",
    };
    const falha = new Error(
      mensagens[erro.code] || erro.message || "Não foi possível concluir a operação de talhões.",
    );
    falha.campos = erro.details?.campos || {};
    falha.code = erro.code;
    throw falha;
  }
}

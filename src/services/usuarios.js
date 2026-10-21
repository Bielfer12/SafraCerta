import { collection, doc, getDocsFromServer } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { banco, funcoes } from "./firebase";

export function novaOperacaoCadastro() {
  return doc(collection(banco, "_operacoes_usuarios")).id;
}

export async function listarUsuarios() {
  try {
    const resultado = await getDocsFromServer(collection(banco, "usuarios"));
    return resultado.docs.map((registro) => {
      const dados = registro.data();
      const originais = {};
      for (const campo of [
        "nomeCompleto", "matricula", "emailInstitucional", "telefone",
        "tipoUsuario", "statusConta", "cadastroPendente", "exclusaoPendente",
      ]) {
        originais[campo] = dados[campo] ?? null;
      }
      return {
        uid: registro.id,
        nomeCompleto: dados.nomeCompleto || "Sem nome",
        matricula: String(dados.matricula ?? ""),
        emailInstitucional: dados.emailInstitucional || "",
        telefone: dados.telefone || "",
        tipoUsuario: dados.tipoUsuario || "",
        statusConta: dados.statusConta || "",
        cadastroPendente: Boolean(dados.cadastroPendente),
        exclusaoPendente: Boolean(dados.exclusaoPendente),
        cadastroId: dados.cadastroPendente ? dados.cadastroId : null,
        originais,
      };
    }).sort((primeiro, segundo) =>
      primeiro.nomeCompleto.localeCompare(segundo.nomeCompleto, "pt-BR")
        || primeiro.uid.localeCompare(segundo.uid),
    );
  } catch (erro) {
    const mensagens = {
      "permission-denied": "A consulta de usuários não foi autorizada. Confira o acesso com o responsável pelo sistema.",
      "unavailable": "Sem conexão com o banco. Confira a internet e tente novamente.",
      "unauthenticated": "Sua sessão expirou. Entre novamente.",
    };
    throw new Error(mensagens[erro.code] || "Não foi possível carregar os usuários. Tente novamente.");
  }
}

export async function executarOperacaoUsuarios(nome, dados = {}) {
  try {
    const resposta = await httpsCallable(funcoes, nome, { timeout: 130000 })(dados);
    return resposta.data;
  } catch (erro) {
    const mensagens = {
      "functions/unavailable": "Sem conexão com o serviço de usuários. Confira a internet e tente novamente.",
      "functions/deadline-exceeded":
        "O serviço demorou para responder. Atualize a lista antes de repetir a operação.",
      "functions/not-found":
        "O serviço de usuários não está disponível ou o cadastro foi removido. Atualize a lista e tente novamente.",
      "functions/unauthenticated": "Sua sessão expirou. Entre novamente.",
    };
    const falha = new Error(
      mensagens[erro.code] || erro.message || "Não foi possível concluir a operação. Tente novamente.",
    );
    falha.campos = erro.details?.campos || {};
    falha.code = erro.code;
    throw falha;
  }
}

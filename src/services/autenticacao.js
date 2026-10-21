import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { autenticacao, banco } from "./firebase";

export const MENSAGEM_LOGIN_INVALIDO = "Matrícula ou senha inválidos";
export const MENSAGEM_CONTA_DESATIVADA = "Conta desativada";

export function normalizarMatricula(valor) {
  return String(valor ?? "").trim().replace(/\s+/g, "");
}

export async function entrarComMatricula(matriculaInformada, senha) {
  const matricula = normalizarMatricula(matriculaInformada);
  let autenticou = false;

  try {
    if (!matricula || typeof senha !== "string" || !senha) {
      throw new Error(MENSAGEM_LOGIN_INVALIDO);
    }

    const loginSnapshot = await getDoc(doc(banco, "login_por_matricula", matricula));
    const email = loginSnapshot.exists() ? loginSnapshot.data()?.email : null;

    if (typeof email !== "string" || !email.trim()) {
      throw new Error(MENSAGEM_LOGIN_INVALIDO);
    }

    const credencial = await signInWithEmailAndPassword(
      autenticacao,
      email.trim().toLowerCase(),
      senha,
    );
    autenticou = true;

    const perfilSnapshot = await getDoc(doc(banco, "usuarios", credencial.user.uid));
    if (!perfilSnapshot.exists()) {
      throw new Error(MENSAGEM_LOGIN_INVALIDO);
    }

    const perfil = {
      ...perfilSnapshot.data(),
      uid: credencial.user.uid,
    };

    if (perfil.statusConta !== "ATIVO" || perfil.cadastroPendente || perfil.exclusaoPendente) {
      throw new Error(MENSAGEM_CONTA_DESATIVADA);
    }

    return { usuario: credencial.user, perfil };
  } catch (error) {
    if (autenticou) {
      await signOut(autenticacao).catch(() => undefined);
    }

    if (error instanceof Error && error.message === MENSAGEM_CONTA_DESATIVADA) {
      throw error;
    }

    throw new Error(MENSAGEM_LOGIN_INVALIDO);
  }
}

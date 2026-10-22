import { createContext, useContext, useEffect, useState } from "react";
import { AppState } from "react-native";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDocFromServer, onSnapshot } from "firebase/firestore";
import { autenticacao, banco } from "../services/firebase";

const SessaoContext = createContext(null);

export function SessaoProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [confirmado, setConfirmado] = useState(false);
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    let cancelarPerfil = () => {};
    let geracao = 0;
    const cancelarAuth = onAuthStateChanged(autenticacao, (conta) => {
      cancelarPerfil();
      geracao += 1;
      const atual = geracao;
      setUsuario(conta);
      setPerfil(null);
      setConfirmado(false);
      setCarregando(Boolean(conta));
      if (!conta) return;
      setMensagem("");
      let ultimoTipo = null;
      cancelarPerfil = onSnapshot(
        doc(banco, "usuarios", conta.uid),
        { includeMetadataChanges: true },
        (registro) => {
          if (atual !== geracao) return;
          const dados = registro.data();
          if (
            !registro.metadata.fromCache &&
            (!dados || dados.statusConta !== "ATIVO" || dados.cadastroPendente || dados.exclusaoPendente)
          ) {
            setPerfil(null);
            setConfirmado(false);
            setMensagem("Sua conta está indisponível. Entre em contato com um administrador.");
            signOut(autenticacao).catch(() => setCarregando(false));
            return;
          }
          if (!registro.metadata.fromCache) {
            if (ultimoTipo === "ADMIN" && dados?.tipoUsuario !== "ADMIN") {
              setMensagem("Seu acesso administrativo foi encerrado. As demais funções continuam disponíveis.");
            } else if (ultimoTipo && dados?.tipoUsuario === "ADMIN") {
              setMensagem("");
            }
            ultimoTipo = dados?.tipoUsuario;
          }
          setPerfil(dados ? { ...dados, uid: conta.uid } : null);
          setConfirmado(!registro.metadata.fromCache && !registro.metadata.hasPendingWrites);
          setCarregando(false);
        },
        () => {
          if (atual !== geracao) return;
          setPerfil(null);
          setConfirmado(false);
          setCarregando(false);
          setMensagem("Não foi possível verificar o seu perfil. Confira a conexão e entre novamente.");
        },
      );
    });
    const evento = AppState.addEventListener("change", async (estado) => {
      setConfirmado(false);
      if (estado !== "active" || !autenticacao.currentUser) return;
      const conta = autenticacao.currentUser;
      const atual = geracao;
      try {
        await conta.reload();
        const registro = await getDocFromServer(doc(banco, "usuarios", conta.uid));
        if (atual !== geracao) return;
        const dados = registro.data();
        if (!dados || dados.statusConta !== "ATIVO" || dados.cadastroPendente || dados.exclusaoPendente) {
          setMensagem("Sua conta está indisponível. Entre em contato com um administrador.");
          await signOut(autenticacao);
          return;
        }
        setPerfil({ ...dados, uid: conta.uid });
        setConfirmado(true);
      } catch (erro) {
        if (atual !== geracao) return;
        if (["auth/user-disabled", "auth/user-token-expired", "auth/user-not-found"].includes(erro.code)) {
          await signOut(autenticacao);
        }
      }
    });
    return () => {
      geracao += 1;
      cancelarAuth();
      cancelarPerfil();
      evento.remove();
    };
  }, []);

  const admin =
    confirmado &&
    perfil?.tipoUsuario === "ADMIN" &&
    perfil?.statusConta === "ATIVO" &&
    !perfil?.exclusaoPendente &&
    !perfil?.cadastroPendente;
  const acessoTalhoes = confirmado
    && ["ADMIN", "FUNCIONARIO"].includes(perfil?.tipoUsuario)
    && perfil?.statusConta === "ATIVO" && !perfil?.exclusaoPendente && !perfil?.cadastroPendente;
  return (
    <SessaoContext.Provider value={{ usuario, perfil, carregando, admin, acessoTalhoes, mensagem }}>
      {children}
    </SessaoContext.Provider>
  );
}

export function useSessao() {
  return useContext(SessaoContext);
}

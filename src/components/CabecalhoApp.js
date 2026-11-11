import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { signOut } from "firebase/auth";
import { autenticacao } from "../services/firebase";
import { useSessao } from "../context/Sessao";

export default function CabecalhoApp({ titulo, iconeAcao, rotuloAcao, aoPressionarAcao }) {
  const [contaAberta, setContaAberta] = useState(false);
  const { perfil, admin } = useSessao();
  const email = autenticacao.currentUser?.email || "Usuário";
  const nome = perfil?.nomeCompleto || email;
  const inicial = nome.charAt(0).toUpperCase();

  return (
    <View style={styles.cabecalho}>
      <View style={styles.marca}>
        <Ionicons name="leaf" size={19} color="#94F990" />
      </View>
      <Text accessibilityRole="header" numberOfLines={1} style={styles.titulo}>{titulo}</Text>
      {aoPressionarAcao ? (
        <Pressable accessibilityRole="button" accessibilityLabel={rotuloAcao} onPress={aoPressionarAcao} style={styles.acao}>
          <Ionicons name={iconeAcao} size={21} color="#1B5E20" />
        </Pressable>
      ) : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Abrir conta" onPress={() => setContaAberta(true)} style={styles.avatar}>
        <Text style={styles.textoAvatar}>{inicial}</Text>
      </Pressable>

      <Modal transparent visible={contaAberta} animationType="fade" onRequestClose={() => setContaAberta(false)}>
        <Pressable accessibilityLabel="Fechar conta" style={styles.fundo} onPress={() => setContaAberta(false)}>
          <Pressable style={styles.conta}>
            <View style={styles.linhaConta}>
              <View style={styles.avatarConta}>
                <Text style={styles.textoAvatar}>{inicial}</Text>
              </View>
              <View style={styles.dadosConta}>
                <Text numberOfLines={1} style={styles.nome}>{nome}</Text>
                <Text style={styles.tipo}>{admin ? "Admin" : "Funcionário"}</Text>
              </View>
            </View>
            <Pressable accessibilityRole="button" onPress={() => signOut(autenticacao)} style={styles.sair}>
              <Ionicons name="log-out-outline" size={21} color="#BA1A1A" />
              <Text style={styles.textoSair}>Sair da conta</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  cabecalho: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 10,
    paddingHorizontal: 8,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: "#DDE5D8",
    backgroundColor: "#FFFFFF",
    elevation: 3,
    shadowColor: "#1A1C19",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  marca: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: "#1B5E20" },
  titulo: { flex: 1, color: "#1A1C19", fontSize: 18, fontWeight: "700" },
  acao: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
  avatar: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: "#E4F4DE" },
  textoAvatar: { color: "#00450D", fontSize: 16, fontWeight: "800" },
  fundo: { flex: 1, justifyContent: "flex-end", padding: 12, backgroundColor: "rgba(10, 28, 14, 0.42)" },
  conta: { gap: 16, padding: 20, borderRadius: 28, backgroundColor: "#FFFFFF" },
  linhaConta: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarConta: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#E4F4DE" },
  dadosConta: { flex: 1 },
  nome: { color: "#1A1C19", fontSize: 16, fontWeight: "700" },
  tipo: { color: "#596155", fontSize: 13, marginTop: 2 },
  sair: { height: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 16, backgroundColor: "#FBE9E7" },
  textoSair: { color: "#BA1A1A", fontSize: 15, fontWeight: "700" },
});

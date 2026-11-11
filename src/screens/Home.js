import { StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { autenticacao } from "../services/firebase";
import { useSessao } from "../context/Sessao";
import CabecalhoApp from "../components/CabecalhoApp";

export default function Home() {
  const { perfil, mensagem } = useSessao();
  const email = autenticacao.currentUser?.email || "Usuário";

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <CabecalhoApp titulo="Início" />

      <View style={styles.conteudo}>
        <Text style={styles.titulo}>Olá, {perfil?.nomeCompleto?.split(" ")[0] || email.split("@")[0]}</Text>
        <Text style={styles.subtitulo}>Bem-vindo à sua lavoura.</Text>
        {mensagem ? <Text style={styles.subtitulo}>{mensagem}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8F4",
  },
  conteudo: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 14,
  },
  titulo: {
    color: "#1A1C19",
    fontSize: 25,
    fontWeight: "800",
  },
  subtitulo: {
    color: "#596155",
    fontSize: 16,
    marginTop: 5,
  },
});

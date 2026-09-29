import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { autenticacao } from "../services/firebase";

export default function Home() {
  const [menuAberto, setMenuAberto] = useState(false);
  const email = autenticacao.currentUser?.email || "Usuário";
  const inicial = email.charAt(0).toUpperCase();

  const abrirTesteFolha = () => {
    setMenuAberto(false);
    setTimeout(() => router.push("/teste-folha"), 350);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar style="light" />

      <View style={styles.cabecalho}>
        <TouchableOpacity
          accessibilityLabel="Abrir menu"
          style={styles.botaoCabecalho}
          onPress={() => setMenuAberto(true)}
        >
          <Ionicons name="menu" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.tituloCabecalho}>SafraCerta</Text>

        <View style={styles.perfil}>
          <Text style={styles.textoPerfil}>{inicial}</Text>
        </View>
      </View>

      <View style={styles.conteudo}>
        <Text style={styles.titulo}>Olá, {email.split("@")[0]}</Text>
        <Text style={styles.subtitulo}>Bem-vindo à sua lavoura.</Text>
      </View>

      <Modal transparent visible={menuAberto} animationType="slide" onRequestClose={() => setMenuAberto(false)}>
        <View style={styles.sobreposicao}>
          <SafeAreaView style={styles.menuLateral} edges={["top", "bottom"]}>
            <View style={styles.topoMenu}>
              <Text style={styles.marcaMenu}>SafraCerta</Text>
              <TouchableOpacity accessibilityLabel="Fechar menu" onPress={() => setMenuAberto(false)}>
                <Ionicons name="close" size={27} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.itemMenu} onPress={() => setMenuAberto(false)}>
              <Ionicons name="home" size={22} color="#FFFFFF" />
              <Text style={styles.textoItemMenu}>Home</Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityLabel="Teste folha"
              style={[styles.itemMenu, styles.itemMenuSecundario]}
              onPress={abrirTesteFolha}
            >
              <Ionicons name="leaf-outline" size={22} color="#FFFFFF" />
              <Text style={styles.textoItemMenu}>Teste folha</Text>
            </TouchableOpacity>
          </SafeAreaView>

          <Pressable style={styles.fundoMenu} onPress={() => setMenuAberto(false)} />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8F4",
  },
  cabecalho: {
    height: 68,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1B5E20",
    paddingHorizontal: 16,
    elevation: 4,
  },
  botaoCabecalho: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  tituloCabecalho: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  perfil: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "#E4F4DE",
  },
  textoPerfil: {
    color: "#1B5E20",
    fontSize: 17,
    fontWeight: "800",
  },
  conteudo: {
    flex: 1,
    padding: 24,
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
  sobreposicao: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "rgba(0, 0, 0, 0.42)",
  },
  menuLateral: {
    width: "82%",
    backgroundColor: "#1B5E20",
    paddingHorizontal: 18,
  },
  topoMenu: {
    height: 68,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.2)",
  },
  marcaMenu: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
  },
  itemMenu: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    marginTop: 20,
    paddingHorizontal: 14,
  },
  itemMenuSecundario: {
    backgroundColor: "transparent",
    marginTop: 4,
  },
  textoItemMenu: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  fundoMenu: {
    flex: 1,
  },
});

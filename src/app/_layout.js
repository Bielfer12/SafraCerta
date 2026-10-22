import { Stack } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessaoProvider, useSessao } from "../context/Sessao";

function Navegacao() {
  const { usuario, carregando, admin, acessoTalhoes } = useSessao();
  if (carregando) {
    return (
      <View style={styles.carregando}>
        <ActivityIndicator size="large" color="#1B5E20" />
        <Text style={styles.texto}>Verificando acesso...</Text>
      </View>
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!usuario}>
        <Stack.Screen name="index" />
      </Stack.Protected>
      <Stack.Protected guard={Boolean(usuario)}>
        <Stack.Screen name="home" />
        <Stack.Screen name="teste-folha" />
      </Stack.Protected>
      <Stack.Protected guard={admin}>
        <Stack.Screen name="usuarios" />
      </Stack.Protected>
      <Stack.Protected guard={acessoTalhoes}>
        <Stack.Screen name="talhoes" />
        <Stack.Screen name="historico" />
        <Stack.Screen name="analise/[id]" />
      </Stack.Protected>
    </Stack>
  );
}

export default function Layout() {
  return (
    <SafeAreaProvider>
      <SessaoProvider>
        <Navegacao />
      </SessaoProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  carregando: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F8F4",
    gap: 16,
  },
  texto: { color: "#596155", fontSize: 16 },
});

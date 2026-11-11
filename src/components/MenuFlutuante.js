import { useEffect, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSessao } from "../context/Sessao";

function ItemMenu({ icone, rotulo, ativo, aoPressionar }) {
  const [abertura] = useState(() => new Animated.Value(ativo ? 1 : 0));

  useEffect(() => {
    Animated.timing(abertura, { toValue: ativo ? 1 : 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [ativo, abertura]);

  const largura = abertura.interpolate({ inputRange: [0, 1], outputRange: [48, 66] });
  const fundo = abertura.interpolate({ inputRange: [0, 1], outputRange: ["rgba(228, 244, 222, 0)", "rgba(228, 244, 222, 1)"] });

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={rotulo} accessibilityState={{ selected: ativo }} onPress={aoPressionar}>
      <Animated.View style={[styles.item, { width: largura, backgroundColor: fundo }]}>
        <Ionicons name={icone} size={22} color={ativo ? "#1B5E20" : "#596155"} />
      </Animated.View>
    </Pressable>
  );
}

export default function MenuFlutuante() {
  const caminho = usePathname();
  const margens = useSafeAreaInsets();
  const { admin, acessoTalhoes } = useSessao();

  const itens = [{ rota: "/home", icone: "home-outline", rotulo: "Home" }];
  if (acessoTalhoes) {
    itens.push({ rota: "/talhoes", icone: "map-outline", rotulo: "Talhões" });
    itens.push({ rota: "/historico", icone: "time-outline", rotulo: "Histórico" });
  }
  if (admin) {
    itens.push({ rota: "/dashboard", icone: "stats-chart-outline", rotulo: "Dashboard" });
    itens.push({ rota: "/usuarios", icone: "people-outline", rotulo: "Usuários" });
  }

  if (caminho !== "/teste-folha" && !itens.some((item) => item.rota === caminho)) return null;

  const abrir = (rota) => {
    if (rota === caminho) return;
    if (rota === "/home") router.dismissTo("/home");
    else if (caminho === "/home") router.push(rota);
    else router.replace(rota);
  };

  const testeAtivo = caminho === "/teste-folha";

  return (
    <View pointerEvents="box-none" style={[styles.menu, { bottom: margens.bottom + 16 }]}>
      <View style={styles.balao}>
        {itens.map((item) => (
          <ItemMenu key={item.rota} icone={item.icone} rotulo={item.rotulo} ativo={caminho === item.rota} aoPressionar={() => abrir(item.rota)} />
        ))}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Teste folha" accessibilityState={{ selected: testeAtivo }} onPress={() => abrir("/teste-folha")} style={[styles.botaoTeste, testeAtivo && styles.botaoTesteAtivo]}>
        <Ionicons name="leaf" size={26} color="#94F990" />
      </Pressable>
    </View>
  );
}

const sombra = { elevation: 8, shadowColor: "#1A1C19", shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } };

const styles = StyleSheet.create({
  menu: { position: "absolute", left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  balao: { flexDirection: "row", alignItems: "center", padding: 6, borderRadius: 30, borderWidth: 1, borderColor: "#DDE5D8", backgroundColor: "#FFFFFF", ...sombra },
  item: { height: 48, alignItems: "center", justifyContent: "center", borderRadius: 24 },
  botaoTeste: { width: 60, height: 60, alignItems: "center", justifyContent: "center", borderRadius: 30, borderWidth: 2, borderColor: "#1B5E20", backgroundColor: "#1B5E20", ...sombra },
  botaoTesteAtivo: { borderColor: "#94F990" },
});

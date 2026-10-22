import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { calcularMarcacao } from "../utils/localizacaoFolha";

export default function ImagemAnaliseFolha({ uri, resultado, mostrarMarcacoes, style, aoFalhar }) {
  const [visor, setVisor] = useState({ largura: 0, altura: 0 });
  const [exibida, setExibida] = useState(false);
  const folhas = resultado?.deteccao_folha?.estado === "concluido" ? resultado.deteccao_folha.itens : [];
  const lesoes = resultado?.deteccao_lesoes?.estado === "concluido" ? resultado.deteccao_lesoes.itens : [];
  const marcacoes = [...folhas, ...lesoes];

  return (
    <View
      style={[styles.container, style]}
      onLayout={({ nativeEvent }) => {
        const { width, height } = nativeEvent.layout;
        setVisor((atual) => atual.largura === width && atual.altura === height
          ? atual : { largura: width, altura: height });
      }}
    >
      <Image
        accessibilityLabel="Foto da folha selecionada para análise"
        source={uri}
        cachePolicy="none"
        contentFit="contain"
        contentPosition="center"
        priority="high"
        onDisplay={() => setExibida(true)}
        onError={aoFalhar}
        style={StyleSheet.absoluteFill}
      />
      {mostrarMarcacoes && exibida ? (
        <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
          {marcacoes.map((item) => {
            const posicao = calcularMarcacao(item.caixa_xyxyn, resultado.imagem, visor);
            if (!posicao) return null;
            const lesao = item.classe === "lesao";
            return (
              <View key={`${item.classe}-${item.id}`} style={[styles.caixa, lesao && styles.caixaLesao, posicao]}>
                <Text style={[styles.etiqueta, lesao && styles.etiquetaLesao]}>
                  {lesao ? item.id : "Folha"}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#2F312E", overflow: "hidden" },
  caixa: { position: "absolute", borderWidth: 2, borderColor: "#94F990" },
  caixaLesao: { borderColor: "#FFB86B", borderWidth: 3 },
  etiqueta: { alignSelf: "flex-start", backgroundColor: "#00450D", color: "#FFFFFF", paddingHorizontal: 6, paddingVertical: 3, fontSize: 13, fontWeight: "700" },
  etiquetaLesao: { backgroundColor: "#B95000" },
});

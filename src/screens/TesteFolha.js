import { useRef, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TesteFolha() {
  const camera = useRef(null);
  const [permissaoCamera, pedirPermissaoCamera] = useCameraPermissions();
  const [foto, setFoto] = useState(null);
  const [cameraAberta, setCameraAberta] = useState(false);
  const [cameraPronta, setCameraPronta] = useState(false);
  const [tirandoFoto, setTirandoFoto] = useState(false);
  const [dicasAbertas, setDicasAbertas] = useState(false);

  const abrirCamera = async () => {
    let permissao = permissaoCamera;

    if (!permissao?.granted) {
      permissao = await pedirPermissaoCamera();
    }

    if (!permissao.granted) {
      Alert.alert(
        "Permissão necessária",
        "Autorize o acesso à câmera para fotografar a folha.",
      );
      return;
    }

    setCameraPronta(false);
    setCameraAberta(true);
  };

  const tirarFoto = async () => {
    if (!camera.current || !cameraPronta || tirandoFoto) return;

    setTirandoFoto(true);

    try {
      const resultado = await camera.current.takePictureAsync({
        quality: 0.85,
      });

      setFoto(resultado.uri);
      setCameraAberta(false);
    } catch {
      Alert.alert(
        "Câmera indisponível",
        "Não foi possível fotografar a folha. Tente novamente.",
      );
    } finally {
      setTirandoFoto(false);
    }
  };

  const escolherArquivo = async () => {
    try {
      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.85,
      });

      if (!resultado.canceled) {
        setFoto(resultado.assets[0].uri);
      }
    } catch {
      Alert.alert(
        "Arquivo indisponível",
        "Não foi possível abrir a galeria. Tente novamente.",
      );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar style="dark" />

      <Modal
        animationType="slide"
        onRequestClose={() => setCameraAberta(false)}
        presentationStyle="fullScreen"
        visible={cameraAberta}
      >
        <View style={styles.cameraTelaCheia}>
          <CameraView
            ref={camera}
            active={cameraAberta}
            facing="back"
            mode="picture"
            onCameraReady={() => setCameraPronta(true)}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView style={styles.cameraInterface}>
            <TouchableOpacity
              accessibilityLabel="Fechar câmera"
              onPress={() => setCameraAberta(false)}
              style={styles.fecharCamera}
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <View pointerEvents="none" style={styles.guiaCamera}>
              <Ionicons name="leaf-outline" size={42} color="#94F990" />
              <Text style={styles.textoGuiaCamera}>Centralize a folha</Text>
            </View>
            <TouchableOpacity
              accessibilityLabel="Tirar foto"
              disabled={!cameraPronta || tirandoFoto}
              onPress={tirarFoto}
              style={[
                styles.disparador,
                (!cameraPronta || tirandoFoto) && styles.disparadorDesativado,
              ]}
            >
              <View style={styles.disparadorCentro} />
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </Modal>

      <View style={styles.cabecalho}>
        <TouchableOpacity
          accessibilityLabel="Voltar"
          style={styles.botaoIcone}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1C19" />
        </TouchableOpacity>
        <Text style={styles.tituloCabecalho}>Diagnosticar</Text>
        <View style={styles.logoFolha}>
          <Ionicons name="leaf" size={19} color="#00450D" />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.conteudo}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity activeOpacity={0.8} style={styles.talhao}>
          <View style={styles.iconeTalhao}>
            <Ionicons name="map" size={20} color="#00450D" />
          </View>
          <View style={styles.textosTalhao}>
            <Text style={styles.rotuloTalhao}>Talhão selecionado</Text>
            <Text style={styles.nomeTalhao}>Talhão 02 • Capivaras do Meio</Text>
          </View>
          <Ionicons name="chevron-down" size={20} color="#41493E" />
        </TouchableOpacity>

        <View style={styles.visor}>
          {foto ? (
            <Image
              accessibilityLabel="Folha selecionada para análise"
              source={{ uri: foto }}
              resizeMode="cover"
              style={styles.camera}
            />
          ) : (
            <View style={styles.camera} />
          )}

          {!foto && (
            <>
              <View style={styles.controlesSuperiores}>
                <View style={styles.distancia}>
                  <Ionicons name="resize-outline" size={18} color="#00450D" />
                  <Text style={styles.textoDistancia}>15–20 cm</Text>
                </View>
              </View>

              <View pointerEvents="none" style={styles.alvo}>
                <View style={[styles.canto, styles.cantoSuperiorEsquerdo]} />
                <View style={[styles.canto, styles.cantoSuperiorDireito]} />
                <View style={[styles.canto, styles.cantoInferiorEsquerdo]} />
                <View style={[styles.canto, styles.cantoInferiorDireito]} />
                <View style={styles.focoCentral}>
                  <Ionicons name="scan" size={28} color="#002204" />
                </View>
              </View>
            </>
          )}

          <View style={styles.estadoFoco}>
            <View style={styles.pontoFoco} />
            <Text style={styles.textoEstadoFoco}>
              {foto ? "Imagem pronta para análise" : "Posicione a folha no centro"}
            </Text>
          </View>
        </View>

        <View style={styles.dicas}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ expanded: dicasAbertas }}
            activeOpacity={0.7}
            style={[styles.topoDicas, dicasAbertas && styles.topoDicasAberto]}
            onPress={() => setDicasAbertas((abertas) => !abertas)}
          >
            <Text style={styles.tituloDicas}>
              Como obter o melhor resultado
            </Text>
            <Ionicons
              name={dicasAbertas ? "chevron-up" : "chevron-down"}
              size={20}
              color="#41493E"
            />
          </TouchableOpacity>
          {dicasAbertas && (
            <View style={styles.listaDicas}>
              <View style={styles.dica}>
                <Ionicons name="scan-outline" size={21} color="#00450D" />
                <Text style={styles.textoDica}>15 a 20 cm</Text>
              </View>
              <View style={styles.dica}>
                <Ionicons name="sunny-outline" size={21} color="#795C51" />
                <Text style={styles.textoDica}>Sem sombras</Text>
              </View>
              <View style={styles.dica}>
                <Ionicons name="hand-left-outline" size={21} color="#00450D" />
                <Text style={styles.textoDica}>Folha firme</Text>
              </View>
            </View>
          )}
        </View>

        {foto ? (
          <TouchableOpacity
            style={styles.botaoPrincipal}
            onPress={() =>
              Alert.alert(
                "Imagem pronta",
                "A folha foi carregada e está pronta para análise.",
              )
            }
          >
            <View style={styles.iconeBotaoPrincipal}>
              <Ionicons name="sparkles" size={24} color="#002204" />
            </View>
            <View style={styles.textosBotaoPrincipal}>
              <Text style={styles.tituloBotaoPrincipal}>
                Escanear folha agora
              </Text>
              <Text style={styles.subtituloBotaoPrincipal}>
                Usar a imagem selecionada
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={25} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            disabled={tirandoFoto}
            style={styles.botaoPrincipal}
            onPress={abrirCamera}
          >
            <View style={styles.iconeBotaoPrincipal}>
              <Ionicons name="camera" size={24} color="#002204" />
            </View>
            <View style={styles.textosBotaoPrincipal}>
              <Text style={styles.tituloBotaoPrincipal}>
                {tirandoFoto ? "Capturando..." : "Fotografar folha"}
              </Text>
              <Text style={styles.subtituloBotaoPrincipal}>
                Manter o aparelho firme
              </Text>
            </View>
            <Ionicons name="radio-button-on" size={27} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        <View style={styles.acoesSecundarias}>
          <TouchableOpacity
            style={styles.botaoSecundario}
            onPress={escolherArquivo}
          >
            <Ionicons name="images-outline" size={23} color="#41493E" />
            <Text style={styles.textoBotaoSecundario}>Enviar arquivo</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAF5" },
  cameraTelaCheia: { flex: 1, backgroundColor: "#151713" },
  cameraInterface: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  fecharCamera: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    borderRadius: 24,
    backgroundColor: "rgba(21,23,19,0.64)",
    marginTop: 12,
  },
  guiaCamera: {
    width: "82%",
    aspectRatio: 0.8,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 3,
    borderColor: "#94F990",
    borderRadius: 28,
  },
  textoGuiaCamera: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.72)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  disparador: {
    width: 78,
    height: 78,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#FFFFFF",
    borderRadius: 39,
  },
  disparadorCentro: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#94F990",
  },
  disparadorDesativado: { opacity: 0.45 },
  cabecalho: {
    height: 62,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEE9",
    backgroundColor: "#FAFAF5",
  },
  botaoIcone: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  tituloCabecalho: {
    flex: 1,
    color: "#1A1C19",
    fontSize: 20,
    fontWeight: "800",
    marginLeft: 6,
  },
  logoFolha: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#ACF4A4",
  },
  conteudo: { padding: 16, paddingBottom: 30 },
  avisoOffline: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: "#ACF4A4",
  },
  textosAviso: { flex: 1 },
  tituloAviso: {
    color: "#00450D",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  textoAviso: {
    color: "#0C5216",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  statusOnline: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#00450D",
  },
  talhao: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E3E3DE",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
  },
  iconeTalhao: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#EAF8E6",
  },
  textosTalhao: { flex: 1 },
  rotuloTalhao: { color: "#717A6D", fontSize: 11, fontWeight: "700" },
  nomeTalhao: {
    color: "#1A1C19",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 2,
  },
  visor: {
    height: 440,
    overflow: "hidden",
    justifyContent: "center",
    borderRadius: 28,
    backgroundColor: "#2F312E",
  },
  camera: { ...StyleSheet.absoluteFillObject },
  permissaoCamera: { alignItems: "center", paddingHorizontal: 34 },
  iconePermissao: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 32,
    backgroundColor: "#ACF4A4",
    marginBottom: 14,
  },
  tituloPermissao: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  textoPermissao: {
    color: "#DADAD5",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 7,
  },
  botaoPermissao: {
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: "#94F990",
    marginTop: 18,
  },
  textoBotaoPermissao: { color: "#002204", fontSize: 14, fontWeight: "800" },
  controlesSuperiores: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  controleVisor: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 13,
    borderRadius: 22,
    backgroundColor: "rgba(47,49,46,0.82)",
  },
  controleAtivo: { backgroundColor: "#94F990" },
  controleDesativado: { opacity: 0.5 },
  textoControle: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  textoControleAtivo: { color: "#002204" },
  distancia: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    borderRadius: 22,
    backgroundColor: "rgba(250,250,245,0.94)",
  },
  textoDistancia: { color: "#00450D", fontSize: 12, fontWeight: "800" },
  alvo: {
    width: 238,
    height: 238,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  canto: {
    position: "absolute",
    width: 38,
    height: 38,
    borderColor: "#94F990",
  },
  cantoSuperiorEsquerdo: {
    top: 0,
    left: 0,
    borderTopWidth: 5,
    borderLeftWidth: 5,
    borderTopLeftRadius: 18,
  },
  cantoSuperiorDireito: {
    top: 0,
    right: 0,
    borderTopWidth: 5,
    borderRightWidth: 5,
    borderTopRightRadius: 18,
  },
  cantoInferiorEsquerdo: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 5,
    borderLeftWidth: 5,
    borderBottomLeftRadius: 18,
  },
  cantoInferiorDireito: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 5,
    borderRightWidth: 5,
    borderBottomRightRadius: 18,
  },
  focoCentral: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    backgroundColor: "rgba(148,249,144,0.72)",
  },
  estadoFoco: {
    position: "absolute",
    bottom: 18,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: "rgba(0,70,14,0.92)",
  },
  pontoFoco: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#94F990",
  },
  textoEstadoFoco: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.35,
  },
  dicas: {
    padding: 14,
    borderWidth: 1,
    borderColor: "#EEEEE9",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    marginTop: 12,
  },
  topoDicas: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  topoDicasAberto: {
    marginBottom: 12,
  },
  tituloDicas: {
    flex: 1,
    color: "#41493E",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.55,
  },
  precisao: { flexDirection: "row", alignItems: "center", gap: 4 },
  textoPrecisao: { color: "#00450D", fontSize: 11, fontWeight: "800" },
  listaDicas: { flexDirection: "row", gap: 8 },
  dica: {
    flex: 1,
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
    backgroundColor: "#F4F4EF",
  },
  textoDica: { color: "#1A1C19", fontSize: 11, fontWeight: "800" },
  botaoPrincipal: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 13,
    borderRadius: 18,
    backgroundColor: "#00450D",
    marginTop: 12,
  },
  botaoPrincipalDesativado: { opacity: 0.45 },
  iconeBotaoPrincipal: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
    backgroundColor: "#94F990",
  },
  textosBotaoPrincipal: { flex: 1 },
  tituloBotaoPrincipal: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  subtituloBotaoPrincipal: { color: "#90D689", fontSize: 12, marginTop: 2 },
  acoesSecundarias: { flexDirection: "row", gap: 10, marginTop: 10 },
  botaoSecundario: {
    flex: 1,
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    backgroundColor: "#EEEEE9",
  },
  textoBotaoSecundario: { color: "#1A1C19", fontSize: 13, fontWeight: "800" },
});

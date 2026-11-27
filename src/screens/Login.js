import { useRef, useState } from "react";
import {ActivityIndicator,Alert,ImageBackground,KeyboardAvoidingView,Modal,Platform,ScrollView,StatusBar,StyleSheet,Text,TextInput,TouchableOpacity,View,} from "react-native";
import Constants from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { sendPasswordResetEmail } from "firebase/auth";
import { SafeAreaView } from "react-native-safe-area-context";
import { entrarComMatricula, MENSAGEM_CONTA_DESATIVADA, MENSAGEM_LOGIN_INVALIDO } from "../services/autenticacao";
import { autenticacao } from "../services/firebase";
import { useSessao } from "../context/Sessao";

export default function Login() {
  const { mensagem } = useSessao();
  const [matricula, setMatricula] = useState("");
  const [emailRecuperacao, setEmailRecuperacao] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [lembrarAcesso, setLembrarAcesso] = useState(true);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [mostrarRecuperacao, setMostrarRecuperacao] = useState(false);
  const senhaRef = useRef(null);
  const versao = Constants.expoConfig?.version;

  const mostrarAjuda = () => {
    Alert.alert(
      "Como acessar",
      "Sua conta é criada por um administrador da lavoura. Se ainda não tem acesso, peça o cadastro a ele. Se esqueceu a senha, toque em “Esqueceu a senha?”.",
    );
  };

  const entrar = async () => {
    if (carregando) {
      return;
    }

    setErro("");
    setCarregando(true);

    try {
      await entrarComMatricula(matricula, senha);
    } catch (error) {
      setErro(
        error?.message === MENSAGEM_CONTA_DESATIVADA
          ? MENSAGEM_CONTA_DESATIVADA
          : MENSAGEM_LOGIN_INVALIDO,
      );
    } finally {
      setCarregando(false);
    }
  };

  const recuperarSenha = async () => {
    const emailNormalizado = emailRecuperacao.trim().toLowerCase();

    if (!emailNormalizado || !emailNormalizado.includes("@")) {
      Alert.alert("Informe seu e-mail", "Digite o e-mail real associado à sua conta.");
      return;
    }

    setCarregando(true);

    try {
      await sendPasswordResetEmail(autenticacao, emailNormalizado);
      setMostrarRecuperacao(false);
      setEmailRecuperacao("");
      Alert.alert("E-mail enviado", "Enviamos as instruções para criar uma nova senha.");
    } catch {
      Alert.alert("Não foi possível enviar", "Confira o e-mail informado e tente novamente.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ImageBackground
          source={require("../../assets/campo.jpg")}
          style={styles.banner}
          imageStyle={styles.bannerImagem}
        >
          <LinearGradient
            colors={["transparent", "rgba(0, 69, 13, 0.62)", "#00450D"]}
            locations={[0, 0.5, 1]}
            style={styles.gradienteBanner}
          />

          <View style={styles.topoBanner}>
            <View style={styles.marca}>
              <View style={styles.iconeMarca}>
                <Ionicons name="leaf" size={23} color="#00450D" />
              </View>
              <View style={styles.textosMarca}>
                <Text style={styles.nomeMarca}>SafraCerta</Text>
                <Text style={styles.descricaoMarca}>DIAGNÓSTICO DE CAMPO</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.botaoAjuda}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Ajuda para acessar o aplicativo"
              onPress={mostrarAjuda}
            >
              <Ionicons name="help-outline" size={21} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.textoBanner}>
            <Text style={styles.tituloBanner}>Lavoura de Fumo & Grãos</Text>
            <Text style={styles.subtituloBanner}>Bem-vindo, produtor rural. Acesse seus talhões.</Text>
          </View>
        </ImageBackground>

        <View style={styles.conteudo}>
          <View style={styles.cardLogin}>
            <View style={styles.linhaLabelSenha}>
              <Text style={styles.label}>Matrícula</Text>
            </View>
            <View style={styles.campoWrap}>
              <Ionicons name="id-card-outline" size={20} color="#41493E" />
              <TextInput
                style={styles.campo}
                value={matricula}
                onChangeText={setMatricula}
                accessibilityLabel="Matrícula"
                placeholder="Digite sua matrícula"
                placeholderTextColor="#656D61"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => senhaRef.current?.focus()}
              />
            </View>

            <View style={styles.linhaLabelSenhaComLink}>
              <Text style={styles.label}>Senha de acesso</Text>
              <TouchableOpacity
                style={styles.areaLinkSenha}
                onPress={() => setMostrarRecuperacao(true)}
                accessibilityRole="button"
              >
                <Text style={styles.linkSenha}>Esqueceu a senha?</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.campoWrap}>
              <Ionicons name="lock-closed" size={19} color="#41493E" />
              <TextInput
                ref={senhaRef}
                style={[styles.campo, styles.campoSenha]}
                value={senha}
                onChangeText={setSenha}
                accessibilityLabel="Senha de acesso"
                placeholder="••••••"
                placeholderTextColor="#656D61"
                secureTextEntry={!mostrarSenha}
                autoCapitalize="none"
                autoComplete="current-password"
                returnKeyType="go"
                onSubmitEditing={entrar}
              />
              <TouchableOpacity
                style={styles.botaoOlho}
                onPress={() => setMostrarSenha(!mostrarSenha)}
                accessibilityRole="button"
                accessibilityLabel={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
              >
                <Ionicons
                  name={mostrarSenha ? "eye-off-outline" : "eye-outline"}
                  size={21}
                  color="#41493E"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.lembrarRow}
              onPress={() => setLembrarAcesso(!lembrarAcesso)}
              activeOpacity={0.8}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: lembrarAcesso }}
            >
              <View style={[styles.checkbox, lembrarAcesso && styles.checkboxAtivo]}>
                {lembrarAcesso && <Ionicons name="checkmark" size={15} color="#FFFFFF" />}
              </View>
              <Text style={styles.lembrarTexto}>Lembrar neste aparelho (Modo Campo Offline)</Text>
            </TouchableOpacity>

            {erro || mensagem ? (
              <View style={styles.erroBox} accessibilityRole="alert" accessibilityLiveRegion="polite">
                <Ionicons name="alert-circle" size={18} color="#BA1A1A" />
                <Text style={styles.erroTexto}>{erro || mensagem}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.botaoEntrar, carregando && styles.botaoDesativado]}
              onPress={entrar}
              disabled={carregando}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ disabled: carregando, busy: carregando }}
            >
              {carregando ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.textoBotao}>Conectando talhões...</Text>
                </>
              ) : (
                <>
                  <Text style={styles.textoBotao}>Acessar Minha Lavoura</Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>

          </View>
        </View>

        <View style={styles.rodape}>
          <View style={styles.versao}>
            <Ionicons name="shield-checkmark" size={16} color="#1B5E20" />
            <Text style={styles.textoVersao}>{versao ? `SafraCerta v${versao}` : "SafraCerta"}</Text>
          </View>
          <Text style={styles.textoRodape}>
            Desenvolvido por alunos da Eng. de Computação da UniSATC.
          </Text>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      <Modal transparent visible={mostrarRecuperacao} animationType="fade" onRequestClose={() => setMostrarRecuperacao(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fundoModal}>
          <View style={styles.modal}>
            <View style={styles.topoModal}>
              <View style={styles.tituloModal}>
                <Ionicons name="key-outline" size={24} color="#1B5E20" />
                <Text style={styles.textoTituloModal}>Recuperar acesso</Text>
              </View>
              <TouchableOpacity
                style={styles.fecharModal}
                onPress={() => setMostrarRecuperacao(false)}
                accessibilityRole="button"
                accessibilityLabel="Fechar recuperação de acesso"
              >
                <Ionicons name="close" size={19} color="#41493E" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalTexto}>
              Enviaremos um link seguro para criar uma nova senha no e-mail real associado à sua conta.
            </Text>
            <View style={styles.opcoesRecuperacao}>
              <Text style={styles.opcoesTitulo}>E-mail para recuperação</Text>
              <TextInput
                style={styles.campoRecuperacao}
                value={emailRecuperacao}
                onChangeText={setEmailRecuperacao}
                accessibilityLabel="E-mail para recuperação"
                placeholder="seuemail@exemplo.com"
                placeholderTextColor="#656D61"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
              />
            </View>
            <TouchableOpacity
              style={styles.botaoTemporario}
              onPress={recuperarSenha}
              disabled={carregando}
              accessibilityRole="button"
            >
              <Text style={styles.textoBotaoTemporario}>Enviar e-mail de recuperação</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.botaoFechar} onPress={() => setMostrarRecuperacao(false)} accessibilityRole="button">
              <Text style={styles.textoBotaoFechar}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAF5",
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    backgroundColor: "#FAFAF5",
  },
  banner: {
    minHeight: 280,
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  bannerImagem: {
    resizeMode: "cover",
  },
  gradienteBanner: {
    ...StyleSheet.absoluteFillObject,
  },
  topoBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    transform: [{ translateY: -42 }],
  },
  marca: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    flexShrink: 1,
  },
  textosMarca: {
    flexShrink: 1,
  },
  iconeMarca: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 12,
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  nomeMarca: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  descricaoMarca: {
    color: "#ACF4A4",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: -2,
  },
  botaoAjuda: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  textoBanner: {
    gap: 2,
  },
  tituloBanner: {
    color: "#FFFFFF",
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  subtituloBanner: {
    color: "#E3E3DE",
    fontSize: 14,
    fontWeight: "600",
  },
  conteudo: {
    paddingHorizontal: 16,
    marginTop: -12,
    gap: 16,
  },
  cardLogin: {
    minHeight: 400,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#C0C9BB",
    padding: 26,
    shadowColor: "#000000",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  label: {
    color: "#1A1C19",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 9,
  },
  campoWrap: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F4F4EF",
    borderWidth: 2,
    borderColor: "#C0C9BB",
    borderRadius: 18,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  // o input ocupa os 64px do campo (antes só a linha do texto recebia o toque)
  campo: {
    flex: 1,
    alignSelf: "stretch",
    color: "#1A1C19",
    fontSize: 17,
    fontWeight: "700",
    paddingVertical: 0,
    textAlignVertical: "center",
  },
  campoSenha: {
    letterSpacing: 3,
  },
  linhaLabelSenha: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  // link com 48px de altura; a margem negativa deixa o rótulo onde ele estava
  linhaLabelSenhaComLink: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    flexWrap: "wrap",
    columnGap: 12,
    minHeight: 48,
    marginTop: -22,
  },
  areaLinkSenha: {
    minHeight: 48,
    minWidth: 48,
    marginLeft: "auto",
    justifyContent: "flex-end",
    alignItems: "flex-end",
  },
  linkSenha: {
    color: "#00450D",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 9,
  },
  botaoOlho: {
    minWidth: 48,
    minHeight: 48,
    marginRight: -14,
    alignItems: "center",
    justifyContent: "center",
  },
  lembrarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 3,
    marginTop: -12,
    marginBottom: 8,
  },
  checkbox: {
    width: 23,
    height: 23,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#C0C9BB",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxAtivo: {
    backgroundColor: "#1B5E20",
    borderColor: "#1B5E20",
  },
  lembrarTexto: {
    flex: 1,
    color: "#1A1C19",
    fontSize: 14,
    fontWeight: "600",
  },
  erroBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFDAD6",
    borderWidth: 1,
    borderColor: "#BA1A1A",
    borderRadius: 12,
    padding: 11,
    marginBottom: 12,
  },
  erroTexto: {
    flex: 1,
    color: "#BA1A1A",
    fontSize: 14,
    fontWeight: "600",
  },
  botaoEntrar: {
    minHeight: 64,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: "#1B5E20",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    shadowColor: "#1B5E20",
    shadowOpacity: 0.24,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  botaoDesativado: {
    opacity: 0.75,
  },
  textoBotao: {
    flexShrink: 1,
    textAlign: "center",
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  rodape: {
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(192, 201, 187, 0.5)",
    marginTop: "auto",
    paddingTop: 20,
    paddingHorizontal: 32,
    paddingBottom: 28,
  },
  versao: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 6,
  },
  textoVersao: {
    color: "#1A1C19",
    fontSize: 13,
    fontWeight: "700",
  },
  textoRodape: {
    color: "#596155",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  fundoModal: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 16,
  },
  modal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#C0C9BB",
    padding: 20,
  },
  topoModal: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEE9",
    paddingBottom: 12,
  },
  tituloModal: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  textoTituloModal: {
    color: "#1A1C19",
    fontSize: 17,
    fontWeight: "800",
  },
  fecharModal: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F4EF",
  },
  modalTexto: {
    color: "#41493E",
    fontSize: 14,
    lineHeight: 20,
    marginVertical: 16,
  },
  opcoesRecuperacao: {
    gap: 4,
    backgroundColor: "#F4F4EF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  opcoesTitulo: {
    color: "#1A1C19",
    fontSize: 14,
    fontWeight: "800",
  },
  campoRecuperacao: {
    minHeight: 48,
    color: "#1A1C19",
    fontSize: 16,
    fontWeight: "600",
    paddingVertical: 0,
  },
  botaoTemporario: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#1B5E20",
    paddingVertical: 13,
  },
  textoBotaoTemporario: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  botaoFechar: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#F4F4EF",
    paddingVertical: 12,
    marginTop: 8,
  },
  textoBotaoFechar: {
    color: "#1A1C19",
    fontSize: 15,
    fontWeight: "700",
  },
});

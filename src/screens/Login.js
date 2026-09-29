import { useState } from "react";
import {ActivityIndicator,Alert,ImageBackground,Modal,ScrollView,StatusBar,StyleSheet,Text,TextInput,TouchableOpacity,View,} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { SafeAreaView } from "react-native-safe-area-context";
import { autenticacao } from "../services/firebase";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [lembrarAcesso, setLembrarAcesso] = useState(true);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [mostrarRecuperacao, setMostrarRecuperacao] = useState(false);

  const entrar = async () => {
    const emailNormalizado = email.trim().toLowerCase();

    if (!emailNormalizado || !emailNormalizado.includes("@")) {
      setErro("Informe um e-mail válido.");
      return;
    }

    if (senha.length < 6) {
      setErro("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setErro("");
    setCarregando(true);

    try {
      await signInWithEmailAndPassword(autenticacao, emailNormalizado, senha);
      router.replace("/home");
    } catch (error) {
      if (error.code === "auth/invalid-credential") {
        setErro("E-mail ou senha incorretos.");
      } else if (error.code === "auth/too-many-requests") {
        setErro("Muitas tentativas. Aguarde um momento e tente novamente.");
      } else {
        setErro("Não foi possível entrar. Verifique sua conexão e tente novamente.");
      }
    } finally {
      setCarregando(false);
    }
  };

  const recuperarSenha = async () => {
    const emailNormalizado = email.trim().toLowerCase();

    if (!emailNormalizado || !emailNormalizado.includes("@")) {
      Alert.alert("Informe seu e-mail", "Digite seu e-mail no campo de acesso antes de recuperar a senha.");
      return;
    }

    setCarregando(true);

    try {
      await sendPasswordResetEmail(autenticacao, emailNormalizado);
      setMostrarRecuperacao(false);
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
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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
              <View>
                <Text style={styles.nomeMarca}>SafraCerta</Text>
                <Text style={styles.descricaoMarca}>DIAGNÓSTICO DE CAMPO</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.botaoAjuda} activeOpacity={0.8}>
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
              <Text style={styles.label}>E-mail</Text>
            </View>
            <View style={styles.campoWrap}>
              <Ionicons name="mail-outline" size={20} color="#41493E" />
              <TextInput
                style={styles.campo}
                value={email}
                onChangeText={setEmail}
                placeholder="seuemail@exemplo.com"
                placeholderTextColor="#798076"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.linhaLabelSenha}>
              <Text style={styles.label}>Senha de acesso</Text>
              <TouchableOpacity onPress={() => setMostrarRecuperacao(true)}>
                <Text style={styles.linkSenha}>Esqueceu a senha?</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.campoWrap}>
              <Ionicons name="lock-closed" size={19} color="#41493E" />
              <TextInput
                style={[styles.campo, styles.campoSenha]}
                value={senha}
                onChangeText={setSenha}
                placeholder="••••••"
                placeholderTextColor="#798076"
                secureTextEntry={!mostrarSenha}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setMostrarSenha(!mostrarSenha)} hitSlop={10}>
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
            >
              <View style={[styles.checkbox, lembrarAcesso && styles.checkboxAtivo]}>
                {lembrarAcesso && <Ionicons name="checkmark" size={15} color="#FFFFFF" />}
              </View>
              <Text style={styles.lembrarTexto}>Lembrar neste aparelho (Modo Campo Offline)</Text>
            </TouchableOpacity>

            {erro ? (
              <View style={styles.erroBox}>
                <Ionicons name="alert-circle" size={18} color="#BA1A1A" />
                <Text style={styles.erroTexto}>{erro}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.botaoEntrar, carregando && styles.botaoDesativado]}
              onPress={entrar}
              disabled={carregando}
              activeOpacity={0.85}
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
            <Text style={styles.textoVersao}>SafraCerta v0.0.1</Text>
          </View>
          <Text style={styles.textoRodape}>
            Desenvolvido para pequenos produtores e lavouras de Santa Catarina.
          </Text>
        </View>
      </ScrollView>

      <Modal transparent visible={mostrarRecuperacao} animationType="fade">
        <View style={styles.fundoModal}>
          <View style={styles.modal}>
            <View style={styles.topoModal}>
              <View style={styles.tituloModal}>
                <Ionicons name="key-outline" size={24} color="#1B5E20" />
                <Text style={styles.textoTituloModal}>Recuperar acesso</Text>
              </View>
              <TouchableOpacity style={styles.fecharModal} onPress={() => setMostrarRecuperacao(false)}>
                <Ionicons name="close" size={19} color="#41493E" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalTexto}>
              Enviaremos um link seguro para criar uma nova senha no e-mail informado na tela de acesso.
            </Text>
            <View style={styles.opcoesRecuperacao}>
              <Text style={styles.opcoesTitulo}>E-mail para recuperação</Text>
              <Text style={styles.opcaoTexto}>{email.trim() || "Informe seu e-mail na tela de acesso."}</Text>
            </View>
            <TouchableOpacity
              style={styles.botaoTemporario}
              onPress={recuperarSenha}
              disabled={carregando}
            >
              <Text style={styles.textoBotaoTemporario}>Enviar e-mail de recuperação</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.botaoFechar} onPress={() => setMostrarRecuperacao(false)}>
              <Text style={styles.textoBotaoFechar}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAF5",
  },
  scroll: {
    flexGrow: 1,
    backgroundColor: "#FAFAF5",
  },
  banner: {
    height: 280,
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
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: -2,
  },
  botaoAjuda: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  obrigatorio: {
    color: "#717A6D",
    fontSize: 12,
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
  campo: {
    flex: 1,
    color: "#1A1C19",
    fontSize: 17,
    fontWeight: "700",
    paddingVertical: 0,
  },
  campoSenha: {
    letterSpacing: 3,
  },
  linhaLabelSenha: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  linkSenha: {
    color: "#00450D",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 9,
  },
  lembrarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 3,
    marginBottom: 20,
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
    fontSize: 13,
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
    fontSize: 12,
    fontWeight: "600",
  },
  botaoEntrar: {
    height: 64,
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
    fontSize: 12,
    fontWeight: "700",
  },
  textoRodape: {
    color: "#717A6D",
    fontSize: 11,
    lineHeight: 15,
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
    width: 32,
    height: 32,
    borderRadius: 16,
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
    fontSize: 12,
    fontWeight: "800",
  },
  opcaoTexto: {
    color: "#41493E",
    fontSize: 12,
  },
  botaoTemporario: {
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#1B5E20",
    paddingVertical: 13,
  },
  textoBotaoTemporario: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  botaoFechar: {
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#F4F4EF",
    paddingVertical: 12,
    marginTop: 8,
  },
  textoBotaoFechar: {
    color: "#1A1C19",
    fontSize: 12,
    fontWeight: "700",
  },
});

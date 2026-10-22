import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { analisarFoto, ApiError, ApiTimeoutError } from "../services/analiseFolha";
import { obterNomeClassificacao } from "../utils/nomesClassificacoes";
import { useSessao } from "../context/Sessao";
import { listarTalhoes } from "../services/talhoes";
import { acompanharAnalise, analisePendente, buscarAnalise, dataAnalise, novaAnaliseId, operacaoAnalise, SITUACOES_ANALISE } from "../services/historicoAnalises";
import ImagemAnaliseFolha from "../components/ImagemAnaliseFolha";

const TIPOS_IMAGEM = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const obterExtensao = (uri = "") => {
  const caminho = uri.split(/[?#]/)[0];
  return caminho.split(".").pop()?.toLowerCase();
};

const criarFotoDaGaleria = (asset) => {
  const extensao = obterExtensao(asset.uri);
  const tipo = asset.mimeType ?? TIPOS_IMAGEM[extensao] ?? "image/jpeg";
  const extensaoFinal = tipo.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";

  return {
    uri: asset.uri,
    nome: asset.fileName ?? `folha.${extensaoFinal}`,
    tipo,
  };
};

const obterPorcentagem = (pontuacao) => {
  const valor = Number(pontuacao);
  if (!Number.isFinite(valor)) return null;
  return Math.round(Math.min(Math.max(valor, 0), 1) * 100);
};

const formatarPontuacao = (pontuacao) => {
  const porcentagem = obterPorcentagem(pontuacao);
  return porcentagem === null ? "—" : `${porcentagem}%`;
};

export default function TesteFolha({ talhaoInicialId, analiseAnteriorId }) {
  const { admin, acessoTalhoes } = useSessao();
  const camera = useRef(null);
  const [permissaoCamera, pedirPermissaoCamera] = useCameraPermissions();
  const [foto, setFoto] = useState(null);
  const [cameraAberta, setCameraAberta] = useState(false);
  const [cameraPronta, setCameraPronta] = useState(false);
  const [tirandoFoto, setTirandoFoto] = useState(false);
  const [dicasAbertas, setDicasAbertas] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erroAnalise, setErroAnalise] = useState(null);
  const [analisando, setAnalisando] = useState(false);
  const [talhoes, setTalhoes] = useState([]);
  const [talhaoSelecionado, setTalhaoSelecionado] = useState(null);
  const [talhaoResultado, setTalhaoResultado] = useState(null);
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [buscaTalhao, setBuscaTalhao] = useState("");
  const [carregandoTalhoes, setCarregandoTalhoes] = useState(true);
  const [erroTalhoes, setErroTalhoes] = useState("");
  const consultaTalhoes = useRef(0);
  const talhaoRef = useRef(null);
  const [mostrarMarcacoes, setMostrarMarcacoes] = useState(true);
  const [fotoAmpliada, setFotoAmpliada] = useState(false);
  const solicitacaoAtual = useRef(0);
  const controllerAtual = useRef(null);
  const operacaoAtual = useRef(null);
  const cancelarHistorico = useRef(() => {});
  const [registroAnalise, setRegistroAnalise] = useState(null);
  const [etapaAnalise, setEtapaAnalise] = useState("");

  useEffect(() => {
    return () => {
      solicitacaoAtual.current += 1;
      controllerAtual.current?.abort();
      cancelarHistorico.current();
    };
  }, []);

  const carregarTalhoes = useCallback(async () => {
    const atual = ++consultaTalhoes.current;
    setCarregandoTalhoes(true);
    setErroTalhoes("");
    try {
      const resposta = await listarTalhoes(true);
      if (atual === consultaTalhoes.current) {
        setTalhoes(resposta);
        if (!talhaoRef.current && talhaoInicialId && !operacaoAtual.current) {
          const inicial = resposta.find((item) => item.id === talhaoInicialId);
          if (inicial) { talhaoRef.current = inicial; setTalhaoSelecionado(inicial); }
        }
        if (talhaoRef.current && !controllerAtual.current) {
          const selecionado = resposta.find((item) => item.id === talhaoRef.current.id);
          talhaoRef.current = selecionado || null;
          setTalhaoSelecionado(selecionado || null);
          if (!selecionado) {
            setResultado(null);
            setTalhaoResultado(null);
            setErroAnalise("O talhão selecionado não está mais ativo. Selecione outro talhão; a foto foi mantida.");
          }
        }
      }
    } catch (erro) {
      if (atual === consultaTalhoes.current) { setTalhoes([]); setErroTalhoes(erro.message); }
    } finally {
      if (atual === consultaTalhoes.current) setCarregandoTalhoes(false);
    }
  }, [talhaoInicialId]);

  useFocusEffect(useCallback(() => {
    if (acessoTalhoes) carregarTalhoes();
    return () => { consultaTalhoes.current += 1; };
  }, [acessoTalhoes, carregarTalhoes]));

  const abrirSeletor = () => {
    if (controllerAtual.current) return;
    setBuscaTalhao("");
    setSeletorAberto(true);
    carregarTalhoes();
  };

  const escolherTalhao = (talhao) => {
    if (controllerAtual.current) return;
    if (talhao.id !== talhaoSelecionado?.id) {
      cancelarHistorico.current();
      operacaoAtual.current = null;
      setRegistroAnalise(null);
      setResultado(null);
      setTalhaoResultado(null);
      setErroAnalise(null);
    }
    setTalhaoSelecionado(talhao);
    talhaoRef.current = talhao;
    setSeletorAberto(false);
  };

  const atualizarFoto = (novaFoto) => {
    cancelarHistorico.current();
    operacaoAtual.current = null;
    setRegistroAnalise(null);
    solicitacaoAtual.current += 1;
    controllerAtual.current?.abort();
    controllerAtual.current = null;
    setAnalisando(false);
    setResultado(null);
    setTalhaoResultado(null);
    setMostrarMarcacoes(true);
    setFotoAmpliada(false);
    setErroAnalise(null);
    setFoto(novaFoto);
  };

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

      atualizarFoto({
        uri: resultado.uri,
        nome: `folha-${Date.now()}.jpg`,
        tipo: "image/jpeg",
        origem: "CAMERA",
      });
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
        atualizarFoto({ ...criarFotoDaGaleria(resultado.assets[0]), origem: "GALERIA" });
      }
    } catch {
      Alert.alert(
        "Arquivo indisponível",
        "Não foi possível abrir a galeria. Tente novamente.",
      );
    }
  };

  const iniciarAnalise = async () => {
    if (!foto || controllerAtual.current) return;
    if (!talhaoSelecionado) {
      setErroAnalise("Selecione um talhão ativo antes de analisar a foto.");
      abrirSeletor();
      return;
    }

    const idSolicitacao = solicitacaoAtual.current + 1;
    solicitacaoAtual.current = idSolicitacao;
    const controller = new AbortController();
    controllerAtual.current = controller;
    setAnalisando(true);
    setErroAnalise(null);
    setResultado(null);
    setTalhaoResultado(null);
    setEtapaAnalise("Registrando análise…");
    if (!operacaoAtual.current) operacaoAtual.current = { analiseId: novaAnaliseId(), talhaoId: talhaoSelecionado.id, origemFoto: foto.origem, analiseAnteriorId: analiseAnteriorId || null };
    const pedido = operacaoAtual.current;
    const receberRegistro = (registro) => {
      if (solicitacaoAtual.current !== idSolicitacao) return;
      setRegistroAnalise(registro);
      setTalhaoResultado({ ...registro.talhaoSnapshot, id: registro.talhaoId });
      if (registro.status === "EM_PROCESSAMENTO") setEtapaAnalise("Analisando foto…");
      if (!analisePendente(registro.status)) {
        setAnalisando(false);
        controllerAtual.current = null;
        operacaoAtual.current = null;
        if (registro.status === "CONCLUIDA") { setResultado(registro.resultado); setErroAnalise(null); }
        else setErroAnalise(registro.erro?.mensagem || "Esta tentativa não foi concluída. Inicie outra análise.");
      }
    };

    try {
      await operacaoAnalise("iniciarAnalise", pedido);
      if (solicitacaoAtual.current !== idSolicitacao) return;
      const registro = await buscarAnalise(pedido.analiseId);
      if (solicitacaoAtual.current !== idSolicitacao) return;
      receberRegistro(registro);
      cancelarHistorico.current();
      cancelarHistorico.current = acompanharAnalise(pedido.analiseId, receberRegistro, (erro) => {
        if (solicitacaoAtual.current === idSolicitacao) setErroAnalise(`${erro.message} Consulte o histórico antes de repetir.`);
      });
      if (registro.status !== "AGUARDANDO_ENVIO") return;
      setEtapaAnalise("Enviando foto…");
      await analisarFoto(foto, pedido.analiseId, controller.signal);
      if (solicitacaoAtual.current !== idSolicitacao) return;
      receberRegistro(await buscarAnalise(pedido.analiseId));
    } catch (erro) {
      if (solicitacaoAtual.current !== idSolicitacao || erro?.name === "AbortError") {
        return;
      }

      try {
        const codigo = erro instanceof ApiError ? "API_RECUSOU" : "CONEXAO";
        if (erro instanceof ApiError || erro instanceof ApiTimeoutError || !erro.code) {
          await operacaoAnalise("registrarFalhaEnvioAnalise", { analiseId: pedido.analiseId, codigo });
        }
        const registro = await buscarAnalise(pedido.analiseId);
        receberRegistro(registro);
        if (registro.status === "CONCLUIDA" || !analisePendente(registro.status)) return;
      } catch {
        if (solicitacaoAtual.current === idSolicitacao) setErroAnalise("Não foi possível confirmar o histórico. Confira a conexão antes de repetir.");
      }
      if (solicitacaoAtual.current !== idSolicitacao) return;

      if (erro?.code === "functions/failed-precondition") {
        setTalhaoSelecionado(null);
        talhaoRef.current = null;
        setErroAnalise(erro.message);
      } else if (erro?.code) {
        setErroAnalise(erro.message);
      } else if (erro instanceof ApiTimeoutError) {
        setErroAnalise("A espera passou de 60 segundos. Consulte o histórico antes de iniciar outra tentativa.");
      } else if (erro instanceof ApiError) {
        setErroAnalise(erro.message);
      } else {
        setErroAnalise(
          "Não foi possível conectar à API. Confira o endereço, a rede e se o servidor está ligado.",
        );
      }
    } finally {
      if (solicitacaoAtual.current === idSolicitacao) {
        controllerAtual.current = null;
        setAnalisando(false);
      }
    }
  };

  const analisarOutraFoto = () => atualizarFoto(null);
  const pesquisaTalhao = buscaTalhao.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const talhoesFiltrados = talhoes.filter((item) => [item.codigo, item.nome, item.propriedadeNome].some((valor) =>
    String(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(pesquisaTalhao)));
  const folhaLocalizada = resultado?.deteccao_folha?.estado === "concluido";
  const estadoLesoes = resultado?.deteccao_lesoes?.estado ?? "nao_disponivel";
  const regioes = estadoLesoes === "concluido" ? resultado.deteccao_lesoes.itens : [];

  const outrasPossibilidades = resultado
    ? (Array.isArray(resultado.top3) ? resultado.top3 : []).filter(
        (item) =>
          item.classe_id !== resultado.classe_id &&
          item.classe !== resultado.classe &&
          (obterPorcentagem(item.pontuacao) ?? 0) > 0,
      )
    : [];

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar style="dark" />

      <Modal visible={seletorAberto} animationType="slide" onRequestClose={() => setSeletorAberto(false)}>
        <SafeAreaView style={styles.container}>
          <View style={styles.cabecalho}>
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar seleção de talhão" onPress={() => setSeletorAberto(false)} style={styles.botaoSeletor}><Ionicons name="arrow-back" size={25} color="#1A1C19" /></Pressable>
            <Text accessibilityRole="header" style={styles.tituloCabecalho}>Selecionar talhão</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Atualizar talhões ativos" disabled={carregandoTalhoes} onPress={carregarTalhoes} style={styles.botaoSeletor}><Ionicons name="refresh" size={23} color="#00450D" /></Pressable>
          </View>
          <View style={styles.buscaTalhao}><Ionicons name="search-outline" size={21} color="#596155" /><TextInput accessibilityLabel="Buscar talhão por código, nome ou propriedade" value={buscaTalhao} onChangeText={setBuscaTalhao} placeholder="Código, nome ou propriedade" placeholderTextColor="#596155" autoCorrect={false} style={styles.inputTalhao} /></View>
          <FlatList data={carregandoTalhoes || erroTalhoes ? [] : talhoesFiltrados} keyExtractor={(item) => item.id} contentContainerStyle={styles.listaTalhoes} keyboardShouldPersistTaps="handled" refreshing={carregandoTalhoes} onRefresh={carregarTalhoes}
            renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`${item.codigo}, ${item.nome}, ${item.propriedadeNome}`} accessibilityState={{ selected: item.id === talhaoSelecionado?.id }} onPress={() => escolherTalhao(item)} style={[styles.opcaoTalhao, item.id === talhaoSelecionado?.id && styles.opcaoTalhaoAtiva]}><View style={styles.textosTalhao}><Text style={styles.nomeOpcaoTalhao}>{item.codigo} — {item.nome}</Text><Text style={styles.descricaoTalhao}>{item.propriedadeNome}</Text>{item.localidade ? <Text style={styles.descricaoTalhao}>{item.localidade}</Text> : null}</View><Ionicons name={item.id === talhaoSelecionado?.id ? "radio-button-on" : "radio-button-off"} size={23} color="#00450D" /></Pressable>}
            ListEmptyComponent={<View style={styles.estadoTalhoes}>{carregandoTalhoes ? <><ActivityIndicator color="#00450D" /><Text style={styles.descricaoTalhao}>Carregando talhões ativos...</Text></> : erroTalhoes ? <><Text accessibilityRole="alert" style={styles.erroTalhoes}>{erroTalhoes}</Text><Pressable accessibilityRole="button" onPress={carregarTalhoes} style={styles.botaoSeletorTexto}><Text style={styles.textoSeletor}>Tentar novamente</Text></Pressable></> : <><Ionicons name="map-outline" size={36} color="#596155" /><Text style={styles.nomeOpcaoTalhao}>{pesquisaTalhao ? "Nenhum talhão encontrado" : "Nenhum talhão ativo disponível"}</Text><Text style={styles.descricaoTalhao}>{pesquisaTalhao ? "Confira o código, nome ou propriedade." : admin ? "Cadastre um talhão ou ative um cadastro existente." : "Solicite o cadastro ou a ativação de um talhão ao administrador."}</Text>{admin && !pesquisaTalhao ? <Pressable accessibilityRole="button" onPress={() => { setSeletorAberto(false); router.push("/talhoes"); }} style={styles.botaoSeletorTexto}><Text style={styles.textoSeletor}>Abrir Talhões</Text></Pressable> : null}</>}</View>}
          />
        </SafeAreaView>
      </Modal>
      <Modal visible={fotoAmpliada} animationType="fade" onRequestClose={() => setFotoAmpliada(false)}>
        <SafeAreaView style={styles.fotoTelaCheia}>
          <View style={styles.topoFotoAmpliada}>
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar foto ampliada" onPress={() => setFotoAmpliada(false)} style={styles.fecharFotoAmpliada}>
              <Ionicons name="arrow-back" size={24} color="#1A1C19" />
            </Pressable>
            <Text style={styles.tituloFotoAmpliada}>Foto da folha</Text>
          </View>
          {foto && fotoAmpliada ? (
            <ImagemAnaliseFolha key={foto.uri} uri={foto.uri} resultado={resultado} mostrarMarcacoes={mostrarMarcacoes} style={styles.imagemAmpliada} />
          ) : null}
          {folhaLocalizada ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: mostrarMarcacoes }}
              onPress={() => setMostrarMarcacoes((atual) => !atual)}
              style={styles.controleFotoAmpliada}
            >
              <Ionicons name={mostrarMarcacoes ? "eye-off-outline" : "eye-outline"} size={21} color="#00450D" />
              <Text style={styles.textoControleFoto}>{mostrarMarcacoes ? "Ocultar marcações" : "Mostrar marcações"}</Text>
            </Pressable>
          ) : null}
        </SafeAreaView>
      </Modal>

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
            <Pressable
              accessibilityLabel="Fechar câmera"
              onPress={() => setCameraAberta(false)}
              style={styles.fecharCamera}
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </Pressable>
            <View pointerEvents="none" style={styles.guiaCamera}>
              <Ionicons name="leaf-outline" size={42} color="#94F990" />
              <Text style={styles.textoGuiaCamera}>Centralize a folha</Text>
            </View>
            <Pressable
              accessibilityLabel="Tirar foto"
              disabled={!cameraPronta || tirandoFoto}
              onPress={tirarFoto}
              style={[
                styles.disparador,
                (!cameraPronta || tirandoFoto) && styles.disparadorDesativado,
              ]}
            >
              <View style={styles.disparadorCentro} />
            </Pressable>
          </SafeAreaView>
        </View>
      </Modal>

      <View style={styles.cabecalho}>
        <Pressable
          accessibilityLabel="Voltar"
          style={styles.botaoIcone}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1C19" />
        </Pressable>
        <Text style={styles.tituloCabecalho}>Diagnosticar</Text>
        <View style={styles.logoFolha}>
          <Ionicons name="leaf" size={19} color="#00450D" />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.conteudo}
        showsVerticalScrollIndicator={false}
      >
        <Pressable accessibilityRole="button" accessibilityLabel={talhaoSelecionado ? `Trocar talhão, selecionado ${talhaoSelecionado.codigo}, ${talhaoSelecionado.nome}` : "Selecionar um talhão ativo"} accessibilityState={{ disabled: analisando }} disabled={analisando} onPress={abrirSeletor} style={styles.talhao}>
          <View style={styles.iconeTalhao}>
            <Ionicons name="map" size={20} color="#00450D" />
          </View>
          <View style={styles.textosTalhao}>
            <Text style={styles.rotuloTalhao}>{talhaoSelecionado ? "Talhão selecionado" : "Talhão da análise"}</Text>
            <Text style={styles.nomeTalhao}>{talhaoSelecionado ? `${talhaoSelecionado.codigo} — ${talhaoSelecionado.nome}` : "Selecione um talhão"}</Text>
            {talhaoSelecionado ? <Text style={styles.descricaoTalhao}>{talhaoSelecionado.propriedadeNome}</Text> : null}
          </View>
          <Ionicons name="chevron-down" size={20} color="#41493E" />
        </Pressable>
        {!talhaoSelecionado ? <Text style={styles.orientacaoTalhao}>{carregandoTalhoes ? "Consultando talhões ativos..." : erroTalhoes ? erroTalhoes : "Selecione um talhão ativo para analisar. Você já pode fotografar ou escolher a imagem."}</Text> : null}

        <View style={styles.visor}>
          {foto ? (
            <ImagemAnaliseFolha
              key={foto.uri}
              uri={foto.uri}
              resultado={resultado}
              mostrarMarcacoes={mostrarMarcacoes}
              style={styles.camera}
            />
          ) : (
            <View style={styles.camera} />
          )}

          {!foto ? (
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
          ) : null}

          {!resultado ? (
            <View style={styles.estadoFoco}>
              <View style={styles.pontoFoco} />
              <Text style={styles.textoEstadoFoco}>
                {analisando
                  ? etapaAnalise
                  : foto
                    ? "Imagem pronta para análise"
                    : "Posicione a folha no centro"}
              </Text>
            </View>
          ) : null}
        </View>

        {foto ? (
          <View style={styles.controlesFoto}>
            {folhaLocalizada ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: mostrarMarcacoes }}
                onPress={() => setMostrarMarcacoes((atual) => !atual)}
                style={styles.controleFoto}
              >
                <Ionicons name={mostrarMarcacoes ? "eye-off-outline" : "eye-outline"} size={20} color="#00450D" />
                <Text style={styles.textoControleFoto}>{mostrarMarcacoes ? "Ocultar marcações" : "Mostrar marcações"}</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" accessibilityLabel="Ampliar foto da folha" onPress={() => setFotoAmpliada(true)} style={styles.controleFoto}>
              <Ionicons name="expand-outline" size={20} color="#00450D" />
              <Text style={styles.textoControleFoto}>Ampliar foto</Text>
            </Pressable>
          </View>
        ) : null}

        {registroAnalise ? (
          <View accessibilityLiveRegion="polite" style={styles.registroHistorico}>
            <Text style={styles.tituloLocalizacao}>{registroAnalise.status === "CONCLUIDA" ? "Histórico salvo" : SITUACOES_ANALISE[registroAnalise.status]}</Text>
            <Text style={styles.textoHistorico}>{registroAnalise.talhaoSnapshot?.codigo} — {registroAnalise.talhaoSnapshot?.nome}</Text>
            <Text style={styles.textoHistorico}>{dataAnalise(registroAnalise.criadoEm)}</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/analise/[id]", params: { id: registroAnalise.id } })} style={styles.botaoHistorico}>
              <Ionicons name="time-outline" size={21} color="#1B5E20" />
              <Text style={styles.linkHistorico}>{analisePendente(registroAnalise.status) ? "Acompanhar no histórico" : "Ver no histórico"}</Text>
            </Pressable>
          </View>
        ) : null}

        {resultado ? (
          <View accessibilityLiveRegion="polite" style={styles.localizacao}>
            <View style={styles.linhaLocalizacao}>
              <Ionicons name={folhaLocalizada ? "scan-outline" : "information-circle-outline"} size={21} color="#00450D" />
              <Text style={styles.tituloLocalizacao}>{folhaLocalizada ? "Folha localizada" : "Localização não disponível"}</Text>
              {folhaLocalizada ? <Text style={styles.pontuacaoLocalizacao}>{formatarPontuacao(resultado.deteccao_folha.itens[0].pontuacao)}</Text> : null}
            </View>
            <Text style={styles.descricaoLocalizacao}>
              {!folhaLocalizada
                ? "A API retornou a classificação sem marcações na imagem."
                : estadoLesoes === "nao_disponivel"
                  ? "A moldura mostra a folha analisada. A localização das manchas ainda não está disponível."
                  : estadoLesoes === "erro"
                    ? "A classificação foi concluída, mas não foi possível localizar as regiões suspeitas."
                    : regioes.length
                      ? "As marcações numeradas mostram regiões suspeitas, separadas da classificação da folha."
                      : "Nenhuma região suspeita localizada. Isso não descarta alterações na folha."}
            </Text>
            {estadoLesoes === "erro" ? (
              <Pressable accessibilityRole="button" onPress={iniciarAnalise} style={[styles.controleFoto, styles.repetirAnalise]}>
                <Ionicons name="refresh-outline" size={20} color="#00450D" />
                <Text style={styles.textoControleFoto}>Tentar a análise novamente</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.dicas}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: dicasAbertas }}
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
          </Pressable>
          {dicasAbertas ? (
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
          ) : null}
        </View>

        {resultado ? (
          <>
            <View style={styles.resultadoPrincipal}>
              {talhaoResultado ? <View style={styles.contextoTalhao}><Text style={styles.nomeOpcaoTalhao}>{talhaoResultado.codigo} — {talhaoResultado.nome}</Text><Text style={styles.descricaoTalhao}>{talhaoResultado.propriedadeNome}</Text></View> : null}
              <View style={styles.cabecalhoResultado}>
                <View style={styles.iconeResultado}>
                  <Ionicons name="leaf" size={22} color="#00450D" />
                </View>
                <Text style={styles.rotuloResultado}>Classificação principal</Text>
              </View>
              <Text style={styles.nomeResultado}>
                {obterNomeClassificacao(
                  resultado.classe,
                  resultado.nome_exibicao,
                )}
              </Text>
              <View style={styles.pontuacaoResultado}>
                <Text style={styles.rotuloPontuacao}>Pontuação do modelo</Text>
                <Text style={styles.valorPontuacao}>
                  {formatarPontuacao(resultado.pontuacao)}
                </Text>
              </View>
            </View>

            {regioes.length > 0 ? (
              <View style={styles.possibilidades}>
                <Text style={styles.tituloLocalizacao}>Regiões suspeitas</Text>
                {regioes.map((regiao) => (
                  <View key={regiao.id} style={styles.linhaLocalizacao}>
                    <Text style={styles.numeroRegiao}>{regiao.id}</Text>
                    <Text style={styles.nomeRegiao}>Região marcada</Text>
                    <Text style={styles.pontuacaoLocalizacao}>{formatarPontuacao(regiao.pontuacao)}</Text>
                  </View>
                ))}
                {resultado.classe === "healthy" ? (
                  <Text style={styles.descricaoLocalizacao}>A classificação indicou folha saudável, mas houve regiões suspeitas marcadas. Os modelos apresentaram resultados diferentes.</Text>
                ) : null}
              </View>
            ) : null}

            <View style={styles.possibilidades}>
              <Text style={styles.tituloSecaoResultado}>Outras possibilidades</Text>
              {outrasPossibilidades.length > 0 ? (
                outrasPossibilidades.map((item) => (
                  <View
                    key={`${item.classe_id}-${item.classe}`}
                    style={styles.possibilidade}
                  >
                    <View style={styles.textosPossibilidade}>
                      <Text style={styles.nomePossibilidade}>
                        {obterNomeClassificacao(item.classe, item.nome_exibicao)}
                      </Text>
                      <Text style={styles.codigoPossibilidade}>
                        Classe {item.classe_id}
                      </Text>
                    </View>
                    <Text style={styles.valorPossibilidade}>
                      {formatarPontuacao(item.pontuacao)}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.semPossibilidades}>
                  Não possui outras possibilidades.
                </Text>
              )}
            </View>

            <View style={styles.limitesResultado}>
              <Text style={styles.textoLimitesResultado}>
                A classificação é uma hipótese. As pontuações e marcações do modelo
                não confirmam um diagnóstico nem indicam tratamento.
              </Text>
            </View>

            <Pressable style={styles.botaoPrincipal} onPress={analisarOutraFoto}>
              <View style={styles.iconeBotaoPrincipal}>
                <Ionicons name="refresh" size={24} color="#002204" />
              </View>
              <View style={styles.textosBotaoPrincipal}>
                <Text style={styles.tituloBotaoPrincipal}>Analisar outra foto</Text>
                <Text style={styles.subtituloBotaoPrincipal}>
                  Fotografar ou escolher outro arquivo
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={25} color="#FFFFFF" />
            </Pressable>
          </>
        ) : (
          <>
            {erroAnalise ? (
              <View style={styles.erroAnalise}>
                <Ionicons name="alert-circle" size={22} color="#9B2C2C" />
                <View style={styles.textosErroAnalise}>
                  <Text style={styles.tituloErroAnalise}>Análise não concluída</Text>
                  <Text style={styles.textoErroAnalise}>{erroAnalise}</Text>
                </View>
              </View>
            ) : null}

            {foto ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: analisando || !talhaoSelecionado, busy: analisando }}
                disabled={analisando || !talhaoSelecionado || analisePendente(registroAnalise?.status)}
                style={[
                  styles.botaoPrincipal,
                  (analisando || !talhaoSelecionado || analisePendente(registroAnalise?.status)) && styles.botaoPrincipalDesativado,
                ]}
                onPress={iniciarAnalise}
              >
                <View style={styles.iconeBotaoPrincipal}>
                  {analisando ? (
                    <ActivityIndicator color="#002204" />
                  ) : (
                    <Ionicons name="sparkles" size={24} color="#002204" />
                  )}
                </View>
                <View style={styles.textosBotaoPrincipal}>
                  <Text style={styles.tituloBotaoPrincipal}>
                    {analisando
                      ? etapaAnalise
                      : analisePendente(registroAnalise?.status)
                        ? "Acompanhe no histórico"
                      : !talhaoSelecionado
                        ? "Selecione um talhão"
                        : erroAnalise
                        ? "Tentar novamente"
                        : "Escanear folha agora"}
                  </Text>
                  <Text style={styles.subtituloBotaoPrincipal}>
                    {analisando
                      ? "Isso pode levar até 60 segundos"
                      : "Usar a imagem selecionada"}
                  </Text>
                </View>
                {analisando ? null : (
                  <Ionicons name="arrow-forward" size={25} color="#FFFFFF" />
                )}
              </Pressable>
            ) : (
              <Pressable
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
              </Pressable>
            )}

            <View style={styles.acoesSecundarias}>
              <Pressable
                style={styles.botaoSecundario}
                onPress={escolherArquivo}
              >
                <Ionicons name="images-outline" size={23} color="#41493E" />
                <Text style={styles.textoBotaoSecundario}>
                  {foto ? "Trocar imagem" : "Enviar arquivo"}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  registroHistorico: { backgroundColor: "#EDF4E9", borderLeftWidth: 3, borderLeftColor: "#1B5E20", padding: 16, gap: 6, marginVertical: 12 },
  textoHistorico: { color: "#596155", fontSize: 14, lineHeight: 21 },
  botaoHistorico: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8 },
  linkHistorico: { color: "#1B5E20", fontSize: 15, fontWeight: "700" },
  botaoSeletor: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 24, borderCurve: "continuous" },
  buscaTalhao: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, margin: 16, borderWidth: 1, borderColor: "#C3CDBF", backgroundColor: "#FFFFFF", borderRadius: 12, borderCurve: "continuous" },
  inputTalhao: { flex: 1, minHeight: 52, fontSize: 15, color: "#1A1C19" },
  listaTalhoes: { paddingHorizontal: 16, paddingBottom: 30, gap: 10 },
  opcaoTalhao: { minHeight: 80, flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderWidth: 1, borderColor: "#DDE5D8", backgroundColor: "#FFFFFF", borderRadius: 16, borderCurve: "continuous" },
  opcaoTalhaoAtiva: { borderColor: "#00450D", backgroundColor: "#E4F4DE" },
  nomeOpcaoTalhao: { color: "#1A1C19", fontSize: 16, fontWeight: "700", lineHeight: 22 },
  descricaoTalhao: { color: "#596155", fontSize: 13, lineHeight: 20 },
  estadoTalhoes: { alignItems: "center", gap: 12, paddingVertical: 32 },
  erroTalhoes: { color: "#A01818", fontSize: 14, lineHeight: 21 },
  botaoSeletorTexto: { minHeight: 48, padding: 12, justifyContent: "center", alignItems: "center" },
  textoSeletor: { color: "#00450D", fontSize: 15, fontWeight: "700" },
  orientacaoTalhao: { color: "#596155", fontSize: 13, lineHeight: 20, marginBottom: 12 },
  contextoTalhao: { gap: 4, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#CDE8C8" },
  fotoTelaCheia: { flex: 1, backgroundColor: "#FAFAF5" },
  fecharFotoAmpliada: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 24 },
  topoFotoAmpliada: { flexDirection: "row", alignItems: "center", padding: 12, gap: 8 },
  tituloFotoAmpliada: { color: "#1A1C19", fontSize: 18, fontWeight: "700", flex: 1 },
  imagemAmpliada: { flex: 1 },
  controlesFoto: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  controleFoto: { minHeight: 48, flexGrow: 1, flexBasis: 140, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 10, backgroundColor: "#EEEEE9", borderRadius: 12, borderCurve: "continuous" },
  controleFotoAmpliada: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 12 },
  repetirAnalise: { flexGrow: 0, flexBasis: "auto" },
  textoControleFoto: { color: "#00450D", fontSize: 14, fontWeight: "600", flexShrink: 1 },
  localizacao: { marginTop: 12, padding: 14, gap: 8, borderLeftWidth: 3, borderLeftColor: "#00450D", backgroundColor: "#F0FAED" },
  linhaLocalizacao: { flexDirection: "row", alignItems: "center", gap: 10 },
  tituloLocalizacao: { flex: 1, color: "#00450D", fontSize: 15, fontWeight: "700" },
  descricaoLocalizacao: { color: "#41493E", fontSize: 14, lineHeight: 21 },
  pontuacaoLocalizacao: { color: "#00450D", fontSize: 14, fontWeight: "700" },
  numeroRegiao: { minWidth: 28, textAlign: "center", padding: 4, color: "#FFFFFF", fontSize: 14, fontWeight: "700", backgroundColor: "#B95000", borderRadius: 6, borderCurve: "continuous" },
  nomeRegiao: { flex: 1, color: "#1A1C19", fontSize: 14 },
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
  camera: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
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
  resultadoPrincipal: {
    gap: 14,
    padding: 18,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#CDE8C8",
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: "#F0FAED",
  },
  cabecalhoResultado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconeResultado: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: "#ACF4A4",
  },
  rotuloResultado: {
    color: "#41643E",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.65,
  },
  nomeResultado: { color: "#153B19", fontSize: 25, fontWeight: "900" },
  pontuacaoResultado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#CDE8C8",
  },
  rotuloPontuacao: { flex: 1, color: "#41643E", fontSize: 13, fontWeight: "700" },
  valorPontuacao: { color: "#00450D", fontSize: 20, fontWeight: "900" },
  possibilidades: {
    gap: 10,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#E3E3DE",
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "#FFFFFF",
  },
  tituloSecaoResultado: {
    color: "#41493E",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.55,
  },
  possibilidade: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderCurve: "continuous",
    backgroundColor: "#F4F4EF",
  },
  textosPossibilidade: { flex: 1, gap: 3 },
  nomePossibilidade: { color: "#1A1C19", fontSize: 14, fontWeight: "800" },
  codigoPossibilidade: { color: "#717A6D", fontSize: 11, fontWeight: "600" },
  valorPossibilidade: { color: "#00450D", fontSize: 16, fontWeight: "900" },
  semPossibilidades: {
    color: "#717A6D",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  limitesResultado: {
    paddingHorizontal: 4,
    marginTop: 10,
  },
  textoLimitesResultado: {
    color: "#717A6D",
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
  },
  erroAnalise: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#F0C9C9",
    borderRadius: 16,
    borderCurve: "continuous",
    backgroundColor: "#FFF2F2",
  },
  textosErroAnalise: { flex: 1, gap: 3 },
  tituloErroAnalise: { color: "#7A1E1E", fontSize: 13, fontWeight: "900" },
  textoErroAnalise: { color: "#7A3C3C", fontSize: 12, lineHeight: 18 },
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

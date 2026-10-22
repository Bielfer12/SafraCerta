import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSessao } from "../context/Sessao";
import { listarAnalises, SITUACOES_ANALISE } from "../services/historicoAnalises";
import { listarTalhoes } from "../services/talhoes";
import { listarUsuarios } from "../services/usuarios";
import { CLASSIFICACOES, obterNomeClassificacao } from "../utils/nomesClassificacoes";

const filtrosIniciais = () => ({
  dias: 30,
  inicio: new Date(Date.now() - 30 * 86400000),
  talhaoId: "",
  usuarioId: "",
  status: "",
  classe: "",
});
const periodos = [
  { valor: 7, nome: "Últimos 7 dias" },
  { valor: 30, nome: "Últimos 30 dias" },
  { valor: 90, nome: "Últimos 90 dias" },
  { valor: 0, nome: "Todo o período" },
];

function LinhaAnalise({ item, anterior, admin }) {
  const data = item.criadoEm?.toDate().toLocaleDateString("pt-BR");
  const dataAnterior = anterior?.criadoEm?.toDate().toLocaleDateString("pt-BR");
  const concluida = item.status === "CONCLUIDA";
  return (
    <View>
      {data !== dataAnterior ? (
        <Text style={styles.grupo}>{data || "Sem data"}</Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ver tentativa de ${item.talhaoSnapshot?.nome}, ${SITUACOES_ANALISE[item.status]}`}
        style={styles.linha}
        onPress={() =>
          router.push({ pathname: "/analise/[id]", params: { id: item.id } })
        }
      >
        <View style={[styles.icone, !concluida && styles.iconePendente]}>
          <Ionicons
            name={concluida ? "leaf-outline" : "time-outline"}
            size={24}
            color={concluida ? "#1B5E20" : "#785B21"}
          />
        </View>
        <View style={styles.textos}>
          <View style={styles.linhaSituacao}>
            <Text
              style={[styles.situacao, !concluida && styles.situacaoPendente]}
            >
              {SITUACOES_ANALISE[item.status] || item.status}
            </Text>
            <Text style={styles.hora}>
              {item.criadoEm
                ?.toDate()
                .toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
            </Text>
          </View>
          <Text style={styles.nome}>
            {item.talhaoSnapshot?.codigo} — {item.talhaoSnapshot?.nome}
          </Text>
          <Text style={styles.descricao}>
            {concluida
              ? obterNomeClassificacao(
                  item.resultado?.classe,
                  item.resultado?.nome_exibicao,
                )
              : item.erro?.mensagem || "Aguardando confirmação do servidor."}
          </Text>
          {concluida ? (
            <Text style={styles.descricao}>
              Pontuação {Math.round(item.resultado.pontuacao * 100)}%
            </Text>
          ) : null}
          {admin ? (
            <Text style={styles.autor}>
              {item.usuarioSnapshot?.nomeCompleto || "Usuário"} ·{" "}
              {item.usuarioSnapshot?.matricula || "Sem matrícula"}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#596155" />
      </Pressable>
    </View>
  );
}

export default function Historico() {
  const { admin } = useSessao();
  const [filtros, setFiltros] = useState(filtrosIniciais);
  const [itens, setItens] = useState([]);
  const [talhoes, setTalhoes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [mais, setMais] = useState(false);
  const [temMais, setTemMais] = useState(false);
  const [erro, setErro] = useState("");
  const [erroOpcoes, setErroOpcoes] = useState("");
  const [seletor, setSeletor] = useState(null);
  const [busca, setBusca] = useState("");
  const [uidFiltro, setUidFiltro] = useState("");
  const pagina = useRef(null);
  const geracao = useRef(0);
  const ocupado = useRef(false);

  const consultar = useCallback(
    async (adicionar = false) => {
      if (adicionar && ocupado.current) return;
      const atual = ++geracao.current;
      ocupado.current = true;
      if (adicionar) setMais(true);
      else {
        setCarregando(true);
        setItens([]);
        pagina.current = null;
      }
      setErro("");
      try {
        const resposta = await listarAnalises(
          filtros,
          admin,
          adicionar ? pagina.current : null,
        );
        if (atual !== geracao.current) return;
        setItens((anteriores) =>
          adicionar ? [...anteriores, ...resposta.itens] : resposta.itens,
        );
        pagina.current = resposta.pagina;
        setTemMais(resposta.temMais);
      } catch (falha) {
        if (atual === geracao.current) setErro(falha.message);
      } finally {
        if (atual === geracao.current) {
          ocupado.current = false;
          setCarregando(false);
          setMais(false);
        }
      }
    },
    [admin, filtros],
  );

  useFocusEffect(
    useCallback(() => {
      consultar();
      return () => {
        geracao.current += 1;
        ocupado.current = false;
      };
    }, [consultar]),
  );

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      Promise.allSettled([
        listarTalhoes(),
        ...(admin ? [listarUsuarios()] : []),
      ]).then((resultados) => {
        if (!ativo) return;
        if (resultados[0].status === "fulfilled")
          setTalhoes(resultados[0].value);
        if (resultados[1]?.status === "fulfilled")
          setUsuarios(resultados[1].value);
        setErroOpcoes(
          resultados.some((item) => item.status === "rejected")
            ? "Algumas opções de filtro não carregaram. Reabra esta tela para tentar novamente."
            : "",
        );
      });
      return () => {
        ativo = false;
      };
    }, [admin]),
  );

  const escolher = (valor) => {
    setFiltros((anteriores) => ({
      ...anteriores,
      [seletor]: valor,
      ...(seletor === "dias"
        ? { inicio: valor ? new Date(Date.now() - valor * 86400000) : null }
        : {}),
    }));
    setSeletor(null);
  };
  const opcoes =
    seletor === "dias"
      ? periodos
      : seletor === "status"
        ? [
            { valor: "", nome: "Todas as situações" },
            ...Object.entries(SITUACOES_ANALISE).map(([valor, nome]) => ({
              valor,
              nome,
            })),
          ]
        : seletor === "classe"
          ? [{ valor: "", nome: "Todas as classificações" }, ...CLASSIFICACOES]
          : seletor === "usuarioId"
            ? [
                { valor: "", nome: "Todos os usuários" },
                ...usuarios.map((item) => ({
                  valor: item.uid,
                  nome: `${item.nomeCompleto} — ${item.matricula}`,
                })),
              ]
            : [
                { valor: "", nome: "Todos os talhões" },
                ...talhoes.map((item) => ({
                  valor: item.id,
                  nome: `${item.codigo} — ${item.nome}${item.status === "INATIVO" ? " (inativo)" : ""}`,
                })),
              ];
  const opcoesFiltradas = opcoes.filter((item) =>
    item.nome
      .toLocaleLowerCase("pt-BR")
      .includes(busca.toLocaleLowerCase("pt-BR")),
  );
  const nomesFiltros = {
    dias: periodos.find((item) => item.valor === filtros.dias)?.nome,
    talhaoId:
      talhoes.find((item) => item.id === filtros.talhaoId)?.codigo || "Talhão",
    status: SITUACOES_ANALISE[filtros.status] || "Situação",
    classe:
      CLASSIFICACOES.find((item) => item.valor === filtros.classe)?.nome ||
      "Classificação",
    usuarioId: filtros.usuarioId
      ? usuarios.find((item) => item.uid === filtros.usuarioId)?.nomeCompleto ||
        "UID selecionado"
      : "Usuário",
  };
  const renderItem = useCallback(
    ({ item, index }) => (
      <LinhaAnalise item={item} anterior={itens[index - 1]} admin={admin} />
    ),
    [admin, itens],
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <View style={styles.cabecalho}>
        <Pressable
          accessibilityLabel="Voltar"
          onPress={() => router.back()}
          style={styles.toque}
        >
          <Ionicons name="arrow-back" size={25} color="#FFFFFF" />
        </Pressable>
        <Text accessibilityRole="header" style={styles.titulo}>
          Histórico
        </Text>
        <Pressable
          accessibilityLabel="Atualizar histórico"
          onPress={() => consultar()}
          style={styles.toque}
        >
          <Ionicons name="refresh" size={23} color="#FFFFFF" />
        </Pressable>
      </View>
      <FlatList
        data={itens}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.lista}
        refreshing={carregando}
        onRefresh={() => consultar()}
        ListHeaderComponent={
          <View>
            <Text style={styles.introducao}>
              {admin
                ? "Análises da lavoura, com o contexto de cada teste."
                : "Suas análises, fotos e resultados em um só lugar."}
            </Text>
            <View style={styles.filtros}>
              {Object.keys(nomesFiltros)
                .filter((campo) => admin || campo !== "usuarioId")
                .map((campo) => (
                  <Pressable
                    key={campo}
                    accessibilityRole="button"
                    accessibilityLabel={`Filtrar por ${nomesFiltros[campo]}`}
                    onPress={() => {
                      setBusca("");
                      setUidFiltro(filtros.usuarioId);
                      setSeletor(campo);
                    }}
                    style={[
                      styles.filtro,
                      filtros[campo] && campo !== "dias" && styles.filtroAtivo,
                    ]}
                  >
                    <Text style={styles.textoFiltro}>
                      {nomesFiltros[campo]}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#1B5E20" />
                  </Pressable>
                ))}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setFiltros(filtrosIniciais())}
              style={styles.limpar}
            >
              <Text style={styles.textoFiltro}>Restaurar filtros</Text>
            </Pressable>
            {erroOpcoes ? <Text style={styles.aviso}>{erroOpcoes}</Text> : null}
          </View>
        }
        ListEmptyComponent={
          carregando ? (
            <View style={styles.estado}>
              <ActivityIndicator color="#1B5E20" />
              <Text style={styles.descricao}>Carregando histórico…</Text>
            </View>
          ) : !erro ? (
            <View style={styles.estado}>
              <Ionicons name="leaf-outline" size={40} color="#1B5E20" />
              <Text style={styles.nome}>Nenhuma análise neste filtro</Text>
              <Text style={styles.descricao}>
                Ajuste os filtros ou faça um teste de folha.
              </Text>
              <Pressable
                onPress={() => router.push("/teste-folha")}
                style={styles.botao}
              >
                <Text style={styles.textoBotao}>Analisar folha</Text>
              </Pressable>
            </View>
          ) : null
        }
        ListFooterComponent={
          <View>
            {erro ? (
              <View accessibilityRole="alert" style={styles.erro}>
                <Text style={styles.textoErro}>{erro}</Text>
                <Pressable
                  onPress={() => consultar(itens.length > 0)}
                  style={styles.toque}
                >
                  <Text style={styles.textoFiltro}>Tentar novamente</Text>
                </Pressable>
              </View>
            ) : null}
            {temMais && !erro && !carregando ? (
              <Pressable
                accessibilityRole="button"
                disabled={mais}
                onPress={() => consultar(true)}
                style={styles.carregarMais}
              >
                {mais ? (
                  <ActivityIndicator color="#1B5E20" />
                ) : (
                  <Text style={styles.textoFiltro}>Carregar mais</Text>
                )}
              </Pressable>
            ) : null}
          </View>
        }
      />
      <Modal
        visible={Boolean(seletor)}
        animationType="slide"
        onRequestClose={() => setSeletor(null)}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.cabecalho}>
            <Pressable
              accessibilityLabel="Fechar filtro"
              onPress={() => setSeletor(null)}
              style={styles.toque}
            >
              <Ionicons name="arrow-back" size={25} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.titulo}>Filtrar histórico</Text>
          </View>
          <TextInput
            accessibilityLabel="Buscar opção de filtro"
            value={busca}
            onChangeText={setBusca}
            placeholder="Buscar opção"
            style={styles.input}
          />
          {seletor === "usuarioId" ? (
            <View style={styles.uid}>
              <Text style={styles.descricao}>
                Para uma conta removida, informe o UID presente no detalhe da
                análise.
              </Text>
              <TextInput
                accessibilityLabel="UID do usuário"
                value={uidFiltro}
                onChangeText={setUidFiltro}
                maxLength={128}
                autoCapitalize="none"
                style={styles.input}
              />
              <Pressable
                onPress={() => escolher(uidFiltro.trim())}
                style={styles.limpar}
              >
                <Text style={styles.textoFiltro}>Usar este UID</Text>
              </Pressable>
            </View>
          ) : null}
          <FlatList
            data={opcoesFiltradas}
            keyExtractor={(item) => String(item.valor)}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{
                  checked: filtros[seletor] === item.valor,
                }}
                onPress={() => escolher(item.valor)}
                style={styles.opcao}
              >
                <Text style={styles.nome}>{item.nome}</Text>
                <Ionicons
                  name={
                    filtros[seletor] === item.valor
                      ? "radio-button-on"
                      : "radio-button-off"
                  }
                  size={23}
                  color="#1B5E20"
                />
              </Pressable>
            )}
            ListEmptyComponent={
              <Text style={styles.introducao}>Nenhuma opção encontrada.</Text>
            }
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8F4" },
  cabecalho: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1B5E20",
    paddingHorizontal: 10,
  },
  toque: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  titulo: { flex: 1, fontSize: 22, fontWeight: "700", color: "#FFFFFF" },
  lista: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  introducao: {
    color: "#596155",
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 16,
    padding: 4,
  },
  filtros: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filtro: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#C3CDBF",
    backgroundColor: "#FFFFFF",
    maxWidth: "100%",
  },
  filtroAtivo: { backgroundColor: "#E4F4DE", borderColor: "#1B5E20" },
  textoFiltro: {
    color: "#1B5E20",
    fontSize: 14,
    fontWeight: "600",
    flexShrink: 1,
  },
  limpar: {
    minHeight: 48,
    alignSelf: "flex-start",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  grupo: {
    fontSize: 14,
    color: "#596155",
    fontWeight: "700",
    marginTop: 20,
    marginBottom: 10,
  },
  linha: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#DDE5D8",
  },
  icone: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E4F4DE",
  },
  iconePendente: { backgroundColor: "#F3ECD9" },
  textos: { flex: 1, gap: 5 },
  linhaSituacao: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  situacao: { fontSize: 13, color: "#1B5E20", fontWeight: "700" },
  situacaoPendente: { color: "#785B21" },
  hora: { color: "#596155", fontSize: 13 },
  nome: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1C19",
    lineHeight: 23,
    flexShrink: 1,
  },
  descricao: { fontSize: 14, color: "#596155", lineHeight: 21 },
  autor: { fontSize: 12, color: "#596155", lineHeight: 18 },
  estado: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingVertical: 48,
  },
  botao: {
    minHeight: 48,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#1B5E20",
    justifyContent: "center",
  },
  textoBotao: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  erro: {
    backgroundColor: "#FFF0ED",
    padding: 16,
    gap: 8,
    marginVertical: 16,
    borderRadius: 12,
  },
  textoErro: { color: "#A01818", fontSize: 14, lineHeight: 22 },
  aviso: { color: "#785B21", fontSize: 14, lineHeight: 21, marginBottom: 12 },
  carregarMais: {
    minHeight: 56,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  input: {
    margin: 16,
    padding: 14,
    minHeight: 52,
    borderWidth: 1,
    borderColor: "#C3CDBF",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    fontSize: 16,
    color: "#1A1C19",
  },
  opcao: {
    minHeight: 64,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#DDE5D8",
  },
  uid: { paddingHorizontal: 16 },
});

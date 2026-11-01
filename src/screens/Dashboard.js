import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSessao } from "../context/Sessao";
import {
  LIMITE_DASHBOARD,
  listarAnalisesPainel,
} from "../services/historicoAnalises";
import { listarTalhoes } from "../services/talhoes";
import { listarUsuarios } from "../services/usuarios";
import {
  formatarDuracao,
  inicioDoPeriodo,
  montarPainel,
} from "../utils/dashboardAnalises";
import { obterNomeClassificacao } from "../utils/nomesClassificacoes";

const periodos = [
  { valor: 7, nome: "7 dias", completo: "Últimos 7 dias" },
  { valor: 30, nome: "30 dias", completo: "Últimos 30 dias" },
  { valor: 90, nome: "90 dias", completo: "Últimos 90 dias" },
  { valor: 0, nome: "Tudo", completo: "Todo o período" },
];
const filtrosIniciais = () => ({ dias: 30, talhaoId: "", usuarioId: "" });
const ALTURA_GRAFICO = 120;
const LINHAS_INICIAIS = 8;
const UNIDADES = { dia: "dia", semana: "semana", mes: "mês" };

const plural = (quantidade, singular, pluralizado) =>
  `${quantidade} ${quantidade === 1 ? singular : pluralizado}`;

function Secao({ titulo, descricao, children }) {
  return (
    <View style={styles.secao}>
      <Text accessibilityRole="header" style={styles.tituloSecao}>
        {titulo}
      </Text>
      {descricao ? <Text style={styles.descricao}>{descricao}</Text> : null}
      {children}
    </View>
  );
}

function Indicador({ valor, rotulo }) {
  return (
    <View
      accessible
      accessibilityLabel={`${rotulo}: ${valor}`}
      style={styles.indicador}
    >
      <Text style={styles.valorIndicador}>{valor}</Text>
      <Text style={styles.rotuloIndicador}>{rotulo}</Text>
    </View>
  );
}

function BarraClassificacao({ item, saudavel }) {
  const nome = obterNomeClassificacao(item.classe, item.nomeExibicao);
  return (
    <View
      accessible
      accessibilityLabel={`${nome}: ${plural(item.quantidade, "análise", "análises")}, ${item.percentual}% das concluídas`}
      style={styles.itemBarra}
    >
      <View style={styles.linhaTopo}>
        <Text style={styles.nome}>{nome}</Text>
        <Text style={styles.valorLinha}>
          {item.quantidade} ({item.percentual}%)
        </Text>
      </View>
      <View style={styles.trilho}>
        <View
          style={[
            styles.preenchimento,
            saudavel ? styles.corSaudavel : styles.corAtencao,
            { width: `${Math.max(item.percentual, 2)}%` },
          ]}
        />
      </View>
    </View>
  );
}

function GraficoSerie({ serie }) {
  const { pontos, granularidade } = serie;
  const maximo = Math.max(1, ...pontos.map((ponto) => ponto.total));
  const maior = pontos.reduce(
    (melhor, ponto) => (ponto.total > melhor.total ? ponto : melhor),
    pontos[0],
  );
  const meio = pontos[Math.floor((pontos.length - 1) / 2)];
  const rotulos =
    pontos.length > 2
      ? [pontos[0], meio, pontos.at(-1)]
      : pontos.length === 2
        ? [pontos[0], pontos[1]]
        : [pontos[0]];
  return (
    <View>
      <View
        accessible
        accessibilityLabel={`Análises por ${UNIDADES[granularidade]}. Maior movimento: ${maior.rotuloCompleto}, com ${plural(maior.total, "tentativa", "tentativas")}.`}
      >
        <View style={styles.grafico}>
          {pontos.map((ponto) => {
            const semResultado = ponto.total - ponto.concluidas;
            return (
              <View key={ponto.chave} style={styles.coluna}>
                {semResultado > 0 ? (
                  <View
                    style={[
                      styles.segmento,
                      styles.corSemResultado,
                      { height: (semResultado / maximo) * ALTURA_GRAFICO },
                    ]}
                  />
                ) : null}
                {ponto.concluidas > 0 ? (
                  <View
                    style={[
                      styles.segmento,
                      styles.corConcluidas,
                      { height: (ponto.concluidas / maximo) * ALTURA_GRAFICO },
                    ]}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
        <View style={styles.rotulosGrafico}>
          {rotulos.map((ponto) => (
            <Text key={ponto.chave} style={styles.legendaPequena}>
              {ponto.rotulo}
            </Text>
          ))}
        </View>
      </View>
      <View style={styles.legenda}>
        <View style={styles.itemLegenda}>
          <View style={[styles.amostra, styles.corConcluidas]} />
          <Text style={styles.legendaPequena}>Concluídas</Text>
        </View>
        <View style={styles.itemLegenda}>
          <View style={[styles.amostra, styles.corSemResultado]} />
          <Text style={styles.legendaPequena}>Sem resultado ou em andamento</Text>
        </View>
      </View>
      <Text style={[styles.descricao, styles.aposLegenda]}>
        Maior movimento: {maior.rotuloCompleto}, com{" "}
        {plural(maior.total, "tentativa", "tentativas")}.
      </Text>
    </View>
  );
}

function LinhaTalhao({ talhao }) {
  const principal = talhao.classePrincipal;
  return (
    <View style={styles.linhaLista}>
      <View style={styles.linhaTopo}>
        <Text style={styles.nome}>
          {talhao.codigo} — {talhao.nome}
        </Text>
        <Text style={styles.valorLinha}>
          {plural(talhao.total, "tentativa", "tentativas")}
        </Text>
      </View>
      {talhao.propriedadeNome ? (
        <Text style={styles.descricao}>{talhao.propriedadeNome}</Text>
      ) : null}
      <Text style={styles.descricao}>
        {plural(talhao.concluidas, "concluída", "concluídas")},{" "}
        {talhao.naoConcluidas} sem resultado
        {talhao.emAndamento ? `, ${talhao.emAndamento} em andamento` : ""}
      </Text>
      {principal ? (
        <Text style={styles.descricao}>
          Mais frequente:{" "}
          {obterNomeClassificacao(principal.classe, principal.nomeExibicao)} (
          {principal.quantidade} de {principal.deConcluidas})
        </Text>
      ) : null}
    </View>
  );
}

function LinhaUsuario({ usuario }) {
  return (
    <View style={styles.linhaLista}>
      <View style={styles.linhaTopo}>
        <Text style={styles.nome}>{usuario.nome}</Text>
        <Text style={styles.valorLinha}>
          {plural(usuario.total, "tentativa", "tentativas")}
        </Text>
      </View>
      {usuario.matricula ? (
        <Text style={styles.descricao}>Matrícula {usuario.matricula}</Text>
      ) : null}
      <Text style={styles.descricao}>
        {plural(usuario.concluidas, "concluída", "concluídas")},{" "}
        {usuario.naoConcluidas} sem resultado
        {usuario.emAndamento ? `, ${usuario.emAndamento} em andamento` : ""}
      </Text>
    </View>
  );
}

function ListaLimitada({ itens, renderizar, rotuloItens }) {
  const [todos, setTodos] = useState(false);
  const visiveis = todos ? itens : itens.slice(0, LINHAS_INICIAIS);
  return (
    <View>
      {visiveis.map(renderizar)}
      {itens.length > LINHAS_INICIAIS ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setTodos((anterior) => !anterior)}
          style={styles.limpar}
        >
          <Text style={styles.textoFiltro}>
            {todos ? "Mostrar menos" : `Ver todos (${itens.length} ${rotuloItens})`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function PainelResultados({ painel, admin }) {
  const { resumo, classificacoes, serie, talhoes, usuarios, falhas } = painel;
  return (
    <View>
      <Secao
        titulo="Resumo"
        descricao="Sem resultado: falhas e tentativas interrompidas."
      >
        <View style={styles.indicadores}>
          <Indicador valor={resumo.total} rotulo="Tentativas" />
          <Indicador valor={resumo.concluidas} rotulo="Concluídas" />
          <Indicador valor={resumo.naoConcluidas} rotulo="Sem resultado" />
          <Indicador valor={resumo.emAndamento} rotulo="Em andamento" />
        </View>
        <Text style={styles.descricao}>
          {resumo.taxaConclusao === null
            ? "Nenhuma tentativa encerrada ainda."
            : `${resumo.taxaConclusao}% das tentativas encerradas geraram resultado.`}
        </Text>
        <Text style={styles.descricao}>
          Tempo médio de processamento: {formatarDuracao(resumo.tempoMedioMs)}
        </Text>
      </Secao>

      <Secao
        titulo="O que o modelo classificou"
        descricao={
          classificacoes.total
            ? `Somente análises concluídas (${classificacoes.total}). Verde: folha saudável. Laranja: demais classificações.`
            : "Ainda não há análises concluídas neste filtro."
        }
      >
        {classificacoes.itens.map((item) => (
          <BarraClassificacao
            key={item.classe}
            item={item}
            saudavel={item.classe === "healthy"}
          />
        ))}
        {classificacoes.semClassificacao ? (
          <Text style={styles.aviso}>
            {plural(
              classificacoes.semClassificacao,
              "análise concluída sem classificação legível",
              "análises concluídas sem classificação legível",
            )}
            , fora do gráfico.
          </Text>
        ) : null}
      </Secao>

      {serie.pontos.length ? (
        <Secao titulo={`Análises por ${UNIDADES[serie.granularidade]}`}>
          <GraficoSerie serie={serie} />
        </Secao>
      ) : null}

      {talhoes.length ? (
        <Secao titulo="Por talhão">
          <ListaLimitada
            itens={talhoes}
            rotuloItens="talhões"
            renderizar={(talhao) => <LinhaTalhao key={talhao.id} talhao={talhao} />}
          />
        </Secao>
      ) : null}

      {admin && usuarios.length ? (
        <Secao titulo="Por usuário">
          <ListaLimitada
            itens={usuarios}
            rotuloItens="usuários"
            renderizar={(usuario) => (
              <LinhaUsuario key={usuario.id} usuario={usuario} />
            )}
          />
        </Secao>
      ) : null}

      {falhas.length ? (
        <Secao
          titulo="Motivos de falha e interrupção"
          descricao="Tentativas que terminaram sem resultado."
        >
          {falhas.map((motivo) => (
            <View
              key={motivo.codigo}
              accessible
              accessibilityLabel={`${motivo.rotulo}: ${plural(motivo.quantidade, "tentativa", "tentativas")}`}
              style={styles.linhaLista}
            >
              <View style={styles.linhaTopo}>
                <Text style={styles.nome}>{motivo.rotulo}</Text>
                <Text style={styles.valorLinha}>{motivo.quantidade}</Text>
              </View>
            </View>
          ))}
        </Secao>
      ) : null}

      <Text style={styles.nota}>
        Cada tentativa conta uma vez, inclusive uma nova análise da mesma foto.
        A pontuação do modelo não mede gravidade nem área afetada, e as
        classificações não confirmam um diagnóstico.
      </Text>
    </View>
  );
}

export default function Dashboard() {
  const { admin } = useSessao();
  const [filtros, setFiltros] = useState(filtrosIniciais);
  const [dados, setDados] = useState(null);
  const [talhoes, setTalhoes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [erroOpcoes, setErroOpcoes] = useState("");
  const [seletor, setSeletor] = useState(null);
  const [busca, setBusca] = useState("");
  const geracao = useRef(0);

  const consultar = useCallback(async () => {
    const atual = ++geracao.current;
    setCarregando(true);
    setErro("");
    setDados(null);
    const inicio = inicioDoPeriodo(filtros.dias);
    try {
      const resposta = await listarAnalisesPainel(
        { inicio, talhaoId: filtros.talhaoId, usuarioId: filtros.usuarioId },
        admin,
      );
      if (atual !== geracao.current) return;
      setDados({
        itens: resposta.itens,
        truncado: resposta.truncado,
        inicio,
        fim: new Date(),
      });
    } catch (falha) {
      if (atual === geracao.current) setErro(falha.message);
    } finally {
      if (atual === geracao.current) setCarregando(false);
    }
  }, [admin, filtros]);

  useFocusEffect(
    useCallback(() => {
      consultar();
      return () => {
        geracao.current += 1;
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

  const painel = useMemo(
    () =>
      dados
        ? montarPainel(dados.itens, { inicio: dados.inicio, fim: dados.fim })
        : null,
    [dados],
  );

  const escolher = (valor) => {
    setFiltros((anteriores) => ({ ...anteriores, [seletor]: valor }));
    setSeletor(null);
  };
  const opcoes =
    seletor === "usuarioId"
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
    item.nome.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")),
  );
  const nomeTalhao = filtros.talhaoId
    ? talhoes.find((item) => item.id === filtros.talhaoId)?.codigo || "Talhão selecionado"
    : "Talhão";
  const nomeUsuario = filtros.usuarioId
    ? usuarios.find((item) => item.uid === filtros.usuarioId)?.nomeCompleto ||
      "Usuário selecionado"
    : "Usuário";

  const abrirSeletor = (campo) => {
    setBusca("");
    setSeletor(campo);
  };
  const vazio = dados && dados.itens.length === 0;

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
          Dashboard
        </Text>
        <Pressable
          accessibilityLabel="Atualizar dashboard"
          onPress={consultar}
          style={styles.toque}
        >
          <Ionicons name="refresh" size={23} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.conteudo}
        refreshControl={
          <RefreshControl
            refreshing={carregando}
            onRefresh={consultar}
            colors={["#1B5E20"]}
          />
        }
      >
        <Text style={styles.introducao}>
          {admin
            ? "Resumo das análises da lavoura no período escolhido."
            : "Resumo das suas análises no período escolhido."}
        </Text>

        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Período"
          style={styles.periodos}
        >
          {periodos.map((periodo) => {
            const ativo = filtros.dias === periodo.valor;
            return (
              <Pressable
                key={periodo.valor}
                accessibilityRole="radio"
                accessibilityLabel={periodo.completo}
                accessibilityState={{ checked: ativo }}
                onPress={() =>
                  setFiltros((anteriores) => ({
                    ...anteriores,
                    dias: periodo.valor,
                  }))
                }
                style={[styles.periodo, ativo && styles.periodoAtivo]}
              >
                <Text
                  style={[styles.textoPeriodo, ativo && styles.textoPeriodoAtivo]}
                >
                  {periodo.nome}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.filtros}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Filtrar por talhão: ${nomeTalhao}`}
            onPress={() => abrirSeletor("talhaoId")}
            style={[styles.filtro, filtros.talhaoId && styles.filtroAtivo]}
          >
            <Text style={styles.textoFiltro}>{nomeTalhao}</Text>
            <Ionicons name="chevron-down" size={16} color="#1B5E20" />
          </Pressable>
          {admin ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Filtrar por usuário: ${nomeUsuario}`}
              onPress={() => abrirSeletor("usuarioId")}
              style={[styles.filtro, filtros.usuarioId && styles.filtroAtivo]}
            >
              <Text style={styles.textoFiltro}>{nomeUsuario}</Text>
              <Ionicons name="chevron-down" size={16} color="#1B5E20" />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => setFiltros(filtrosIniciais())}
          style={styles.limpar}
        >
          <Text style={styles.textoFiltro}>Restaurar filtros</Text>
        </Pressable>
        {erroOpcoes ? <Text style={styles.aviso}>{erroOpcoes}</Text> : null}

        {carregando && !dados ? (
          <View style={styles.estado}>
            <ActivityIndicator color="#1B5E20" />
            <Text style={styles.descricao}>Calculando indicadores…</Text>
          </View>
        ) : null}

        {erro ? (
          <View accessibilityRole="alert" style={styles.erro}>
            <Text style={styles.textoErro}>{erro}</Text>
            <Pressable onPress={consultar} style={styles.toque}>
              <Text style={styles.textoFiltro}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : null}

        {vazio ? (
          <View style={styles.estado}>
            <Ionicons name="stats-chart-outline" size={40} color="#1B5E20" />
            <Text style={styles.nome}>Nenhuma análise neste filtro</Text>
            <Text style={styles.descricao}>
              Ajuste o período ou os filtros, ou faça um teste de folha.
            </Text>
            <Pressable
              onPress={() => router.push("/teste-folha")}
              style={styles.botao}
            >
              <Text style={styles.textoBotao}>Analisar folha</Text>
            </Pressable>
          </View>
        ) : null}

        {dados && !vazio ? (
          <View>
            {dados.truncado ? (
              <Text accessibilityRole="alert" style={styles.aviso}>
                Exibindo as {LIMITE_DASHBOARD} análises mais recentes deste
                filtro. Escolha um período menor ou um talhão para ver tudo.
              </Text>
            ) : null}
            <Text style={styles.descricao}>
              Atualizado em{" "}
              {dados.fim.toLocaleString("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </Text>
            <PainelResultados painel={painel} admin={admin} />
          </View>
        ) : null}
      </ScrollView>

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
            <Text style={styles.titulo}>
              {seletor === "usuarioId" ? "Filtrar por usuário" : "Filtrar por talhão"}
            </Text>
          </View>
          <TextInput
            accessibilityLabel="Buscar opção de filtro"
            value={busca}
            onChangeText={setBusca}
            placeholder="Buscar opção"
            style={styles.input}
          />
          <FlatList
            data={opcoesFiltradas}
            keyExtractor={(item) => String(item.valor)}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: filtros[seletor] === item.valor }}
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
  conteudo: { padding: 16, paddingBottom: 40, flexGrow: 1 },
  introducao: {
    color: "#596155",
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 16,
    padding: 4,
  },
  periodos: { flexDirection: "row", gap: 8, marginBottom: 8 },
  periodo: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#C3CDBF",
    backgroundColor: "#FFFFFF",
  },
  periodoAtivo: { backgroundColor: "#1B5E20", borderColor: "#1B5E20" },
  textoPeriodo: { color: "#1B5E20", fontSize: 14, fontWeight: "700" },
  textoPeriodoAtivo: { color: "#FFFFFF" },
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
  secao: {
    marginTop: 28,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#DDE5D8",
    gap: 10,
  },
  tituloSecao: { fontSize: 18, fontWeight: "700", color: "#1A1C19" },
  indicadores: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE5D8",
    borderRadius: 12,
  },
  indicador: {
    width: "50%",
    padding: 16,
    gap: 2,
  },
  valorIndicador: { fontSize: 28, fontWeight: "800", color: "#1A1C19" },
  rotuloIndicador: { fontSize: 14, color: "#596155" },
  itemBarra: { gap: 8, paddingVertical: 8 },
  linhaTopo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  nome: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1C19",
    lineHeight: 23,
  },
  valorLinha: { fontSize: 15, fontWeight: "700", color: "#1A1C19", lineHeight: 23 },
  trilho: {
    height: 14,
    borderRadius: 7,
    backgroundColor: "#E7ECE3",
    overflow: "hidden",
  },
  preenchimento: { height: 14, borderRadius: 7 },
  corSaudavel: { backgroundColor: "#1B5E20" },
  corAtencao: { backgroundColor: "#B95000" },
  corConcluidas: { backgroundColor: "#596155" },
  corSemResultado: { backgroundColor: "#C9A13B" },
  grafico: {
    height: ALTURA_GRAFICO,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    borderBottomWidth: 1,
    borderBottomColor: "#C3CDBF",
  },
  coluna: { flex: 1, justifyContent: "flex-end" },
  segmento: { width: "100%" },
  rotulosGrafico: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  legenda: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 12 },
  itemLegenda: { flexDirection: "row", alignItems: "center", gap: 6 },
  amostra: { width: 14, height: 14, borderRadius: 3 },
  legendaPequena: { fontSize: 13, color: "#596155" },
  aposLegenda: { marginTop: 10 },
  linhaLista: {
    gap: 4,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#DDE5D8",
  },
  descricao: { fontSize: 14, color: "#596155", lineHeight: 21 },
  nota: {
    fontSize: 13,
    color: "#596155",
    lineHeight: 20,
    marginTop: 32,
  },
  estado: {
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
  aviso: { color: "#785B21", fontSize: 14, lineHeight: 21, marginVertical: 8 },
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
});

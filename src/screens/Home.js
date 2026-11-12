import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { autenticacao } from "../services/firebase";
import { useSessao } from "../context/Sessao";
import CabecalhoApp from "../components/CabecalhoApp";
import { LIMITE_DASHBOARD, listarAnalisesPainel } from "../services/historicoAnalises";
import { listarTalhoes } from "../services/talhoes";
import { listarUsuarios } from "../services/usuarios";
import { formatarDuracao, inicioDoPeriodo, montarPainel } from "../utils/dashboardAnalises";
import { obterNomeClassificacao } from "../utils/nomesClassificacoes";

const periodos = [
  { valor: 7, nome: "Últimos 7 dias" },
  { valor: 30, nome: "Últimos 30 dias" },
  { valor: 90, nome: "Últimos 90 dias" },
  { valor: 0, nome: "Todo o período" },
];
const filtrosIniciais = () => ({ dias: 30, talhaoId: "", usuarioId: "" });
const ALTURA_GRAFICO = 120;
const LINHAS_INICIAIS = 8;
const UNIDADES = { dia: "dia", semana: "semana", mes: "mês" };

const plural = (quantidade, singular, pluralizado) =>
  `${quantidade} ${quantidade === 1 ? singular : pluralizado}`;

function BarraClassificacao({ item }) {
  const nome = obterNomeClassificacao(item.classe, item.nomeExibicao);
  return (
    <View accessible accessibilityLabel={`${nome}: ${plural(item.quantidade, "análise", "análises")}, ${item.percentual}% das concluídas`} style={styles.itemBarra}>
      <View style={styles.linhaTopo}>
        <Text style={styles.nome}>{nome}</Text>
        <Text style={styles.valorLinha}>{item.quantidade} ({item.percentual}%)</Text>
      </View>
      <View style={styles.trilho}>
        <View style={[styles.preenchimento, item.classe === "healthy" ? styles.corSaudavel : styles.corAtencao, { width: `${Math.max(item.percentual, 2)}%` }]} />
      </View>
    </View>
  );
}

function GraficoSerie({ serie }) {
  const { pontos, granularidade } = serie;
  const maximo = Math.max(1, ...pontos.map((ponto) => ponto.total));
  const maior = pontos.reduce((melhor, ponto) => (ponto.total > melhor.total ? ponto : melhor), pontos[0]);
  const meio = pontos[Math.floor((pontos.length - 1) / 2)];
  const rotulos = pontos.length > 2 ? [pontos[0], meio, pontos.at(-1)] : pontos;
  const textoMaior = `Maior movimento: ${maior.rotuloCompleto}, com ${plural(maior.total, "tentativa", "tentativas")}.`;
  return (
    <View>
      <View accessible accessibilityLabel={`Análises por ${UNIDADES[granularidade]}. ${textoMaior}`}>
        <View style={styles.grafico}>
          {pontos.map((ponto) => {
            const semResultado = ponto.total - ponto.concluidas;
            return (
              <View key={ponto.chave} style={styles.coluna}>
                {semResultado > 0 ? <View style={[styles.corSemResultado, { height: (semResultado / maximo) * ALTURA_GRAFICO }]} /> : null}
                {ponto.concluidas > 0 ? <View style={[styles.corConcluidas, { height: (ponto.concluidas / maximo) * ALTURA_GRAFICO }]} /> : null}
              </View>
            );
          })}
        </View>
        <View style={styles.rotulosGrafico}>
          {rotulos.map((ponto) => (
            <Text key={ponto.chave} style={styles.legendaPequena}>{ponto.rotulo}</Text>
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
      <Text style={[styles.descricao, styles.aposLegenda]}>{textoMaior}</Text>
    </View>
  );
}

function LinhaTalhao({ talhao }) {
  const principal = talhao.classePrincipal;
  return (
    <View style={styles.linhaLista}>
      <View style={styles.linhaTopo}>
        <Text style={styles.nome}>{talhao.codigo} — {talhao.nome}</Text>
        <Text style={styles.valorLinha}>{plural(talhao.total, "tentativa", "tentativas")}</Text>
      </View>
      {talhao.propriedadeNome ? <Text style={styles.descricao}>{talhao.propriedadeNome}</Text> : null}
      <Text style={styles.descricao}>
        {plural(talhao.concluidas, "concluída", "concluídas")}, {talhao.naoConcluidas} sem resultado
        {talhao.emAndamento ? `, ${talhao.emAndamento} em andamento` : ""}
      </Text>
      {principal ? (
        <Text style={styles.descricao}>
          Mais frequente: {obterNomeClassificacao(principal.classe, principal.nomeExibicao)} ({principal.quantidade} de {principal.deConcluidas})
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
        <Text style={styles.valorLinha}>{plural(usuario.total, "tentativa", "tentativas")}</Text>
      </View>
      {usuario.matricula ? <Text style={styles.descricao}>Matrícula {usuario.matricula}</Text> : null}
      <Text style={styles.descricao}>
        {plural(usuario.concluidas, "concluída", "concluídas")}, {usuario.naoConcluidas} sem resultado
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
        <Pressable accessibilityRole="button" onPress={() => setTodos((anterior) => !anterior)} style={styles.verTodos}>
          <Text style={styles.textoVerde}>{todos ? "Mostrar menos" : `Ver todos (${itens.length} ${rotuloItens})`}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Sanfona({ titulo, contagem, aberta, aoAlternar, children }) {
  return (
    <View style={styles.sanfona}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: aberta }} onPress={aoAlternar} style={styles.cabecalhoSanfona}>
        <Text style={styles.tituloSanfona}>{titulo}</Text>
        {contagem ? <Text style={styles.legendaPequena}>{contagem}</Text> : null}
        <Ionicons name={aberta ? "chevron-up" : "chevron-down"} size={18} color="#1B5E20" />
      </Pressable>
      {aberta ? <View style={styles.corpoSanfona}>{children}</View> : null}
    </View>
  );
}

function GrupoFiltro({ titulo, opcoes, escolhido, aoEscolher }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={titulo}>
      <Text style={styles.tituloGrupo}>{titulo}</Text>
      {opcoes.map((opcao) => {
        const marcada = escolhido === opcao.valor;
        return (
          <Pressable key={String(opcao.valor)} accessibilityRole="radio" accessibilityState={{ checked: marcada }} onPress={() => aoEscolher(opcao.valor)} style={styles.opcao}>
            <Text style={styles.textoOpcao}>{opcao.nome}</Text>
            <Ionicons name={marcada ? "radio-button-on" : "radio-button-off"} size={22} color="#1B5E20" />
          </Pressable>
        );
      })}
    </View>
  );
}

export default function Home() {
  const { perfil, mensagem, admin } = useSessao();
  const [filtros, setFiltros] = useState(filtrosIniciais);
  const [dados, setDados] = useState(null);
  const [talhoes, setTalhoes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [erroOpcoes, setErroOpcoes] = useState("");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [abertas, setAbertas] = useState({});
  const geracao = useRef(0);
  const email = autenticacao.currentUser?.email || "Usuário";

  const consultar = useCallback(async () => {
    const atual = ++geracao.current;
    setCarregando(true);
    setErro("");
    const inicio = inicioDoPeriodo(filtros.dias);
    try {
      const resposta = await listarAnalisesPainel({ inicio, talhaoId: filtros.talhaoId, usuarioId: filtros.usuarioId }, admin);
      if (atual !== geracao.current) return;
      setDados({ itens: resposta.itens, truncado: resposta.truncado, inicio, fim: new Date() });
    } catch (falha) {
      if (atual !== geracao.current) return;
      setDados(null);
      setErro(falha.message);
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
      Promise.allSettled([listarTalhoes(), ...(admin ? [listarUsuarios()] : [])]).then((resultados) => {
        if (!ativo) return;
        if (resultados[0].status === "fulfilled") setTalhoes(resultados[0].value);
        if (resultados[1]?.status === "fulfilled") setUsuarios(resultados[1].value);
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
    () => (dados ? montarPainel(dados.itens, { inicio: dados.inicio, fim: dados.fim }) : null),
    [dados],
  );

  const escolher = (campo, valor) => setFiltros((anteriores) => ({ ...anteriores, [campo]: valor }));
  const alternar = (secao) => setAbertas((anteriores) => ({ ...anteriores, [secao]: !anteriores[secao] }));

  const opcoesTalhao = [
    { valor: "", nome: "Todos os talhões" },
    ...talhoes.map((item) => ({ valor: item.id, nome: `${item.codigo} — ${item.nome}${item.status === "INATIVO" ? " (inativo)" : ""}` })),
  ];
  const opcoesUsuario = [
    { valor: "", nome: "Todos os usuários" },
    ...usuarios.map((item) => ({ valor: item.uid, nome: `${item.nomeCompleto} — ${item.matricula}` })),
  ];
  const nomePeriodo = periodos.find((item) => item.valor === filtros.dias).nome;
  const nomeTalhao = filtros.talhaoId
    ? talhoes.find((item) => item.id === filtros.talhaoId)?.codigo || "Talhão selecionado"
    : "Todos os talhões";
  const nomeUsuario = filtros.usuarioId
    ? usuarios.find((item) => item.uid === filtros.usuarioId)?.nomeCompleto || "Usuário selecionado"
    : "";
  const filtrado = Boolean(filtros.talhaoId || filtros.usuarioId);
  const resumo = painel?.resumo;
  const vazio = dados && dados.itens.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <CabecalhoApp titulo="Início" iconeAcao="refresh" rotuloAcao="Atualizar resumo" aoPressionarAcao={consultar} />

      <ScrollView
        contentContainerStyle={styles.conteudo}
        refreshControl={<RefreshControl refreshing={carregando} onRefresh={consultar} colors={["#1B5E20"]} />}
      >
        <Text style={styles.titulo}>Olá, {perfil?.nomeCompleto?.split(" ")[0] || email.split("@")[0]}</Text>
        <Text style={styles.subtitulo}>{admin ? "Veja como está a lavoura." : "Veja como estão as suas análises."}</Text>
        {mensagem ? <Text style={styles.subtitulo}>{mensagem}</Text> : null}

        <View style={styles.destaque}>
          <View style={styles.topoDestaque}>
            <Text style={styles.textoFiltros}>
              {nomePeriodo}{"\n"}{nomeTalhao}{nomeUsuario ? ` · ${nomeUsuario}` : ""}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel={filtrado ? "Filtros, com filtro aplicado" : "Filtros"} onPress={() => setFiltrosAbertos(true)} style={styles.botaoFiltros}>
              <Ionicons name="options-outline" size={17} color="#FFFFFF" />
              <Text style={styles.textoBotaoFiltros}>Filtros</Text>
              {filtrado ? <View style={styles.pontoFiltro} /> : null}
            </Pressable>
          </View>

          {resumo ? (
            <View>
              <View accessible accessibilityLabel={plural(resumo.total, "tentativa", "tentativas")} style={styles.linhaTotal}>
                <Text style={styles.total}>{resumo.total}</Text>
                <Text style={styles.unidadeTotal}>{resumo.total === 1 ? "tentativa" : "tentativas"}</Text>
              </View>
              <View style={styles.medidor}>
                <View style={[styles.nivelMedidor, { width: `${resumo.taxaConclusao ?? 0}%` }]} />
              </View>
              <Text style={styles.textoDestaque}>
                {resumo.taxaConclusao === null
                  ? "Nenhuma tentativa encerrada ainda."
                  : `${resumo.taxaConclusao}% das tentativas encerradas geraram resultado.`}
              </Text>
              <View style={styles.trio}>
                <View accessible style={styles.itemTrio}>
                  <Text style={styles.valorTrio}>{resumo.concluidas}</Text>
                  <Text style={styles.rotuloTrio}>Concluídas</Text>
                </View>
                <View accessible style={styles.itemTrio}>
                  <Text style={styles.valorTrio}>{resumo.naoConcluidas}</Text>
                  <Text style={styles.rotuloTrio}>Sem resultado</Text>
                </View>
                <View accessible style={styles.itemTrio}>
                  <Text style={styles.valorTrio}>{resumo.emAndamento}</Text>
                  <Text style={styles.rotuloTrio}>Em andamento</Text>
                </View>
              </View>
            </View>
          ) : carregando ? (
            <View style={styles.esperaDestaque}>
              <ActivityIndicator color="#94F990" />
              <Text style={styles.textoDestaque}>Calculando indicadores…</Text>
            </View>
          ) : null}
        </View>

        {erro ? (
          <View accessibilityRole="alert" style={styles.erro}>
            <Text style={styles.textoErro}>{erro}</Text>
            <Pressable accessibilityRole="button" onPress={consultar} style={styles.verTodos}>
              <Text style={styles.textoVerde}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : null}

        {vazio ? (
          <View style={styles.estado}>
            <Ionicons name="stats-chart-outline" size={40} color="#1B5E20" />
            <Text style={styles.tituloCartao}>Nenhuma análise neste filtro</Text>
            <Text style={[styles.descricao, styles.centralizado]}>Ajuste o período ou os filtros, ou faça um teste de folha.</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push("/teste-folha")} style={styles.botao}>
              <Text style={styles.textoBotao}>Analisar folha</Text>
            </Pressable>
          </View>
        ) : null}

        {painel && !vazio ? (
          <View>
            {dados.truncado ? (
              <Text accessibilityRole="alert" style={styles.aviso}>
                Exibindo as {LIMITE_DASHBOARD} análises mais recentes deste filtro. Escolha um período menor ou um talhão para ver tudo.
              </Text>
            ) : null}

            <View style={styles.cartao}>
              <Text accessibilityRole="header" style={styles.tituloCartao}>Mais classificadas</Text>
              <Text style={styles.descricao}>
                {painel.classificacoes.total
                  ? `As mais frequentes entre as ${painel.classificacoes.total} concluídas.`
                  : "Ainda não há análises concluídas neste filtro."}
              </Text>
              {painel.classificacoes.itens.slice(0, 3).map((item) => (
                <BarraClassificacao key={item.classe} item={item} />
              ))}
            </View>

            {painel.classificacoes.itens.length ? (
              <Sanfona titulo="Todas as classificações" contagem={painel.classificacoes.itens.length} aberta={abertas.classificacoes} aoAlternar={() => alternar("classificacoes")}>
                <Text style={styles.descricao}>Somente análises concluídas. Verde: folha saudável. Laranja: demais classificações.</Text>
                {painel.classificacoes.itens.map((item) => (
                  <BarraClassificacao key={item.classe} item={item} />
                ))}
                {painel.classificacoes.semClassificacao ? (
                  <Text style={styles.aviso}>
                    {plural(painel.classificacoes.semClassificacao, "análise concluída sem classificação legível", "análises concluídas sem classificação legível")}, fora do gráfico.
                  </Text>
                ) : null}
              </Sanfona>
            ) : null}

            {painel.serie.pontos.length ? (
              <Sanfona titulo={`Análises por ${UNIDADES[painel.serie.granularidade]}`} aberta={abertas.serie} aoAlternar={() => alternar("serie")}>
                <GraficoSerie serie={painel.serie} />
              </Sanfona>
            ) : null}

            {painel.talhoes.length ? (
              <Sanfona titulo="Por talhão" contagem={painel.talhoes.length} aberta={abertas.talhoes} aoAlternar={() => alternar("talhoes")}>
                <ListaLimitada itens={painel.talhoes} rotuloItens="talhões" renderizar={(talhao) => <LinhaTalhao key={talhao.id} talhao={talhao} />} />
              </Sanfona>
            ) : null}

            {admin && painel.usuarios.length ? (
              <Sanfona titulo="Por usuário" contagem={painel.usuarios.length} aberta={abertas.usuarios} aoAlternar={() => alternar("usuarios")}>
                <ListaLimitada itens={painel.usuarios} rotuloItens="usuários" renderizar={(usuario) => <LinhaUsuario key={usuario.id} usuario={usuario} />} />
              </Sanfona>
            ) : null}

            {painel.falhas.length ? (
              <Sanfona titulo="Motivos de falha" contagem={resumo.naoConcluidas} aberta={abertas.falhas} aoAlternar={() => alternar("falhas")}>
                <Text style={styles.descricao}>Tentativas que terminaram sem resultado.</Text>
                {painel.falhas.map((motivo) => (
                  <View key={motivo.codigo} accessible accessibilityLabel={`${motivo.rotulo}: ${plural(motivo.quantidade, "tentativa", "tentativas")}`} style={styles.linhaLista}>
                    <View style={styles.linhaTopo}>
                      <Text style={styles.nome}>{motivo.rotulo}</Text>
                      <Text style={styles.valorLinha}>{motivo.quantidade}</Text>
                    </View>
                  </View>
                ))}
              </Sanfona>
            ) : null}

          </View>
        ) : null}
      </ScrollView>

      <Modal transparent visible={filtrosAbertos} animationType="slide" onRequestClose={() => setFiltrosAbertos(false)}>
        <Pressable accessibilityLabel="Fechar filtros" style={styles.fundo} onPress={() => setFiltrosAbertos(false)}>
          <Pressable style={styles.folha}>
            <Text accessibilityRole="header" style={styles.tituloFolha}>Filtros</Text>
            <ScrollView style={styles.listaFiltros}>
              {erroOpcoes ? <Text style={styles.aviso}>{erroOpcoes}</Text> : null}
              <GrupoFiltro titulo="Período" opcoes={periodos} escolhido={filtros.dias} aoEscolher={(valor) => escolher("dias", valor)} />
              <GrupoFiltro titulo="Talhão" opcoes={opcoesTalhao} escolhido={filtros.talhaoId} aoEscolher={(valor) => escolher("talhaoId", valor)} />
              {admin ? (
                <GrupoFiltro titulo="Usuário" opcoes={opcoesUsuario} escolhido={filtros.usuarioId} aoEscolher={(valor) => escolher("usuarioId", valor)} />
              ) : null}
            </ScrollView>
            <View style={styles.acoesFolha}>
              <Pressable accessibilityRole="button" onPress={() => setFiltros(filtrosIniciais())} style={styles.botaoSecundario}>
                <Text style={styles.textoVerde}>Restaurar</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setFiltrosAbertos(false)} style={[styles.botao, styles.botaoLargo]}>
                <Text style={styles.textoBotao}>Ver resultados</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8F4" },
  conteudo: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 120, flexGrow: 1 },
  titulo: { color: "#1A1C19", fontSize: 25, fontWeight: "800", paddingHorizontal: 4 },
  subtitulo: { color: "#596155", fontSize: 15, marginTop: 4, paddingHorizontal: 4 },
  destaque: { marginTop: 16, marginBottom: 12, padding: 18, borderRadius: 26, backgroundColor: "#1B5E20" },
  topoDestaque: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  textoFiltros: { flex: 1, color: "#BFE3BB", fontSize: 13, fontWeight: "600", lineHeight: 18 },
  botaoFiltros: { minHeight: 48, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 24, backgroundColor: "rgba(255, 255, 255, 0.14)" },
  textoBotaoFiltros: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  pontoFiltro: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#94F990" },
  linhaTotal: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 14 },
  total: { color: "#FFFFFF", fontSize: 52, fontWeight: "800", lineHeight: 58 },
  unidadeTotal: { color: "#BFE3BB", fontSize: 15, fontWeight: "600" },
  medidor: { height: 8, borderRadius: 4, marginTop: 12, marginBottom: 8, backgroundColor: "rgba(255, 255, 255, 0.22)", overflow: "hidden" },
  nivelMedidor: { height: 8, borderRadius: 4, backgroundColor: "#94F990" },
  textoDestaque: { color: "#D5EBD1", fontSize: 13, lineHeight: 19 },
  trio: { flexDirection: "row", gap: 8, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: "rgba(255, 255, 255, 0.18)" },
  itemTrio: { flex: 1 },
  valorTrio: { color: "#FFFFFF", fontSize: 21, fontWeight: "800" },
  rotuloTrio: { color: "#BFE3BB", fontSize: 12 },
  esperaDestaque: { alignItems: "center", gap: 10, paddingVertical: 34 },
  cartao: { gap: 6, padding: 16, marginBottom: 8, borderRadius: 22, borderWidth: 1, borderColor: "#DDE5D8", backgroundColor: "#FFFFFF" },
  tituloCartao: { color: "#1A1C19", fontSize: 17, fontWeight: "700" },
  sanfona: { marginBottom: 8, borderRadius: 18, borderWidth: 1, borderColor: "#DDE5D8", backgroundColor: "#FFFFFF" },
  cabecalhoSanfona: { minHeight: 54, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10 },
  tituloSanfona: { flex: 1, color: "#1A1C19", fontSize: 15, fontWeight: "700" },
  corpoSanfona: { paddingHorizontal: 16, paddingBottom: 14, gap: 4 },
  itemBarra: { gap: 8, paddingVertical: 7 },
  linhaTopo: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  nome: { flex: 1, color: "#1A1C19", fontSize: 15, fontWeight: "700", lineHeight: 22 },
  valorLinha: { color: "#1A1C19", fontSize: 15, fontWeight: "700", lineHeight: 22 },
  trilho: { height: 13, borderRadius: 7, backgroundColor: "#E7ECE3", overflow: "hidden" },
  preenchimento: { height: 13, borderRadius: 7 },
  corSaudavel: { backgroundColor: "#1B5E20" },
  corAtencao: { backgroundColor: "#B95000" },
  corConcluidas: { backgroundColor: "#596155" },
  corSemResultado: { backgroundColor: "#C9A13B" },
  grafico: { height: ALTURA_GRAFICO, flexDirection: "row", alignItems: "flex-end", gap: 2, borderBottomWidth: 1, borderBottomColor: "#C3CDBF" },
  coluna: { flex: 1, justifyContent: "flex-end" },
  rotulosGrafico: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  legenda: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 12 },
  itemLegenda: { flexDirection: "row", alignItems: "center", gap: 6 },
  amostra: { width: 14, height: 14, borderRadius: 3 },
  legendaPequena: { color: "#596155", fontSize: 13 },
  aposLegenda: { marginTop: 10 },
  linhaLista: { gap: 4, paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#DDE5D8" },
  descricao: { color: "#596155", fontSize: 14, lineHeight: 21 },
  centralizado: { textAlign: "center" },
  rodape: { marginTop: 8, paddingHorizontal: 4 },
  nota: { color: "#596155", fontSize: 13, lineHeight: 20, marginTop: 16, paddingHorizontal: 4 },
  verTodos: { minHeight: 48, alignSelf: "flex-start", justifyContent: "center" },
  textoVerde: { color: "#1B5E20", fontSize: 14, fontWeight: "700" },
  estado: { alignItems: "center", gap: 12, paddingVertical: 40 },
  botao: { minHeight: 50, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#1B5E20" },
  textoBotao: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  erro: { gap: 4, padding: 16, marginBottom: 12, borderRadius: 16, backgroundColor: "#FFF0ED" },
  textoErro: { color: "#A01818", fontSize: 14, lineHeight: 22 },
  aviso: { color: "#785B21", fontSize: 14, lineHeight: 21, marginVertical: 8, paddingHorizontal: 4 },
  fundo: { flex: 1, justifyContent: "flex-end", padding: 12, backgroundColor: "rgba(10, 28, 14, 0.42)" },
  folha: { maxHeight: "82%", padding: 20, gap: 12, borderRadius: 28, backgroundColor: "#FFFFFF" },
  tituloFolha: { color: "#1A1C19", fontSize: 18, fontWeight: "700" },
  listaFiltros: { flexGrow: 0 },
  tituloGrupo: { color: "#596155", fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginTop: 10 },
  opcao: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottomWidth: 1, borderBottomColor: "#DDE5D8" },
  textoOpcao: { flex: 1, color: "#1A1C19", fontSize: 15, fontWeight: "600" },
  acoesFolha: { flexDirection: "row", alignItems: "center", gap: 12 },
  botaoSecundario: { minHeight: 50, paddingHorizontal: 12, justifyContent: "center" },
  botaoLargo: { flex: 1 },
});

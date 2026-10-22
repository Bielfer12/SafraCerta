import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSessao } from "../context/Sessao";
import { executarOperacaoTalhao, listarTalhoes, novaOperacaoTalhao } from "../services/talhoes";
import { UFS, validarTalhao } from "../../functions/talhoes-validacao";

const vazios = {
  codigo: "",
  nome: "",
  propriedadeNome: "",
  localidade: "",
  municipio: "",
  uf: "",
  areaHa: "",
  status: "ATIVO",
  observacoes: "",
};
const camposTexto = [
  {
    nome: "codigo",
    titulo: "Código do talhão",
    obrigatorio: true,
    limite: 20,
    ajuda: "Código único. Exemplo: TAL-002",
    capitalizacao: "characters",
  },
  { nome: "nome", titulo: "Nome do talhão", obrigatorio: true, limite: 80 },
  { nome: "propriedadeNome", titulo: "Nome da propriedade", obrigatorio: true, limite: 100 },
  { nome: "localidade", titulo: "Localidade / comunidade", limite: 120 },
  { nome: "municipio", titulo: "Município", limite: 100 },
];
const termo = (valor = "") =>
  String(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
const dataLocal = (data) =>
  data?.toDate ? data.toDate().toLocaleString("pt-BR") : "Não informado";

function Campo({ titulo, erro, ajuda, bloqueado, ...props }) {
  return (
    <View style={styles.grupo}>
      <Text style={styles.label}>{titulo}</Text>
      <TextInput
        {...props}
        accessibilityLabel={titulo}
        editable={!bloqueado}
        placeholderTextColor="#596155"
        style={[styles.campo, bloqueado && styles.campoBloqueado, erro && styles.campoErro]}
      />
      {ajuda ? <Text style={styles.ajuda}>{ajuda}</Text> : null}
      {erro ? (
        <Text accessibilityRole="alert" style={styles.erro}>
          {erro}
        </Text>
      ) : null}
    </View>
  );
}

export default function Talhoes() {
  const { admin, acessoTalhoes } = useSessao();
  const [talhoes, setTalhoes] = useState([]);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("TODOS");
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [acoes, setAcoes] = useState(null);
  const [formulario, setFormulario] = useState(null);
  const [campos, setCampos] = useState(vazios);
  const [originais, setOriginais] = useState(vazios);
  const [erros, setErros] = useState({});
  const [erroForm, setErroForm] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [incerta, setIncerta] = useState(false);
  const [ufAberta, setUfAberta] = useState(false);
  const [excluir, setExcluir] = useState(null);
  const [erroExclusao, setErroExclusao] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  const consulta = useRef(0);
  const ocupado = useRef(false);
  const operacao = useRef(null);
  const botoesAcoes = useRef({});
  const leitura = formulario?.modo === "visualizar";
  const bloqueado = leitura || !admin || salvando || incerta;

  const consultar = useCallback(() => {
    const atual = ++consulta.current;
    return listarTalhoes()
      .then((resposta) => { if (atual === consulta.current) setTalhoes(resposta); })
      .catch((erro) => {
        if (atual === consulta.current) { setTalhoes([]); setErroLista(erro.message); }
      })
      .finally(() => { if (atual === consulta.current) setCarregando(false); });
  }, []);

  const carregar = () => {
    setCarregando(true);
    setErroLista("");
    return consultar();
  };

  useEffect(() => {
    if (acessoTalhoes) consultar();
    return () => {
      consulta.current += 1;
    };
  }, [acessoTalhoes, consultar]);

  const fecharAcoes = () => {
    const id = acoes?.id;
    setAcoes(null);
    if (id) setTimeout(() => botoesAcoes.current[id]?.focus?.(), 0);
  };

  const abrirFormulario = (modo, talhao = null) => {
    if (modo !== "visualizar" && !admin) return;
    const valores = { ...vazios };
    if (talhao)
      for (const nome of Object.keys(vazios))
        valores[nome] =
          nome === "areaHa"
            ? talhao.areaHa == null
              ? ""
              : String(talhao.areaHa).replace(".", ",")
            : String(talhao[nome] ?? vazios[nome]);
    setAcoes(null);
    setCampos(valores);
    setOriginais(valores);
    setErros({});
    setErroForm("");
    setIncerta(false);
    setSucesso("");
    operacao.current = null;
    setFormulario({ modo, talhao });
  };

  const fecharFormulario = () => {
    if (ocupado.current) return;
    const fechar = () => {
      setFormulario(null);
      setUfAberta(false);
      if (incerta) carregar();
    };
    if (!leitura && JSON.stringify(campos) !== JSON.stringify(originais)) {
      Alert.alert(
        "Descartar alterações?",
        incerta
          ? "A confirmação não chegou. Confira a lista antes de iniciar outro cadastro."
          : "As alterações deste formulário ainda não foram salvas.",
        [
          { text: "Continuar editando", style: "cancel" },
          { text: "Fechar formulário", style: "destructive", onPress: fechar },
        ],
      );
    } else fechar();
  };

  const atualizar = (nome, valor) => {
    if (bloqueado) return;
    setCampos((antes) => ({ ...antes, [nome]: valor }));
    setErros((antes) => ({ ...antes, [nome]: "" }));
  };

  const salvar = async () => {
    if (!admin || leitura || ocupado.current) return;
    const { dados, erros: invalidos } = validarTalhao(campos);
    setErros(invalidos);
    if (Object.keys(invalidos).length) return;
    const cadastro = formulario.modo === "cadastrar";
    const pedido = {
      ...dados,
      ...(cadastro ? {} : { talhaoId: formulario.talhao.id, versao: formulario.talhao.versao }),
    };
    const assinatura = JSON.stringify(pedido);
    if (operacao.current?.assinatura !== assinatura)
      operacao.current = { assinatura, id: novaOperacaoTalhao() };
    ocupado.current = true;
    setSalvando(true);
    setErroForm("");
    try {
      await executarOperacaoTalhao(cadastro ? "cadastrarTalhao" : "alterarTalhao", {
        ...pedido,
        operacaoId: operacao.current.id,
      });
      setFormulario(null);
      setSucesso(cadastro ? "Talhão cadastrado." : "Alterações salvas.");
      carregar();
    } catch (erro) {
      setErroForm(erro.message);
      setErros(erro.campos);
      if (
        ["functions/unavailable", "functions/deadline-exceeded", "functions/internal"].includes(
          erro.code,
        )
      )
        setIncerta(true);
    } finally {
      ocupado.current = false;
      setSalvando(false);
    }
  };

  const confirmarExclusao = async () => {
    if (!admin || !excluir || ocupado.current) return;
    ocupado.current = true;
    setExcluindo(true);
    setErroExclusao("");
    try {
      await executarOperacaoTalhao("excluirTalhao", {
        talhaoId: excluir.id,
        versao: excluir.versao,
        operacaoId: excluir.operacaoId,
      });
      setExcluir(null);
      setSucesso("Talhão excluído.");
      carregar();
    } catch (erro) {
      setErroExclusao(erro.message);
    } finally {
      ocupado.current = false;
      setExcluindo(false);
    }
  };

  const pesquisa = termo(busca);
  const filtrados = talhoes.filter(
    (item) =>
      (filtro === "TODOS" || item.status === filtro) &&
      [item.codigo, item.nome, item.propriedadeNome].some((valor) =>
        termo(valor).includes(pesquisa),
      ),
  );
  if (!acessoTalhoes) return null;

  return (
    <SafeAreaView style={styles.tela}>
      <StatusBar style="dark" />
      <View style={styles.cabecalho}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar para Home"
          onPress={() => router.back()}
          style={styles.icone}
        >
          <Ionicons name="arrow-back" size={25} color="#FFFFFF" />
        </Pressable>
        <Text accessibilityRole="header" style={styles.titulo}>
          Talhões
        </Text>
        <Ionicons name="map-outline" size={25} color="#FFFFFF" />
      </View>
      <View style={styles.topo}>
        <View style={styles.linhaBusca}>
          <View style={styles.busca}>
            <Ionicons name="search-outline" size={21} color="#596155" />
            <TextInput
              accessibilityLabel="Buscar talhão por código, nome ou propriedade"
              placeholder="Código, nome ou propriedade"
              placeholderTextColor="#596155"
              value={busca}
              onChangeText={setBusca}
              autoCorrect={false}
              style={styles.inputBusca}
            />
            {busca ? (
              <Pressable
                accessibilityLabel="Limpar pesquisa"
                accessibilityRole="button"
                onPress={() => setBusca("")}
                style={styles.icone}
              >
                <Ionicons name="close" size={21} color="#596155" />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cadastrar talhão"
            accessibilityHint={!admin ? "Disponível apenas para administradores" : undefined}
            accessibilityState={{ disabled: !admin }}
            disabled={!admin}
            onPress={() => abrirFormulario("cadastrar")}
            style={[styles.cadastro, !admin && styles.desativado]}
          >
            <Ionicons name="add-outline" size={27} color={admin ? "#FFFFFF" : "#596155"} />
          </Pressable>
        </View>
        {!admin ? (
          <Text style={styles.ajuda}>
            Cadastro e alterações disponíveis apenas para administradores.
          </Text>
        ) : null}
        <View style={styles.filtros}>
          {[
            ["TODOS", "Todos"],
            ["ATIVO", "Ativos"],
            ["INATIVO", "Inativos"],
          ].map(([valor, label]) => (
            <Pressable
              key={valor}
              accessibilityRole="button"
              accessibilityState={{ selected: filtro === valor }}
              onPress={() => setFiltro(valor)}
              style={[styles.filtro, filtro === valor && styles.filtroAtivo]}
            >
              <Text style={[styles.textoFiltro, filtro === valor && styles.textoFiltroAtivo]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        {sucesso ? (
          <Text accessibilityLiveRegion="polite" style={styles.sucesso}>
            {sucesso}
          </Text>
        ) : null}
      </View>
      <FlatList
        data={filtrados}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        refreshing={carregando}
        onRefresh={carregar}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <View style={styles.registro}>
            <View style={styles.dadosRegistro}>
              <Text style={styles.codigo}>{item.codigo}</Text>
              <Text style={styles.nome}>{item.nome}</Text>
              <Text style={styles.detalhe}>{item.propriedadeNome}</Text>
              {item.localidade ? <Text style={styles.ajuda}>{item.localidade}</Text> : null}
              <Text style={item.status === "ATIVO" ? styles.ativo : styles.ajuda}>
                {item.status === "ATIVO" ? "Ativo" : "Inativo"}
              </Text>
            </View>
            <Pressable
              ref={(elemento) => {
                botoesAcoes.current[item.id] = elemento;
              }}
              accessibilityRole="button"
              accessibilityLabel={`Ações de ${item.codigo}, ${item.nome}`}
              style={styles.icone}
              onPress={() => {
                setAcoes(item);
                setSucesso("");
              }}
            >
              <Ionicons name="ellipsis-vertical" size={23} color="#1B5E20" />
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          carregando ? (
            <View style={styles.estado}>
              <ActivityIndicator color="#1B5E20" />
              <Text style={styles.ajuda}>Carregando talhões...</Text>
            </View>
          ) : erroLista ? (
            <View accessibilityRole="alert" style={styles.estado}>
              <Text style={styles.erro}>{erroLista}</Text>
              <Pressable accessibilityRole="button" onPress={carregar} style={styles.secundario}>
                <Text style={styles.textoSecundario}>Tentar novamente</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.estado}>
              <Ionicons name="map-outline" size={36} color="#596155" />
              <Text style={styles.nome}>
                {busca || filtro !== "TODOS"
                  ? "Nenhum talhão encontrado"
                  : "Nenhum talhão cadastrado"}
              </Text>
              <Text style={styles.ajuda}>
                {busca || filtro !== "TODOS"
                  ? "Confira a pesquisa e o filtro de situação."
                  : admin
                    ? "Use o botão de cadastro para adicionar o primeiro talhão."
                    : "Solicite o cadastro de um talhão ao administrador."}
              </Text>
            </View>
          )
        }
      />

      <Modal transparent visible={Boolean(acoes)} animationType="fade" onRequestClose={fecharAcoes}>
        <View style={styles.fundo}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar ações do talhão"
            onPress={fecharAcoes}
            style={StyleSheet.absoluteFill}
          />
          <View accessibilityViewIsModal style={styles.dialogo}>
            <Text style={styles.nome}>{acoes?.nome}</Text>
            <Text style={styles.ajuda}>{acoes?.codigo}</Text>
            {[
              ["visualizar", "Visualizar", "eye-outline"],
              ["alterar", "Alterar", "create-outline"],
              ["excluir", "Excluir", "trash-outline"],
            ].map(([modo, label, icone]) => {
              const desativada = modo !== "visualizar" && !admin;
              return (
                <Pressable
                  key={modo}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: desativada }}
                  disabled={desativada}
                  style={[styles.acao, desativada && styles.desativado]}
                  onPress={() => {
                    if (modo !== "excluir") abrirFormulario(modo, acoes);
                    else {
                      setExcluir({ ...acoes, operacaoId: novaOperacaoTalhao() });
                      setErroExclusao("");
                      setAcoes(null);
                    }
                  }}
                >
                  <Ionicons
                    name={icone}
                    size={23}
                    color={desativada ? "#596155" : modo === "excluir" ? "#BA1A1A" : "#1B5E20"}
                  />
                  <Text
                    style={[styles.textoAcao, !desativada && modo === "excluir" && styles.erro]}
                  >
                    {label}
                  </Text>
                  {desativada ? (
                    <Ionicons name="lock-closed-outline" size={17} color="#596155" />
                  ) : null}
                </Pressable>
              );
            })}
            {!admin ? (
              <Text style={styles.ajuda}>
                Apenas a visualização está disponível para seu perfil.
              </Text>
            ) : null}
            <Pressable accessibilityRole="button" style={styles.secundario} onPress={fecharAcoes}>
              <Text style={styles.textoSecundario}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(formulario)} animationType="slide" onRequestClose={fecharFormulario}>
        <SafeAreaView style={styles.tela}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.flex}
          >
            <View style={styles.cabecalho}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fechar formulário de talhão"
                disabled={salvando}
                onPress={fecharFormulario}
                style={styles.icone}
              >
                <Ionicons name="arrow-back" size={25} color="#FFFFFF" />
              </Pressable>
              <Text accessibilityRole="header" style={styles.titulo}>
                {leitura
                  ? "Visualizar talhão"
                  : formulario?.modo === "cadastrar"
                    ? "Cadastrar talhão"
                    : "Alterar talhão"}
              </Text>
            </View>
            <ScrollView
              contentContainerStyle={styles.formulario}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <Text style={styles.ajuda}>
                {leitura
                  ? "Dados do talhão e da propriedade."
                  : "Os campos com * são obrigatórios."}
              </Text>
              {!leitura && !admin ? (
                <Text accessibilityRole="alert" style={styles.erro}>
                  Seu acesso administrativo foi encerrado. Feche o formulário para continuar.
                </Text>
              ) : null}
              {incerta ? (
                <Text accessibilityRole="alert" style={styles.aviso}>
                  A confirmação não chegou. Tente novamente com os mesmos dados antes de iniciar
                  outra operação.
                </Text>
              ) : null}
              {camposTexto.map((campo) => (
                <Campo
                  key={campo.nome}
                  titulo={`${campo.titulo}${!leitura && campo.obrigatorio ? " *" : ""}`}
                  value={campos[campo.nome]}
                  onChangeText={(valor) => atualizar(campo.nome, valor)}
                  erro={erros[campo.nome]}
                  ajuda={leitura ? undefined : campo.ajuda}
                  bloqueado={bloqueado}
                  maxLength={campo.limite}
                  autoCapitalize={campo.capitalizacao || "words"}
                  autoCorrect={campo.nome !== "codigo"}
                />
              ))}
              <View style={styles.grupo}>
                <Text style={styles.label}>UF</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Selecionar UF, ${campos.uf || "não informada"}`}
                  accessibilityState={{ disabled: bloqueado }}
                  disabled={bloqueado}
                  onPress={() => setUfAberta(true)}
                  style={[
                    styles.selecao,
                    bloqueado && styles.campoBloqueado,
                    erros.uf && styles.campoErro,
                  ]}
                >
                  <Text style={styles.detalhe}>{campos.uf || "Não informada"}</Text>
                  {!leitura ? <Ionicons name="chevron-down" size={20} color="#596155" /> : null}
                </Pressable>
                {erros.uf ? (
                  <Text accessibilityRole="alert" style={styles.erro}>
                    {erros.uf}
                  </Text>
                ) : null}
              </View>
              <Campo
                titulo="Área em hectares"
                value={campos.areaHa}
                onChangeText={(valor) => atualizar("areaHa", valor)}
                erro={erros.areaHa}
                bloqueado={bloqueado}
                keyboardType="decimal-pad"
                maxLength={20}
                placeholder={leitura ? "Não informada" : "Ex.: 2,5"}
                ajuda={
                  leitura ? undefined : "Opcional. Deixe vazio se a área ainda não for conhecida."
                }
              />
              <View style={styles.grupo}>
                <Text style={styles.label}>Situação{!leitura ? " *" : ""}</Text>
                <View style={styles.filtros}>
                  {[
                    ["ATIVO", "Ativo"],
                    ["INATIVO", "Inativo"],
                  ].map(([valor, label]) => (
                    <Pressable
                      key={valor}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: campos.status === valor, disabled: bloqueado }}
                      disabled={bloqueado}
                      onPress={() => atualizar("status", valor)}
                      style={[styles.filtro, campos.status === valor && styles.filtroAtivo]}
                    >
                      <Text
                        style={[
                          styles.textoFiltro,
                          campos.status === valor && styles.textoFiltroAtivo,
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {erros.status ? <Text style={styles.erro}>{erros.status}</Text> : null}
              </View>
              <Campo
                titulo="Observações"
                value={campos.observacoes}
                onChangeText={(valor) => atualizar("observacoes", valor)}
                bloqueado={bloqueado}
                erro={erros.observacoes}
                multiline
                maxLength={500}
                textAlignVertical="top"
                numberOfLines={4}
                placeholder={leitura ? "Não informadas" : "Informações adicionais sobre o talhão"}
              />
              {leitura ? (
                <View style={styles.metadados}>
                  <Text style={styles.ajuda}>
                    Criado em: {dataLocal(formulario?.talhao.criadoEm)}
                  </Text>
                  <Text style={styles.ajuda}>
                    Atualizado em: {dataLocal(formulario?.talhao.atualizadoEm)}
                  </Text>
                  <Text selectable style={styles.ajuda}>
                    Criado por: {formulario?.talhao.criadoPor || "Não informado"}
                  </Text>
                  <Text selectable style={styles.ajuda}>
                    Atualizado por: {formulario?.talhao.atualizadoPor || "Não informado"}
                  </Text>
                </View>
              ) : null}
              {erroForm ? (
                <Text accessibilityRole="alert" style={styles.erro}>
                  {erroForm}
                </Text>
              ) : null}
              {!leitura ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !admin || salvando, busy: salvando }}
                  disabled={!admin || salvando}
                  onPress={salvar}
                  style={[styles.botao, (!admin || salvando) && styles.desativado]}
                >
                  {salvando ? <ActivityIndicator color="#FFFFFF" /> : null}
                  <Text style={[styles.textoBotao, (!admin || salvando) && styles.textoDesativado]}>
                    {salvando
                      ? "Salvando..."
                      : formulario?.modo === "cadastrar"
                        ? "Cadastrar talhão"
                        : "Salvar alterações"}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                disabled={salvando}
                onPress={fecharFormulario}
                style={styles.secundario}
              >
                <Text style={styles.textoSecundario}>{leitura ? "Fechar" : "Cancelar"}</Text>
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      <Modal
        transparent
        visible={ufAberta && Boolean(formulario)}
        animationType="fade"
        onRequestClose={() => setUfAberta(false)}
      >
        <View style={styles.fundo}>
          <View accessibilityViewIsModal style={styles.dialogo}>
            <Text style={styles.nome}>Selecione a UF</Text>
            <ScrollView style={styles.listaUf} contentContainerStyle={styles.gradeUf}>
              {["", ...UFS].map((uf) => (
                <Pressable
                  key={uf || "nenhuma"}
                  accessibilityRole="button"
                  accessibilityState={{ selected: campos.uf === uf }}
                  onPress={() => {
                    atualizar("uf", uf);
                    setUfAberta(false);
                  }}
                  style={[styles.uf, campos.uf === uf && styles.filtroAtivo]}
                >
                  <Text style={[styles.textoFiltro, campos.uf === uf && styles.textoFiltroAtivo]}>
                    {uf || "Sem UF"}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              accessibilityRole="button"
              style={styles.secundario}
              onPress={() => setUfAberta(false)}
            >
              <Text style={styles.textoSecundario}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={Boolean(excluir)}
        animationType="fade"
        onRequestClose={() => {
          if (!ocupado.current) setExcluir(null);
        }}
      >
        <View style={styles.fundo}>
          <View accessibilityViewIsModal style={styles.dialogo}>
            <Text style={styles.nome}>Excluir talhão?</Text>
            <Text style={styles.detalhe}>
              {excluir?.codigo} — {excluir?.nome}
            </Text>
            <Text style={styles.ajuda}>
              O cadastro será removido. Se houver análises vinculadas, a exclusão será bloqueada;
              nesse caso, altere a situação para Inativo.
            </Text>
            {erroExclusao ? (
              <Text accessibilityRole="alert" style={styles.erro}>
                {erroExclusao}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: excluindo || !admin, busy: excluindo }}
              disabled={excluindo || !admin}
              onPress={confirmarExclusao}
              style={[styles.botao, styles.destrutivo]}
            >
              {excluindo ? <ActivityIndicator color="#FFFFFF" /> : null}
              <Text style={styles.textoBotao}>Excluir talhão</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={excluindo}
              onPress={() => setExcluir(null)}
              style={styles.secundario}
            >
              <Text style={styles.textoSecundario}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: "#F7F8F4" },
  flex: { flex: 1 },
  cabecalho: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    backgroundColor: "#1B5E20",
  },
  titulo: { flex: 1, color: "#FFFFFF", fontSize: 20, fontWeight: "700" },
  icone: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    borderCurve: "continuous",
  },
  topo: { padding: 16, gap: 12 },
  linhaBusca: { flexDirection: "row", gap: 8 },
  busca: {
    flex: 1,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#C3CDBF",
    borderRadius: 12,
    borderCurve: "continuous",
  },
  inputBusca: { flex: 1, minWidth: 0, paddingVertical: 12, color: "#1A1C19", fontSize: 14 },
  cadastro: {
    width: 52,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1B5E20",
    borderRadius: 12,
    borderCurve: "continuous",
  },
  filtros: { flexDirection: "row", gap: 8 },
  filtro: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#C3CDBF",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderCurve: "continuous",
  },
  filtroAtivo: { backgroundColor: "#E4F4DE", borderColor: "#1B5E20" },
  textoFiltro: { color: "#596155", fontSize: 14 },
  textoFiltroAtivo: { color: "#1B5E20", fontWeight: "700" },
  lista: { paddingHorizontal: 16, paddingBottom: 28, gap: 10 },
  registro: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0E5DC",
    borderRadius: 16,
    borderCurve: "continuous",
  },
  dadosRegistro: { flex: 1, gap: 4 },
  codigo: { color: "#1B5E20", fontSize: 13, fontWeight: "700" },
  nome: { color: "#1A1C19", fontSize: 18, fontWeight: "700" },
  detalhe: { color: "#1A1C19", fontSize: 15, lineHeight: 22 },
  ajuda: { color: "#596155", fontSize: 13, lineHeight: 20 },
  ativo: { color: "#1B5E20", fontSize: 13, fontWeight: "600" },
  sucesso: { color: "#1B5E20", backgroundColor: "#E4F4DE", padding: 12, fontSize: 14 },
  estado: { paddingVertical: 32, gap: 12, alignItems: "center" },
  fundo: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: "rgba(0,0,0,0.45)" },
  dialogo: {
    maxHeight: "90%",
    padding: 20,
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderCurve: "continuous",
  },
  acao: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderCurve: "continuous",
  },
  textoAcao: { flex: 1, color: "#1A1C19", fontSize: 16 },
  desativado: { backgroundColor: "#E9EDE5", borderColor: "#D1D8CC" },
  textoDesativado: { color: "#596155" },
  formulario: { padding: 20, gap: 18, paddingBottom: 40 },
  grupo: { gap: 6 },
  label: { color: "#1A1C19", fontSize: 14, fontWeight: "600" },
  campo: {
    minHeight: 52,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#C3CDBF",
    borderRadius: 12,
    borderCurve: "continuous",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#1A1C19",
    fontSize: 16,
  },
  campoBloqueado: { backgroundColor: "#ECEFE8", color: "#41493E" },
  campoErro: { borderColor: "#BA1A1A" },
  selecao: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#C3CDBF",
    borderRadius: 12,
    borderCurve: "continuous",
  },
  erro: { color: "#A01818", fontSize: 14, lineHeight: 21 },
  aviso: {
    color: "#5B4500",
    backgroundColor: "#FFF3C4",
    padding: 12,
    fontSize: 14,
    lineHeight: 21,
  },
  botao: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
    backgroundColor: "#1B5E20",
    borderRadius: 12,
    borderCurve: "continuous",
  },
  textoBotao: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  secundario: { minHeight: 48, alignItems: "center", justifyContent: "center", padding: 10 },
  textoSecundario: { color: "#1B5E20", fontSize: 15, fontWeight: "600" },
  destrutivo: { backgroundColor: "#BA1A1A" },
  metadados: { paddingTop: 12, borderTopWidth: 1, borderColor: "#DDE5D8", gap: 5 },
  listaUf: { maxHeight: 390 },
  gradeUf: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  uf: {
    width: "22%",
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#C3CDBF",
    borderRadius: 10,
    borderCurve: "continuous",
  },
});

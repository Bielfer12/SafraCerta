import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { sendPasswordResetEmail } from "firebase/auth";
import { useSessao } from "../context/Sessao";
import { autenticacao } from "../services/firebase";
import { executarOperacaoUsuarios, listarUsuarios, novaOperacaoCadastro } from "../services/usuarios";
import { normalizarMatricula } from "../services/autenticacao";

const camposVazios = {
  nomeCompleto: "",
  matricula: "",
  emailInstitucional: "",
  telefone: "",
  tipoUsuario: "FUNCIONARIO",
};

function Campo({ titulo, erro, ajuda, bloqueado, ...props }) {
  return (
    <View style={styles.grupoCampo}>
      <Text style={styles.label}>{titulo}</Text>
      <TextInput
        {...props}
        accessibilityLabel={titulo}
        editable={!bloqueado}
        style={[styles.campo, bloqueado && styles.campoBloqueado, erro && styles.campoErro]}
        placeholderTextColor="#596155"
      />
      {ajuda ? <Text style={styles.ajuda}>{ajuda}</Text> : null}
      {erro ? (
        <Text accessibilityRole="alert" style={styles.erroCampo}>
          {erro}
        </Text>
      ) : null}
    </View>
  );
}

function Dialogo({
  visivel,
  titulo,
  children,
  ocupado,
  confirmar,
  cancelar,
  textoConfirmar,
  destrutivo = false,
}) {
  return (
    <Modal
      transparent
      visible={visivel}
      animationType="none"
      onRequestClose={() => {
        if (!ocupado) cancelar();
      }}
    >
      <View style={styles.fundoDialogo}>
        <View accessibilityViewIsModal style={styles.dialogo}>
          <ScrollView style={styles.rolagemDialogo} contentContainerStyle={styles.conteudoDialogo}>
            <Text accessibilityRole="header" style={styles.tituloDialogo}>
              {titulo}
            </Text>
            {children}
            <Pressable
              accessibilityRole="button"
              disabled={ocupado}
              onPress={confirmar}
              style={[styles.botao, destrutivo && styles.botaoDestrutivo, ocupado && styles.desativado]}
            >
              {ocupado ? <ActivityIndicator color="#FFFFFF" /> : null}
              <Text style={styles.textoBotao}>{textoConfirmar}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={ocupado}
              onPress={cancelar}
              style={styles.botaoSecundario}
            >
              <Text style={styles.textoSecundario}>Cancelar</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function Usuarios() {
  const { usuario, admin } = useSessao();
  const [usuarios, setUsuarios] = useState([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState("");
  const [acoes, setAcoes] = useState(null);
  const [excluir, setExcluir] = useState(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState("");
  const [formulario, setFormulario] = useState(null);
  const [campos, setCampos] = useState(camposVazios);
  const [originais, setOriginais] = useState(camposVazios);
  const [erros, setErros] = useState({});
  const [erroForm, setErroForm] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [travado, setTravado] = useState(false);
  const [descartar, setDescartar] = useState(false);
  const [sucesso, setSucesso] = useState(null);
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const requisicao = useRef(0);
  const botoesAcoes = useRef({});
  const somenteLeitura = formulario?.modo === "visualizar";
  const cadastro = formulario?.modo === "cadastrar";

  const termoBusca = busca.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const usuariosFiltrados = usuarios.filter((pessoa) =>
    [pessoa.nomeCompleto, pessoa.matricula].some((valor) =>
      valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(termoBusca),
    ),
  );

  const consultar = useCallback(
    () => {
      const atual = ++requisicao.current;
      return listarUsuarios()
        .then((resposta) => {
          if (atual !== requisicao.current) return;
          setUsuarios(resposta);
        })
        .catch((erro) => {
          if (atual === requisicao.current) setErroLista(erro.message);
        })
        .finally(() => {
          if (atual === requisicao.current) {
            setCarregando(false);
          }
        });
    },
    [],
  );

  const carregar = () => {
    setCarregando(true);
    setUsuarios([]);
    setErroLista("");
    return consultar();
  };

  useEffect(() => {
    if (admin) consultar();
    return () => {
      requisicao.current += 1;
    };
  }, [admin, consultar]);

  const fecharAcoes = (devolverFoco = true) => {
    const uid = acoes?.uid;
    setAcoes(null);
    if (uid && devolverFoco === true) setTimeout(() => botoesAcoes.current[uid]?.focus?.(), 0);
  };

  const abrirFormulario = (modo, pessoa = null) => {
    fecharAcoes(false);
    const valores = pessoa
      ? {
          nomeCompleto: pessoa.nomeCompleto,
          matricula: pessoa.matricula,
          emailInstitucional: pessoa.emailInstitucional,
          telefone: pessoa.telefone,
          tipoUsuario: pessoa.tipoUsuario,
        }
      : { ...camposVazios };
    setCampos(valores);
    setOriginais(valores);
    setErros({});
    setErroForm("");
    setTravado(Boolean(pessoa?.cadastroPendente));
    setFormulario({ modo, pessoa, operacaoId: pessoa?.cadastroId || novaOperacaoCadastro() });
    setSucesso(null);
  };

  const fecharFormulario = () => {
    if (salvando) return;
    if (!somenteLeitura && JSON.stringify(campos) !== JSON.stringify(originais)) setDescartar(true);
    else {
      setFormulario(null);
      if (travado) carregar();
    }
  };

  const atualizar = (nome, valor) => {
    setCampos((anteriores) => ({ ...anteriores, [nome]: valor }));
    setErros((anteriores) => ({ ...anteriores, [nome]: "" }));
  };

  const salvar = async () => {
    if (salvando || !admin) return;
    const dados = {
      ...campos,
      nomeCompleto: campos.nomeCompleto.trim(),
      matricula: normalizarMatricula(campos.matricula),
      emailInstitucional: campos.emailInstitucional.trim().toLowerCase(),
      telefone: campos.telefone.trim(),
    };
    const invalidos = {};
    if (dados.nomeCompleto.length < 2) invalidos.nomeCompleto = "Informe o nome completo.";
    if (!dados.matricula || /[/\\]/.test(dados.matricula) || /^\.{1,2}$/.test(dados.matricula))
      invalidos.matricula = "Informe uma matrícula válida, sem barras.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.emailInstitucional))
      invalidos.emailInstitucional = "Informe um e-mail válido.";
    if (dados.telefone && !/^[\d\s()+.-]{8,30}$/.test(dados.telefone))
      invalidos.telefone = "Confira o telefone informado.";
    if (!["ADMIN", "FUNCIONARIO"].includes(dados.tipoUsuario))
      invalidos.tipoUsuario = "Selecione Funcionário ou Admin.";
    setErros(invalidos);
    if (Object.keys(invalidos).length) return;
    setSalvando(true);
    setErroForm("");
    if (cadastro) setTravado(true);
    try {
      await executarOperacaoUsuarios(cadastro ? "cadastrarUsuario" : "alterarUsuario", {
        ...dados,
        operacaoId: formulario.operacaoId,
        uid: formulario.pessoa?.uid,
        versao: formulario.pessoa?.versao,
        originais: formulario.pessoa?.originais,
      });
      setFormulario(null);
      setSucesso({
        texto: cadastro
          ? "Usuário cadastrado. Envie as instruções para que ele defina a senha de acesso."
          : "Alterações salvas.",
        email: cadastro ? dados.emailInstitucional : null,
      });
      carregar();
    } catch (erro) {
      setErroForm(erro.message);
      setErros(erro.campos || {});
      if (["functions/invalid-argument", "functions/already-exists"].includes(erro.code)) setTravado(false);
    } finally {
      setSalvando(false);
    }
  };

  const confirmarExclusao = async () => {
    if (excluindo || !admin) return;
    setExcluindo(true);
    setErroExclusao("");
    try {
      await executarOperacaoUsuarios("excluirUsuario", { uid: excluir.uid, versao: excluir.versao, originais: excluir.originais });
      setExcluir(null);
      setSucesso({ texto: "Usuário excluído." });
      carregar();
    } catch (erro) {
      setErroExclusao(erro.message);
    } finally {
      setExcluindo(false);
    }
  };

  const enviarInstrucoes = async () => {
    if (enviandoEmail || !sucesso?.email) return;
    setEnviandoEmail(true);
    try {
      await sendPasswordResetEmail(autenticacao, sucesso.email);
      setSucesso({ texto: "Instruções enviadas. O usuário poderá definir sua senha pelo e-mail." });
    } catch {
      setSucesso((anterior) => ({
        ...anterior,
        texto:
          "A conta foi criada, mas não foi possível enviar o e-mail. Tente novamente ou peça ao usuário para usar Esqueceu a senha no login.",
      }));
    } finally {
      setEnviandoEmail(false);
    }
  };

  if (!admin) return null;

  return (
    <SafeAreaView style={styles.tela}>
      <StatusBar style="dark" />
      <View style={styles.cabecalho}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar para Home"
          onPress={() => router.replace("/home")}
          style={styles.botaoIcone}
        >
          <Ionicons name="arrow-back" size={25} color="#FFFFFF" />
        </Pressable>
        <Text accessibilityRole="header" style={styles.tituloCabecalho}>
          Usuários
        </Text>
        <Ionicons name="people-outline" size={25} color="#FFFFFF" />
      </View>

      <View style={styles.topoLista}>
        <View style={styles.busca}>
          <Ionicons name="search-outline" size={21} color="#596155" />
          <TextInput
            accessibilityLabel="Buscar por nome ou matrícula"
            placeholder="Buscar por nome ou matrícula"
            placeholderTextColor="#596155"
            style={styles.campoBusca}
            value={busca}
            onChangeText={setBusca}
            autoCorrect={false}
            returnKeyType="search"
          />
          {busca ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Limpar pesquisa"
              style={styles.botaoIcone}
              onPress={() => setBusca("")}
            >
              <Ionicons name="close" size={21} color="#596155" />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cadastrar usuário"
          onPress={() => abrirFormulario("cadastrar")}
          style={[styles.botao, styles.botaoCadastro]}
        >
          <Ionicons name="person-add-outline" size={21} color="#FFFFFF" />
        </Pressable>
      </View>

      {sucesso ? (
        <View accessibilityLiveRegion="polite" style={styles.sucesso}>
          <Text style={styles.textoSucesso}>{sucesso.texto}</Text>
          {sucesso.email ? (
            <Pressable
              accessibilityRole="button"
              disabled={enviandoEmail}
              onPress={enviarInstrucoes}
              style={styles.botaoSecundario}
            >
              <Text style={styles.textoSecundario}>
                {enviandoEmail ? "Enviando..." : "Enviar instruções de senha"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <FlatList
        data={usuariosFiltrados}
        keyExtractor={(item) => item.uid}
        contentContainerStyle={styles.conteudoLista}
        keyboardShouldPersistTaps="handled"
        refreshing={carregando}
        onRefresh={() => carregar()}
        renderItem={({ item }) => (
          <View style={styles.linhaUsuario}>
            <View style={styles.avatar}>
              <Text style={styles.inicial}>{item.nomeCompleto.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.dadosUsuario}>
              <Text style={styles.nomeUsuario}>{item.nomeCompleto}</Text>
              <Text style={styles.matricula}>Matrícula {item.matricula}</Text>
              <Text style={styles.tipo}>
                {item.tipoUsuario === "ADMIN"
                  ? "Admin"
                  : item.tipoUsuario === "FUNCIONARIO"
                    ? "Funcionário"
                    : "Perfil não reconhecido"}
                {item.uid === usuario.uid ? " (você)" : ""}
              </Text>
              {item.cadastroPendente || item.exclusaoPendente ? (
                <Text style={styles.pendente}>
                  {item.cadastroPendente ? "Cadastro pendente" : "Exclusão pendente"}
                </Text>
              ) : null}
            </View>
            <Pressable
              ref={(elemento) => {
                botoesAcoes.current[item.uid] = elemento;
              }}
              accessibilityRole="button"
              accessibilityLabel={`Ações de ${item.nomeCompleto}`}
              style={styles.botaoIcone}
              onPress={() => {
                setAcoes(item);
                setSucesso(null);
              }}
            >
              <Ionicons name="ellipsis-vertical" size={23} color="#1B5E20" />
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          carregando ? (
            <View style={styles.estado}>
              <ActivityIndicator size="large" color="#1B5E20" />
              <Text style={styles.ajuda}>Carregando usuários...</Text>
            </View>
          ) : !erroLista ? (
            <View style={styles.estado}>
              <Ionicons name="people-outline" size={40} color="#596155" />
              <Text style={styles.tituloVazio}>
                {termoBusca ? "Nenhum usuário encontrado" : "Nenhum usuário cadastrado"}
              </Text>
              <Text style={styles.descricaoVazio}>
                {termoBusca
                  ? "Confira o nome ou a matrícula e tente outra pesquisa."
                  : "Use Cadastrar usuário para adicionar o primeiro acesso."}
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          <View style={styles.rodapeLista}>
            {erroLista ? (
              <View accessibilityRole="alert" style={styles.avisoErro}>
                <Text style={styles.erroCampo}>{erroLista}</Text>
                <Pressable
                  accessibilityRole="button"
                  style={styles.botaoSecundario}
                  onPress={carregar}
                >
                  <Text style={styles.textoSecundario}>Tentar novamente</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        }
      />

      <Modal transparent visible={Boolean(acoes)} animationType="none" onRequestClose={fecharAcoes}>
        <View style={styles.fundoMenu}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar menu de ações"
            style={StyleSheet.absoluteFill}
            onPress={() => fecharAcoes()}
          />
          <View accessibilityViewIsModal style={styles.menuAcoes}>
            <ScrollView style={styles.rolagemDialogo} contentContainerStyle={styles.conteudoMenu}>
              <Text style={styles.tituloDialogo}>{acoes?.nomeCompleto}</Text>
              <Text style={styles.ajuda}>Matrícula {acoes?.matricula}</Text>
              <Pressable
                accessibilityRole="button"
                style={styles.acao}
                onPress={() => abrirFormulario("visualizar", acoes)}
              >
                <Ionicons name="eye-outline" size={23} color="#1B5E20" />
                <Text style={styles.textoAcao}>Visualizar</Text>
              </Pressable>
              {acoes?.cadastroPendente ? (
                <Pressable
                  accessibilityRole="button"
                  style={styles.acao}
                  onPress={() => abrirFormulario("cadastrar", acoes)}
                >
                  <Ionicons name="refresh-outline" size={23} color="#1B5E20" />
                  <Text style={styles.textoAcao}>Concluir cadastro</Text>
                </Pressable>
              ) : !acoes?.exclusaoPendente ? (
                <Pressable
                  accessibilityRole="button"
                  style={styles.acao}
                  onPress={() => abrirFormulario("alterar", acoes)}
                >
                  <Ionicons name="create-outline" size={23} color="#1B5E20" />
                  <Text style={styles.textoAcao}>Alterar</Text>
                </Pressable>
              ) : null}
              {!acoes?.cadastroPendente ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={acoes?.uid === usuario.uid}
                  style={[styles.acao, acoes?.uid === usuario.uid && styles.desativado]}
                  onPress={() => {
                    setExcluir(acoes);
                    setErroExclusao("");
                    fecharAcoes(false);
                  }}
                >
                  <Ionicons name="trash-outline" size={23} color="#BA1A1A" />
                  <Text style={styles.textoExcluir}>
                    {acoes?.exclusaoPendente ? "Concluir exclusão" : "Excluir"}
                  </Text>
                </Pressable>
              ) : null}
              {acoes?.uid === usuario.uid ? (
                <Text style={styles.ajuda}>A exclusão da própria conta está bloqueada.</Text>
              ) : null}
              <Pressable accessibilityRole="button" style={styles.botaoSecundario} onPress={fecharAcoes}>
                <Text style={styles.textoSecundario}>Cancelar</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(formulario)} animationType="none" onRequestClose={fecharFormulario}>
        <SafeAreaView style={styles.tela}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
            <View style={styles.cabecalho}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fechar cadastro de usuário"
                disabled={salvando}
                onPress={fecharFormulario}
                style={styles.botaoIcone}
              >
                <Ionicons name="arrow-back" size={25} color="#FFFFFF" />
              </Pressable>
              <Text accessibilityRole="header" style={styles.tituloCabecalho}>
                {somenteLeitura ? "Visualizar usuário" : cadastro ? "Cadastrar usuário" : "Alterar usuário"}
              </Text>
            </View>
            <ScrollView
              contentContainerStyle={styles.formulario}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <Text style={styles.descricao}>
                {somenteLeitura ? "Dados de acesso e contato." : "Os campos com * são obrigatórios."}
              </Text>
              {travado && cadastro ? (
                <Text style={styles.aviso}>
                  Retome o cadastro com os dados originais. A conclusão verifica a conta e o perfil antes de
                  confirmar.
                </Text>
              ) : null}
              <Campo
                titulo={somenteLeitura ? "Nome completo" : "Nome completo *"}
                value={campos.nomeCompleto}
                onChangeText={(valor) => atualizar("nomeCompleto", valor)}
                bloqueado={somenteLeitura || travado || salvando}
                erro={erros.nomeCompleto}
                maxLength={150}
                autoCapitalize="words"
                autoComplete="name"
              />
              <Campo
                titulo={somenteLeitura ? "Matrícula" : "Matrícula *"}
                value={campos.matricula}
                onChangeText={(valor) => atualizar("matricula", valor)}
                bloqueado={somenteLeitura || !cadastro || travado || salvando}
                erro={erros.matricula}
                maxLength={64}
                autoCapitalize="none"
                autoCorrect={false}
                ajuda={
                  !cadastro && !somenteLeitura ? "A matrícula não pode ser alterada após o cadastro." : null
                }
              />
              <Campo
                titulo={somenteLeitura ? "E-mail de acesso" : "E-mail de acesso *"}
                value={campos.emailInstitucional}
                onChangeText={(valor) => atualizar("emailInstitucional", valor)}
                bloqueado={somenteLeitura || !cadastro || travado || salvando}
                erro={erros.emailInstitucional}
                maxLength={254}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                ajuda={
                  !somenteLeitura
                    ? cadastro
                      ? "O usuário usará este e-mail para definir e recuperar a senha."
                      : "O e-mail de acesso é preservado nesta edição."
                    : null
                }
              />
              <Campo
                titulo="Telefone"
                value={campos.telefone}
                onChangeText={(valor) => atualizar("telefone", valor)}
                bloqueado={somenteLeitura || travado || salvando}
                erro={erros.telefone}
                maxLength={30}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
              <Text style={styles.label}>{somenteLeitura ? "Tipo de usuário" : "Tipo de usuário *"}</Text>
              {somenteLeitura ? (
                <Text style={styles.valorLeitura}>
                  {campos.tipoUsuario === "ADMIN"
                    ? "Admin"
                    : campos.tipoUsuario === "FUNCIONARIO"
                      ? "Funcionário"
                      : campos.tipoUsuario}
                </Text>
              ) : (
                <View accessibilityRole="radiogroup" style={styles.seletorTipo}>
                  {[
                    { valor: "FUNCIONARIO", texto: "Funcionário" },
                    { valor: "ADMIN", texto: "Admin" },
                  ].map((opcao) => (
                    <Pressable
                      key={opcao.valor}
                      accessibilityRole="radio"
                      accessibilityState={{
                        checked: campos.tipoUsuario === opcao.valor,
                        disabled: travado || salvando,
                      }}
                      disabled={travado || salvando}
                      onPress={() => atualizar("tipoUsuario", opcao.valor)}
                      style={[
                        styles.opcaoTipo,
                        campos.tipoUsuario === opcao.valor && styles.opcaoSelecionada,
                      ]}
                    >
                      <Ionicons
                        name={campos.tipoUsuario === opcao.valor ? "radio-button-on" : "radio-button-off"}
                        size={22}
                        color="#1B5E20"
                      />
                      <Text style={styles.textoAcao}>{opcao.texto}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {erros.tipoUsuario ? <Text style={styles.erroCampo}>{erros.tipoUsuario}</Text> : null}
              {somenteLeitura ? (
                <>
                  <Text style={styles.label}>Situação da conta</Text>
                  <Text style={styles.valorLeitura}>
                    {formulario?.pessoa?.cadastroPendente
                      ? "Cadastro pendente"
                      : formulario?.pessoa?.exclusaoPendente
                        ? "Exclusão pendente"
                        : formulario?.pessoa?.statusConta === "ATIVO"
                          ? "Ativa"
                          : "Desativada"}
                  </Text>
                </>
              ) : null}
              {!somenteLeitura && campos.tipoUsuario === "ADMIN" ? (
                <Text style={styles.aviso}>
                  Administradores podem gerenciar os acessos de outras pessoas.
                </Text>
              ) : null}
              {erroForm ? (
                <View accessibilityRole="alert" style={styles.avisoErro}>
                  <Text style={styles.erroCampo}>{erroForm}</Text>
                </View>
              ) : null}
              {!somenteLeitura ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={salvando}
                  onPress={salvar}
                  style={[styles.botao, styles.salvar, salvando && styles.desativado]}
                >
                  {salvando ? <ActivityIndicator color="#FFFFFF" /> : null}
                  <Text style={styles.textoBotao}>
                    {salvando
                      ? "Salvando..."
                      : cadastro
                        ? travado
                          ? "Concluir cadastro"
                          : "Cadastrar usuário"
                        : "Salvar alterações"}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                disabled={salvando}
                onPress={fecharFormulario}
                style={styles.botaoSecundario}
              >
                <Text style={styles.textoSecundario}>{somenteLeitura ? "Fechar" : "Cancelar"}</Text>
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
        <Dialogo
          visivel={descartar}
          titulo="Descartar alterações?"
          cancelar={() => setDescartar(false)}
          confirmar={() => {
            setDescartar(false);
            setFormulario(null);
            if (travado) carregar();
          }}
          textoConfirmar="Descartar alterações"
          destrutivo
        >
          <Text style={styles.descricaoVazio}>
            As alterações não salvas neste formulário serão descartadas. Operações que já chegaram ao serviço
            podem aparecer como pendentes na lista.
          </Text>
        </Dialogo>
      </Modal>

      <Dialogo
        visivel={Boolean(excluir)}
        titulo={excluir?.exclusaoPendente ? "Concluir exclusão?" : "Excluir usuário?"}
        ocupado={excluindo}
        cancelar={() => {
          setExcluir(null);
          carregar();
        }}
        confirmar={confirmarExclusao}
        textoConfirmar={excluindo ? "Excluindo..." : "Excluir"}
        destrutivo
      >
        <Text style={styles.nomeUsuario}>{excluir?.nomeCompleto}</Text>
        <Text style={styles.ajuda}>Matrícula {excluir?.matricula}</Text>
        <Text style={styles.descricaoVazio}>
          A conta de acesso e o cadastro serão excluídos. Esta ação não pode ser desfeita.
        </Text>
        {erroExclusao ? (
          <Text accessibilityRole="alert" style={styles.erroCampo}>
            {erroExclusao}
          </Text>
        ) : null}
      </Dialogo>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tela: { flex: 1, backgroundColor: "#F7F8F4" },
  cabecalho: {
    minHeight: 68,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#1B5E20",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tituloCabecalho: { flex: 1, color: "#FFFFFF", fontSize: 24, fontWeight: "700" },
  botaoIcone: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  topoLista: { padding: 20, flexDirection: "row", alignItems: "center", gap: 12 },
  descricao: { color: "#596155", fontSize: 16, lineHeight: 24 },
  botao: {
    minHeight: 52,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1B5E20",
  },
  textoBotao: { color: "#FFFFFF", fontSize: 16, fontWeight: "700", textAlign: "center", flexShrink: 1 },
  botaoCadastro: { width: 52, paddingHorizontal: 0, paddingVertical: 0 },
  botaoSecundario: {
    minHeight: 48,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  textoSecundario: { color: "#1B5E20", fontSize: 16, fontWeight: "600", textAlign: "center" },
  busca: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ADB8A7",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 14,
    gap: 10,
  },
  campoBusca: {
    flex: 1,
    minWidth: 0,
    minHeight: 50,
    color: "#1A1C19",
    fontSize: 16,
    paddingVertical: 10,
    paddingRight: 12,
  },
  conteudoLista: { paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1 },
  linhaUsuario: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    paddingLeft: 12,
    paddingRight: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#DCE3D8",
    backgroundColor: "#FFFFFF",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E4F4DE",
    alignItems: "center",
    justifyContent: "center",
  },
  inicial: { color: "#1B5E20", fontSize: 18, fontWeight: "700" },
  dadosUsuario: { flex: 1, gap: 4 },
  nomeUsuario: { color: "#1A1C19", fontSize: 16, lineHeight: 23, fontWeight: "700" },
  matricula: { color: "#596155", fontSize: 14, lineHeight: 21 },
  tipo: { color: "#1B5E20", fontSize: 14, lineHeight: 21, fontWeight: "600" },
  pendente: { color: "#BA1A1A", fontSize: 14, lineHeight: 21 },
  estado: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 12,
    gap: 12,
  },
  tituloVazio: { fontSize: 18, color: "#1A1C19", fontWeight: "600", textAlign: "center" },
  descricaoVazio: { fontSize: 16, color: "#596155", lineHeight: 24, marginVertical: 12 },
  rodapeLista: { paddingTop: 16 },
  sucesso: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#1B5E20",
    backgroundColor: "#E4F4DE",
    gap: 4,
  },
  textoSucesso: { color: "#1B5E20", fontSize: 16, lineHeight: 24 },
  fundoMenu: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.42)" },
  menuAcoes: {
    backgroundColor: "#FFFFFF",
    maxHeight: "90%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  conteudoMenu: { padding: 24, paddingBottom: 36, gap: 4 },
  tituloDialogo: { color: "#1A1C19", fontSize: 22, fontWeight: "700", marginBottom: 8 },
  acao: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 12 },
  textoAcao: { fontSize: 16, color: "#1A1C19", flexShrink: 1 },
  textoExcluir: { fontSize: 16, color: "#BA1A1A", fontWeight: "600" },
  fundoDialogo: { flex: 1, padding: 24, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.42)" },
  dialogo: {
    width: "100%",
    maxWidth: 440,
    maxHeight: "100%",
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
  },
  rolagemDialogo: { flexGrow: 0 },
  conteudoDialogo: { padding: 24, gap: 8 },
  botaoDestrutivo: { backgroundColor: "#BA1A1A" },
  desativado: { opacity: 0.5 },
  formulario: { padding: 24, gap: 20, paddingBottom: 48, maxWidth: 640, width: "100%", alignSelf: "center" },
  grupoCampo: { gap: 8 },
  label: { color: "#1A1C19", fontSize: 16, fontWeight: "600" },
  campo: {
    minHeight: 52,
    color: "#1A1C19",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ADB8A7",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  campoBloqueado: { backgroundColor: "#EDF0E9", color: "#41493E" },
  campoErro: { borderColor: "#BA1A1A", borderWidth: 2 },
  ajuda: { color: "#596155", fontSize: 14, lineHeight: 21 },
  erroCampo: { color: "#BA1A1A", fontSize: 14, lineHeight: 22 },
  avisoErro: { padding: 16, backgroundColor: "#FFEEEC", borderRadius: 8, gap: 8 },
  aviso: {
    color: "#41493E",
    fontSize: 14,
    lineHeight: 22,
    backgroundColor: "#E4F4DE",
    padding: 16,
    borderRadius: 8,
  },
  seletorTipo: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  opcaoTipo: {
    minHeight: 52,
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#ADB8A7",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
  },
  opcaoSelecionada: { borderColor: "#1B5E20", backgroundColor: "#E4F4DE" },
  valorLeitura: { color: "#1A1C19", fontSize: 16, lineHeight: 24 },
  salvar: { marginTop: 8 },
});

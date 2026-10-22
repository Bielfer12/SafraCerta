const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");
const { transpileModule, ModuleKind, JsxEmit } = require("typescript");

const codigo = transpileModule(readFileSync("src/context/Sessao.js", "utf8"), {
  fileName: "Sessao.jsx",
  compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX, allowJs: true },
}).outputText;

function montarSessao() {
  const estados = [];
  let indice = 0;
  let efeito;
  let iniciou = false;
  let receberConta;
  let receberPerfil;
  let mudarEstado;
  let consulta;
  const autenticacao = { currentUser: null };
  const react = {
    createContext: () => ({ Provider: "Provider" }),
    useState: (inicial) => {
      const posicao = indice++;
      if (!(posicao in estados)) estados[posicao] = inicial;
      return [estados[posicao], (valor) => { estados[posicao] = valor; }];
    },
    useEffect: (executar) => { efeito = executar; },
  };
  const modulos = {
    react,
    "react/jsx-runtime": { jsx: (_, propriedades) => propriedades.value },
    "react-native": {
      AppState: { addEventListener: (_, callback) => { mudarEstado = callback; return { remove() {} }; } },
    },
    "firebase/auth": {
      onAuthStateChanged: (_, callback) => { receberConta = callback; return () => {}; },
      signOut: async () => { autenticacao.currentUser = null; receberConta(null); },
    },
    "firebase/firestore": {
      doc: (_, colecao, uid) => ({ colecao, uid }),
      onSnapshot: (_, opcoes, callback) => { receberPerfil = callback; return () => {}; },
      getDocFromServer: () => consulta(),
    },
    "../services/firebase": { autenticacao, banco: {} },
  };
  const exports = {};
  runInNewContext(codigo, { exports, require: (nome) => {
    assert.ok(modulos[nome], `Módulo inesperado: ${nome}`);
    return modulos[nome];
  } });
  const renderizar = () => {
    indice = 0;
    const valor = exports.SessaoProvider({ children: null });
    if (!iniciou) { iniciou = true; efeito(); }
    return valor;
  };
  renderizar();
  return {
    valor: renderizar,
    entrar: (uid = "admin-1") => {
      autenticacao.currentUser = { uid, reload: async () => {} };
      receberConta(autenticacao.currentUser);
    },
    perfil: (dados, fromCache = false) => receberPerfil({
      data: () => dados,
      metadata: { fromCache, hasPendingWrites: false },
    }),
    estado: (estado) => mudarEstado(estado),
    consultar: (executar) => { consulta = executar; },
  };
}

const perfilAtivo = (tipoUsuario = "ADMIN") => ({ tipoUsuario, statusConta: "ATIVO" });

for (const tipo of ["ADMIN", "FUNCIONARIO"]) {
  test(`${tipo} mantém Talhões ao sair e voltar com falha de conexão`, async () => {
    const sessao = montarSessao();
    sessao.entrar();
    sessao.perfil(perfilAtivo(tipo));
    assert.equal(sessao.valor().acessoTalhoes, true);
    await sessao.estado("background");
    assert.equal(sessao.valor().acessoTalhoes, true);
    sessao.perfil(perfilAtivo(tipo), true);
    assert.equal(sessao.valor().acessoTalhoes, true);
    sessao.consultar(async () => { throw { code: "unavailable" }; });
    await sessao.estado("active");
    assert.equal(sessao.valor().acessoTalhoes, true);
    assert.equal(sessao.valor().admin, tipo === "ADMIN");
  });
}

test("perfil inicial do cache não libera Talhões antes da confirmação do servidor", () => {
  const sessao = montarSessao();
  sessao.entrar();
  sessao.perfil(perfilAtivo(), true);
  assert.equal(sessao.valor().acessoTalhoes, false);
  assert.equal(sessao.valor().admin, false);
  sessao.perfil(perfilAtivo());
  assert.equal(sessao.valor().acessoTalhoes, true);
});

test("cache não troca o tipo confirmado pelo servidor", () => {
  const sessao = montarSessao();
  sessao.entrar();
  sessao.perfil(perfilAtivo("FUNCIONARIO"));
  sessao.perfil(perfilAtivo(), true);
  assert.equal(sessao.valor().acessoTalhoes, true);
  assert.equal(sessao.valor().admin, false);
  assert.equal(sessao.valor().perfil.tipoUsuario, "FUNCIONARIO");
});

test("mudança de Admin para Funcionário mantém Talhões e remove administração", () => {
  const sessao = montarSessao();
  sessao.entrar();
  sessao.perfil(perfilAtivo());
  sessao.perfil(perfilAtivo("FUNCIONARIO"));
  assert.equal(sessao.valor().acessoTalhoes, true);
  assert.equal(sessao.valor().admin, false);
});

test("conta inativa, removida ou pendente perde acesso", async () => {
  for (const dados of [undefined, { ...perfilAtivo(), statusConta: "INATIVO" }, { ...perfilAtivo(), cadastroPendente: true }, { ...perfilAtivo(), exclusaoPendente: true }]) {
    const sessao = montarSessao();
    sessao.entrar();
    sessao.perfil(perfilAtivo());
    sessao.consultar(async () => ({ data: () => dados }));
    await sessao.estado("active");
    assert.equal(sessao.valor().acessoTalhoes, false);
    assert.equal(sessao.valor().usuario, null);
  }
});

test("trocar de conta descarta a confirmação anterior e consultas atrasadas", async () => {
  const sessao = montarSessao();
  sessao.entrar();
  sessao.perfil(perfilAtivo());
  let concluir;
  sessao.consultar(() => new Promise((resolve) => { concluir = resolve; }));
  const retorno = sessao.estado("active");
  await new Promise(setImmediate);
  sessao.entrar("funcionario-2");
  concluir({ data: () => perfilAtivo() });
  await retorno;
  assert.equal(sessao.valor().acessoTalhoes, false);
  assert.equal(sessao.valor().admin, false);
  sessao.perfil(perfilAtivo("FUNCIONARIO"));
  assert.equal(sessao.valor().acessoTalhoes, true);
  assert.equal(sessao.valor().admin, false);
});

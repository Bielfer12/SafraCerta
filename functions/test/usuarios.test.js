const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { createHash } = require("node:crypto");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { initializeTestEnvironment, assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const { doc, getDoc, setDoc, updateDoc, getDocsFromServer, collection } = require("firebase/firestore");

const projeto = "demo-safracerta";
if (
  !process.env.FIRESTORE_EMULATOR_HOST ||
  !process.env.FIREBASE_AUTH_EMULATOR_HOST ||
  process.env.GCLOUD_PROJECT !== projeto
)
  throw new Error("Execute exclusivamente com npm run test:emulators e o projeto demo-safracerta.");
const app = initializeApp({ projectId: projeto });
const banco = getFirestore(app);
const auth = getAuth(app);
let regras;
let tokenAdmin;
let tokenFuncionario;

async function criarConta(uid, tipoUsuario = "ADMIN", statusConta = "ATIVO") {
  const email = `${uid}@teste.local`;
  await auth.createUser({ uid, email, password: "Teste-local-123!" });
  const perfil = {
    nomeCompleto: `Pessoa ${uid}`,
    matricula: uid,
    emailInstitucional: email,
    telefone: "",
    tipoUsuario,
    statusConta,
  };
  await banco.doc(`usuarios/${uid}`).set(perfil);
  await banco.doc(`login_por_matricula/${uid}`).set({ email, uid });
  const resposta = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=teste`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Teste-local-123!", returnSecureToken: true }),
    },
  );
  return (await resposta.json()).idToken;
}

async function chamar(nome, dados = {}, token = tokenAdmin) {
  const resposta = await fetch(`http://127.0.0.1:5001/${projeto}/southamerica-east1/${nome}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ data: dados }),
  });
  const corpo = await resposta.json();
  if (corpo.error) {
    const erro = new Error(corpo.error.message);
    erro.status = corpo.error.status;
    throw erro;
  }
  return corpo.result;
}

function novoCadastro(matricula = "00123", extras = {}) {
  return {
    nomeCompleto: "Maria da Silva",
    matricula,
    emailInstitucional: `${matricula}@teste.local`,
    telefone: "48999999999",
    tipoUsuario: "FUNCIONARIO",
    operacaoId: `cadastro-teste-${matricula}`,
    ...extras,
  };
}

async function perfil(uid) {
  const documento = await banco.doc(`usuarios/${uid}`).get();
  return {
    ...documento.data(),
    uid,
    versao: `${documento.updateTime.seconds}.${documento.updateTime.nanoseconds}`,
  };
}

before(async () => {
  regras = await initializeTestEnvironment({
    projectId: projeto,
    firestore: { rules: readFileSync("../firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});

beforeEach(async () => {
  await regras.clearFirestore();
  const contas = await auth.listUsers();
  if (contas.users.length) await auth.deleteUsers(contas.users.map((conta) => conta.uid));
  tokenAdmin = await criarConta("admin");
  tokenFuncionario = await criarConta("funcionario", "FUNCIONARIO");
});

after(async () => {
  await regras.cleanup();
  await deleteApp(app);
});

test("nega chamadas sem sessão, de funcionário, conta desativada e conta pendente", async () => {
  await assert.rejects(chamar("alterarUsuario", {}, null), { status: "UNAUTHENTICATED" });
  await assert.rejects(chamar("alterarUsuario", {}, tokenFuncionario), { status: "PERMISSION_DENIED" });
  await banco.doc("usuarios/admin").update({ statusConta: "INATIVO" });
  await assert.rejects(chamar("alterarUsuario"), { status: "PERMISSION_DENIED" });
  await banco.doc("usuarios/admin").update({ statusConta: "ATIVO", cadastroPendente: true });
  await assert.rejects(chamar("alterarUsuario"), { status: "PERMISSION_DENIED" });
});

test("nenhuma operação aceita funcionário ou conta Auth desabilitada", async () => {
  for (const nome of ["cadastrarUsuario", "alterarUsuario", "excluirUsuario"]) {
    await assert.rejects(chamar(nome, {}, tokenFuncionario), { status: "PERMISSION_DENIED" });
  }
  await auth.updateUser("admin", { disabled: true });
  await assert.rejects(chamar("alterarUsuario"), { status: "PERMISSION_DENIED" });
});

test("validação rejeita campos inválidos sem criar conta ou reserva", async () => {
  for (const alteracao of [
    { matricula: "../invalida" },
    { nomeCompleto: "" },
    { emailInstitucional: "invalido" },
    { tipoUsuario: "PROFESSOR" },
  ]) {
    await assert.rejects(chamar("cadastrarUsuario", novoCadastro("00123", alteracao)), {
      status: "INVALID_ARGUMENT",
    });
  }
  assert.equal((await auth.listUsers()).users.length, 2);
  assert.equal((await banco.collection("_operacoes_usuarios").get()).size, 0);
});

test("cadastro cria Auth, perfil e índice sem trocar a identidade de quem chamou", async () => {
  const dados = novoCadastro();
  const criado = await chamar("cadastrarUsuario", dados);
  const conta = await auth.getUser(criado.uid);
  assert.equal(conta.email, dados.emailInstitucional);
  assert.equal(conta.disabled, false);
  const registro = await perfil(criado.uid);
  assert.equal(registro.matricula, "00123");
  assert.equal(registro.statusConta, "ATIVO");
  assert.equal(registro.cadastroPendente, undefined);
  assert.equal((await banco.doc("login_por_matricula/00123").get()).data().uid, criado.uid);
  assert.equal((await auth.verifyIdToken(tokenAdmin)).uid, "admin");
  const administrador = regras.authenticatedContext("admin").firestore();
  const listagem = await getDocsFromServer(collection(administrador, "usuarios"));
  assert.ok(listagem.docs.some((item) => item.id === criado.uid));
  const envio = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=teste`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestType: "PASSWORD_RESET", email: dados.emailInstitucional }),
    },
  );
  assert.equal(envio.status, 200);
  const instrucoes = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${projeto}/oobCodes`,
  );
  const codigo = (await instrucoes.json()).oobCodes.find((item) => item.email === dados.emailInstitucional);
  assert.ok(codigo.oobCode);
  const redefinicao = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=teste`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oobCode: codigo.oobCode, newPassword: "Senha-inicial-123!" }),
    },
  );
  assert.equal(redefinicao.status, 200);
  const login = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=teste`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: dados.emailInstitucional,
        password: "Senha-inicial-123!",
        returnSecureToken: true,
      }),
    },
  );
  assert.equal((await login.json()).localId, criado.uid);
});

test("matrícula duplicada em dois cadastros simultâneos gera somente uma conta", async () => {
  const resultados = await Promise.allSettled([
    chamar("cadastrarUsuario", novoCadastro()),
    chamar(
      "cadastrarUsuario",
      novoCadastro("00123", { emailInstitucional: "outro@teste.local", operacaoId: "outra-operacao-123" }),
    ),
  ]);
  assert.equal(resultados.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal((await banco.collection("usuarios").where("matricula", "==", "00123").get()).size, 1);
  assert.equal((await auth.listUsers()).users.length, 3);
});

test("repetir a mesma operação simultaneamente ou após perder a resposta não duplica conta", async () => {
  const dados = novoCadastro();
  const [primeiro, segundo] = await Promise.all([
    chamar("cadastrarUsuario", dados),
    chamar("cadastrarUsuario", dados),
  ]);
  const terceiro = await chamar("cadastrarUsuario", dados);
  assert.equal(primeiro.uid, segundo.uid);
  assert.equal(primeiro.uid, terceiro.uid);
  assert.equal((await auth.listUsers()).users.length, 3);
});

test("e-mail já existente não deixa perfil nem matrícula reservada", async () => {
  await assert.rejects(
    chamar("cadastrarUsuario", novoCadastro("00123", { emailInstitucional: "funcionario@teste.local" })),
    { status: "ALREADY_EXISTS" },
  );
  assert.equal((await banco.doc("login_por_matricula/00123").get()).exists, false);
  assert.equal((await banco.collection("usuarios").where("matricula", "==", "00123").get()).size, 0);
});

test("retoma uma criação interrompida antes ou depois de criar a conta Auth", async () => {
  for (const comConta of [false, true]) {
    const dados = novoCadastro(comConta ? "00222" : "00333");
    const { operacaoId, ...cadastro } = dados;
    const uid = `pendente-${dados.matricula}`;
    await banco
      .doc(`_operacoes_usuarios/${operacaoId}`)
      .set({
        uid,
        concluida: false,
        assinatura: createHash("sha256").update(JSON.stringify(cadastro)).digest("hex"),
      });
    await banco
      .doc(`login_por_matricula/${cadastro.matricula}`)
      .set({ email: cadastro.emailInstitucional, uid, cadastroPendente: true, cadastroId: operacaoId });
    await banco
      .doc(`usuarios/${uid}`)
      .set({ ...cadastro, statusConta: "ATIVO", cadastroPendente: true, cadastroId: operacaoId });
    if (comConta) await auth.createUser({ uid, email: cadastro.emailInstitucional, disabled: true });
    const resultado = await chamar("cadastrarUsuario", dados);
    assert.equal(resultado.uid, uid);
    assert.equal((await auth.getUser(uid)).disabled, false);
    assert.equal((await perfil(uid)).cadastroPendente, undefined);
  }
});

test("alteração preserva matrícula, e-mail, status e campos fora do formulário", async () => {
  await banco.doc("usuarios/funcionario").update({ campoLegado: "preservar" });
  const atual = await perfil("funcionario");
  await assert.rejects(chamar("alterarUsuario", { ...atual, matricula: "99999" }), {
    status: "FAILED_PRECONDITION",
  });
  await assert.rejects(chamar("alterarUsuario", { ...atual, emailInstitucional: "novo@teste.local" }), {
    status: "FAILED_PRECONDITION",
  });
  await chamar("alterarUsuario", { ...atual, nomeCompleto: "Nome atualizado", tipoUsuario: "ADMIN" });
  const alterado = await perfil("funcionario");
  assert.equal(alterado.nomeCompleto, "Nome atualizado");
  assert.equal(alterado.campoLegado, "preservar");
  assert.equal(alterado.statusConta, "ATIVO");
  assert.equal(alterado.tipoUsuario, "ADMIN");
  await assert.rejects(chamar("alterarUsuario", { ...atual, nomeCompleto: "Sobrescrever" }), {
    status: "ABORTED",
  });
});

test("bloqueia rebaixamento do último admin e exclusão da própria conta", async () => {
  await assert.rejects(chamar("alterarUsuario", { ...(await perfil("admin")), tipoUsuario: "FUNCIONARIO" }), {
    status: "FAILED_PRECONDITION",
  });
  await assert.rejects(chamar("excluirUsuario", { ...(await perfil("admin")) }), {
    status: "FAILED_PRECONDITION",
  });
});

test("dois rebaixamentos simultâneos preservam um administrador ativo", async () => {
  const segundoToken = await criarConta("segundo");
  const resultados = await Promise.allSettled([
    chamar("alterarUsuario", { ...(await perfil("admin")), tipoUsuario: "FUNCIONARIO" }),
    chamar("alterarUsuario", { ...(await perfil("segundo")), tipoUsuario: "FUNCIONARIO" }, segundoToken),
  ]);
  assert.equal(resultados.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal((await banco.collection("usuarios").where("tipoUsuario", "==", "ADMIN").get()).size, 1);
});

test("exclusões concorrentes não removem os dois administradores", async () => {
  const segundoToken = await criarConta("segundo");
  const resultados = await Promise.allSettled([
    chamar("excluirUsuario", await perfil("segundo")),
    chamar("excluirUsuario", await perfil("admin"), segundoToken),
  ]);
  assert.equal(resultados.filter((item) => item.status === "fulfilled").length, 1);
  const administradores = await banco.collection("usuarios").where("tipoUsuario", "==", "ADMIN").get();
  assert.equal(administradores.size, 1);
  assert.equal(administradores.docs[0].data().exclusaoPendente, undefined);
});

test("exclusão remove Auth, perfil e índice e aceita repetição após perda de resposta", async () => {
  const dados = await perfil("funcionario");
  await chamar("excluirUsuario", dados);
  await assert.rejects(auth.getUser("funcionario"), { code: "auth/user-not-found" });
  assert.equal((await banco.doc("usuarios/funcionario").get()).exists, false);
  assert.equal((await banco.doc("login_por_matricula/funcionario").get()).exists, false);
  await chamar("excluirUsuario", dados);
});

test("recibo de cadastro não recria conta excluída nem informa novo sucesso", async () => {
  const cadastro = novoCadastro();
  const criado = await chamar("cadastrarUsuario", cadastro);
  await chamar("excluirUsuario", await perfil(criado.uid));
  await assert.rejects(chamar("cadastrarUsuario", cadastro), { status: "NOT_FOUND" });
  assert.equal((await banco.doc("login_por_matricula/00123").get()).exists, false);
});

test("retoma exclusão após conta Auth já removida e bloqueia vínculos e índice inconsistente", async () => {
  await banco.doc("usuarios/funcionario").update({ exclusaoPendente: true });
  await auth.deleteUser("funcionario");
  await chamar("excluirUsuario", await perfil("funcionario"));
  await criarConta("vinculado", "FUNCIONARIO");
  await banco.doc("usuarios/vinculado/historico/analise").set({ teste: true });
  await assert.rejects(chamar("excluirUsuario", await perfil("vinculado")), {
    status: "FAILED_PRECONDITION",
  });
  await banco.doc("usuarios/vinculado/historico/analise").delete();
  await banco.doc("login_por_matricula/vinculado").update({ uid: "outro" });
  await assert.rejects(chamar("excluirUsuario", await perfil("vinculado")), {
    status: "FAILED_PRECONDITION",
  });
  assert.equal((await auth.getUser("vinculado")).disabled, false);
});

test("consulta direta carrega também registros além da antiga primeira página e preserva nomes e matrículas", async () => {
  const lote = banco.batch();
  for (let numero = 0; numero < 130; numero += 1)
    lote.set(banco.doc(`usuarios/a${String(numero).padStart(3, "0")}`), {
      nomeCompleto: numero === 129 ? "João da Silva" : `Pessoa ${numero}`,
      matricula: String(numero).padStart(5, "0"),
      tipoUsuario: "FUNCIONARIO",
      statusConta: "ATIVO",
    });
  await lote.commit();
  const administrador = regras.authenticatedContext("admin").firestore();
  const registros = await getDocsFromServer(collection(administrador, "usuarios"));
  assert.equal(registros.size, 132);
  const ultimo = registros.docs.find((registro) => registro.id === "a129").data();
  assert.equal(ultimo.nomeCompleto, "João da Silva");
  assert.equal(ultimo.matricula, "00129");
});

test("regras impedem administração direta e preservam leitura e edição legítima do titular", async () => {
  const comum = regras.authenticatedContext("funcionario").firestore();
  const administrador = regras.authenticatedContext("admin").firestore();
  const anonimo = regras.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(anonimo, "login_por_matricula/funcionario")));
  await assertSucceeds(getDoc(doc(comum, "usuarios/funcionario")));
  await assertSucceeds(
    updateDoc(doc(comum, "usuarios/funcionario"), {
      nomeCompleto: "Contato atualizado",
      telefone: "48988887777",
    }),
  );
  await assertFails(updateDoc(doc(comum, "usuarios/funcionario"), { tipoUsuario: "ADMIN" }));
  await assertFails(updateDoc(doc(comum, "usuarios/funcionario"), { matricula: "9999" }));
  await assertFails(
    updateDoc(doc(comum, "usuarios/funcionario"), { emailInstitucional: "outro@teste.local" }),
  );
  await assertFails(getDocsFromServer(collection(comum, "usuarios")));
  await assertFails(getDocsFromServer(collection(anonimo, "usuarios")));
  await assertSucceeds(getDocsFromServer(collection(administrador, "usuarios")));
  await assertSucceeds(getDoc(doc(administrador, "usuarios/funcionario")));
  await assertFails(getDoc(doc(comum, "usuarios/admin")));
  await assertFails(setDoc(doc(administrador, "usuarios/novo"), { tipoUsuario: "ADMIN" }));
  await assertFails(getDoc(doc(anonimo, "usuarios/admin")));
  await assertFails(getDoc(doc(administrador, "_operacoes_usuarios/segredo")));
});

test("listagem direta perde autorização quando o perfil deixa de ser ADMIN ativo", async () => {
  const administrador = regras.authenticatedContext("admin").firestore();
  await assertSucceeds(getDocsFromServer(collection(administrador, "usuarios")));
  const referencia = banco.doc("usuarios/admin");
  const original = (await referencia.get()).data();
  for (const mudanca of [{ tipoUsuario: "FUNCIONARIO" }, { statusConta: "INATIVO" }, { cadastroPendente: true }, { exclusaoPendente: true }]) {
    await referencia.set({ ...original, ...mudanca });
    await assertFails(getDocsFromServer(collection(administrador, "usuarios")));
  }
  await referencia.delete();
  await assertFails(getDocsFromServer(collection(administrador, "usuarios")));
});

test("edição e exclusão aceitam dados da consulta direta e rejeitam alterações concorrentes", async () => {
  const administrador = regras.authenticatedContext("admin").firestore();
  const referencia = doc(administrador, "usuarios/funcionario");
  const documento = await getDoc(referencia);
  const originais = { ...documento.data(), cadastroPendente: null, exclusaoPendente: null };
  await chamar("alterarUsuario", { ...originais, uid: documento.id, nomeCompleto: "Maria atualizada", originais });
  await assert.rejects(chamar("alterarUsuario", { ...originais, uid: documento.id, nomeCompleto: "Sobrescrever", originais }), { status: "ABORTED" });
  await assert.rejects(chamar("excluirUsuario", { uid: documento.id, originais }), { status: "ABORTED" });
  const atualizado = await getDoc(referencia);
  await chamar("excluirUsuario", { uid: atualizado.id, originais: { ...atualizado.data(), cadastroPendente: null, exclusaoPendente: null } });
  assert.equal((await banco.doc("usuarios/funcionario").get()).exists, false);
});

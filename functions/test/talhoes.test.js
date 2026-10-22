const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { randomUUID } = require("node:crypto");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { initializeTestEnvironment, assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const { collection, doc, getDoc, getDocsFromServer, setDoc, updateDoc, deleteDoc, query, where } = require("firebase/firestore");

const projeto = "demo-safracerta";
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.GCLOUD_PROJECT !== projeto)
  throw new Error("Execute exclusivamente com npm run test:emulators e o projeto demo-safracerta.");
const app = initializeApp({ projectId: projeto });
const banco = getFirestore(app);
const auth = getAuth(app);
let regras;
let tokenAdmin;
let tokenFuncionario;

async function criarConta(uid, tipoUsuario) {
  const email = `${uid}@teste.local`;
  await auth.createUser({ uid, email, password: "Teste-local-123!" });
  await banco.doc(`usuarios/${uid}`).set({ nomeCompleto: uid, tipoUsuario, statusConta: "ATIVO" });
  const resposta = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=teste`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "Teste-local-123!", returnSecureToken: true }),
  });
  return (await resposta.json()).idToken;
}

async function chamar(nome, dados, token = tokenAdmin) {
  const resposta = await fetch(`http://127.0.0.1:5001/${projeto}/southamerica-east1/${nome}`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ data: dados }),
  });
  const corpo = await resposta.json();
  if (corpo.error) {
    const erro = new Error(corpo.error.message);
    erro.status = corpo.error.status;
    erro.details = corpo.error.details;
    throw erro;
  }
  return corpo.result;
}

function cadastro(extras = {}) {
  return { codigo: "TAL-002", nome: "Talhão da baixada", propriedadeNome: "Propriedade Exemplo", localidade: "", municipio: "", uf: "", areaHa: null, status: "ATIVO", observacoes: "", operacaoId: randomUUID(), ...extras };
}

async function editar(id, extras = {}) {
  const atual = (await banco.doc(`talhoes/${id}`).get()).data();
  const pedido = cadastro({ ...Object.fromEntries(["codigo", "nome", "propriedadeNome", "localidade", "municipio", "uf", "areaHa", "status", "observacoes"].map((campo) => [campo, atual[campo]])), talhaoId: id, versao: atual.versao, ...extras });
  return chamar("alterarTalhao", pedido);
}

before(async () => {
  regras = await initializeTestEnvironment({ projectId: projeto, firestore: { rules: readFileSync("../firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 } });
});
beforeEach(async () => {
  await regras.clearFirestore();
  const contas = await auth.listUsers();
  if (contas.users.length) await auth.deleteUsers(contas.users.map((conta) => conta.uid));
  tokenAdmin = await criarConta("admin", "ADMIN");
  tokenFuncionario = await criarConta("funcionario", "FUNCIONARIO");
});
after(async () => { await regras.cleanup(); await deleteApp(app); });

test("cadastra com metadados do servidor, área numérica e sem criar contas Auth", async () => {
  const resultado = await chamar("cadastrarTalhao", cadastro({ codigo: " tal-002 ", areaHa: "2,5001", municipio: "Criciúma", uf: "sc" }));
  const atual = (await banco.doc(`talhoes/${resultado.talhaoId}`).get()).data();
  assert.equal(atual.codigo, "TAL-002");
  assert.equal(atual.areaHa, 2.5001);
  assert.equal(atual.uf, "SC");
  assert.equal(atual.versao, 1);
  assert.equal(atual.criadoPor, "admin");
  assert.ok(atual.criadoEm.toMillis() > 0);
  assert.equal((await banco.doc("_talhoes_por_codigo/TAL-002").get()).data().talhaoId, resultado.talhaoId);
  assert.equal((await auth.listUsers()).users.length, 2);
});

test("nega as três operações sem sessão, a funcionário e a Admin indisponível", async () => {
  for (const nome of ["cadastrarTalhao", "alterarTalhao", "excluirTalhao"]) {
    await assert.rejects(chamar(nome, cadastro(), null), { status: "UNAUTHENTICATED" });
    await assert.rejects(chamar(nome, cadastro(), tokenFuncionario), { status: "PERMISSION_DENIED" });
    for (const mudanca of [{ statusConta: "INATIVO" }, { cadastroPendente: true }, { exclusaoPendente: true }, { tipoUsuario: "FUNCIONARIO" }]) {
      await banco.doc("usuarios/admin").set({ tipoUsuario: "ADMIN", statusConta: "ATIVO", ...mudanca });
      await assert.rejects(chamar(nome, cadastro()), { status: "PERMISSION_DENIED" });
    }
    await banco.doc("usuarios/admin").set({ tipoUsuario: "ADMIN", statusConta: "ATIVO" });
    await auth.updateUser("admin", { disabled: true });
    await assert.rejects(chamar(nome, cadastro()), { status: "PERMISSION_DENIED" });
    await auth.updateUser("admin", { disabled: false });
  }
});

test("valida campos sem truncar textos ou aceitar metadados enviados pelo cliente", async () => {
  const invalidos = [{ codigo: "a" }, { codigo: "TAL/02" }, { codigo: "A".repeat(21) }, { nome: "A" }, { propriedadeNome: "" }, { nome: "A".repeat(81) }, { localidade: "A".repeat(121) }, { observacoes: "A".repeat(501) }, { municipio: "Criciúma" }, { uf: "SC" }, { uf: "XX", municipio: "Exemplo" }, { areaHa: 0 }, { areaHa: -1 }, { areaHa: "texto" }, { areaHa: true }, { areaHa: 1.12345 }, { areaHa: "1,12345" }, { status: "EXCLUIDO" }, { criadoPor: "outro" }, { criadoEm: "ontem" }];
  for (const valores of invalidos) await assert.rejects(chamar("cadastrarTalhao", cadastro(valores)), { status: "INVALID_ARGUMENT" });
  assert.equal((await banco.collection("talhoes").get()).size, 0);
  assert.equal((await banco.collection("_talhoes_por_codigo").get()).size, 0);
});

test("dois cadastros concorrentes reservam um único código, inclusive inativo", async () => {
  const resultados = await Promise.allSettled([chamar("cadastrarTalhao", cadastro({ codigo: "tal-002", status: "INATIVO" })), chamar("cadastrarTalhao", cadastro())]);
  assert.equal(resultados.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(resultados.find((item) => item.status === "rejected").reason.status, "ALREADY_EXISTS");
  assert.equal((await banco.collection("talhoes").get()).size, 1);
  assert.equal((await banco.collection("_operacoes_talhoes").get()).size, 1);
});

test("repetir cadastro é idempotente e recusa reutilizar operação com outros dados", async () => {
  const pedido = cadastro();
  const respostas = await Promise.all([chamar("cadastrarTalhao", pedido), chamar("cadastrarTalhao", pedido)]);
  assert.deepEqual(respostas[0], respostas[1]);
  assert.equal((await banco.collection("talhoes").get()).size, 1);
  await assert.rejects(chamar("cadastrarTalhao", { ...pedido, nome: "Outro nome" }), { status: "FAILED_PRECONDITION" });
});

test("altera código atomicamente, preserva autoria e impede edição desatualizada", async () => {
  const criado = await chamar("cadastrarTalhao", cadastro());
  const ref = banco.doc(`talhoes/${criado.talhaoId}`);
  const antes = (await ref.get()).data();
  await ref.update({ legado: "preservar" });
  await editar(criado.talhaoId, { codigo: "TAL-003", nome: "Nome atualizado", areaHa: "" });
  const depois = (await ref.get()).data();
  assert.equal(depois.versao, 2);
  assert.equal(depois.areaHa, null);
  assert.equal(depois.legado, "preservar");
  assert.ok(depois.criadoEm.isEqual(antes.criadoEm));
  assert.equal((await banco.doc("_talhoes_por_codigo/TAL-002").get()).exists, false);
  assert.equal((await banco.doc("_talhoes_por_codigo/TAL-003").get()).data().talhaoId, criado.talhaoId);
  await assert.rejects(editar(criado.talhaoId, { versao: 1, nome: "Versão antiga" }), { status: "ABORTED" });
});

test("colisão na troca do código não altera o talhão nem seus índices", async () => {
  const primeiro = await chamar("cadastrarTalhao", cadastro());
  await chamar("cadastrarTalhao", cadastro({ codigo: "OUTRO" }));
  await assert.rejects(editar(primeiro.talhaoId, { codigo: "OUTRO", nome: "Não salvar" }), { status: "ALREADY_EXISTS" });
  assert.equal((await banco.doc(`talhoes/${primeiro.talhaoId}`).get()).data().versao, 1);
  assert.equal((await banco.collection("_talhoes_por_codigo").get()).size, 2);
});

test("repetir alteração não aumenta a versão e edições concorrentes não se sobrepõem", async () => {
  const criado = await chamar("cadastrarTalhao", cadastro());
  const op = randomUUID();
  await editar(criado.talhaoId, { operacaoId: op, nome: "Alterado" });
  await editar(criado.talhaoId, { operacaoId: op, versao: 1, nome: "Alterado" });
  assert.equal((await banco.doc(`talhoes/${criado.talhaoId}`).get()).data().versao, 2);
  const respostas = await Promise.allSettled([editar(criado.talhaoId, { nome: "Primeiro", versao: 2 }), editar(criado.talhaoId, { nome: "Segundo", versao: 2 })]);
  assert.equal(respostas.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(respostas.find((item) => item.status === "rejected").reason.status, "ABORTED");
});

test("análise vinculada bloqueia exclusão, mas permite inativar e reativar", async () => {
  const criado = await chamar("cadastrarTalhao", cadastro());
  await banco.doc("analises/exemplo").set({ talhaoId: criado.talhaoId });
  await assert.rejects(chamar("excluirTalhao", { talhaoId: criado.talhaoId, versao: 1, operacaoId: randomUUID() }), { status: "FAILED_PRECONDITION" });
  await editar(criado.talhaoId, { status: "INATIVO" });
  const cliente = regras.authenticatedContext("funcionario").firestore();
  const ativos = await getDocsFromServer(query(collection(cliente, "talhoes"), where("status", "==", "ATIVO")));
  assert.equal(ativos.size, 0);
  assert.equal((await getDocsFromServer(collection(cliente, "talhoes"))).size, 1);
  await editar(criado.talhaoId, { status: "ATIVO" });
  assert.equal((await banco.collection("analises").get()).size, 1);
});

test("exclusão é idempotente e operações antigas não recriam ou excluem outro talhão", async () => {
  const pedido = cadastro();
  const criado = await chamar("cadastrarTalhao", pedido);
  const excluir = { talhaoId: criado.talhaoId, versao: 1, operacaoId: randomUUID() };
  await chamar("excluirTalhao", excluir);
  await chamar("excluirTalhao", excluir);
  assert.equal((await banco.collection("talhoes").get()).size, 0);
  assert.equal((await banco.collection("_talhoes_por_codigo").get()).size, 0);
  await chamar("cadastrarTalhao", pedido);
  assert.equal((await banco.collection("talhoes").get()).size, 0);
  const novo = await chamar("cadastrarTalhao", cadastro());
  await chamar("excluirTalhao", excluir);
  assert.equal((await banco.doc(`talhoes/${novo.talhaoId}`).get()).exists, true);
});

test("regras permitem leitura aos dois perfis e negam escrita direta e coleções técnicas", async () => {
  const criado = await chamar("cadastrarTalhao", cadastro());
  for (const uid of ["admin", "funcionario"]) {
    const cliente = regras.authenticatedContext(uid).firestore();
    const ref = doc(cliente, "talhoes", criado.talhaoId);
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(getDoc(doc(cliente, "talhoes", "ausente")));
    await assertSucceeds(getDocsFromServer(collection(cliente, "talhoes")));
    await assertFails(setDoc(doc(cliente, "talhoes", "novo"), cadastro()));
    await assertFails(updateDoc(ref, { nome: "Alteração direta" }));
    await assertFails(deleteDoc(ref));
    await assertFails(getDocsFromServer(collection(cliente, "_talhoes_por_codigo")));
    await assertFails(getDocsFromServer(collection(cliente, "_operacoes_talhoes")));
  }
  await assertFails(getDocsFromServer(collection(regras.unauthenticatedContext().firestore(), "talhoes")));
  for (const perfil of [{ tipoUsuario: "PROFESSOR", statusConta: "ATIVO" }, { tipoUsuario: "FUNCIONARIO", statusConta: "INATIVO" }, { tipoUsuario: "FUNCIONARIO", statusConta: "ATIVO", cadastroPendente: true }, { tipoUsuario: "ADMIN", statusConta: "ATIVO", exclusaoPendente: true }]) {
    await banco.doc("usuarios/bloqueado").set(perfil);
    await assertFails(getDocsFromServer(collection(regras.authenticatedContext("bloqueado").firestore(), "talhoes")));
  }
});

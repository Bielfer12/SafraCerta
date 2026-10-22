const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { randomUUID } = require("node:crypto");
const { Buffer } = require("node:buffer");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { initializeTestEnvironment, assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const { collection, doc, getDoc, getDocs, setDoc, query, where, orderBy, limit, startAfter } = require("firebase/firestore");
const { ref, uploadBytes, getBytes } = require("firebase/storage");

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST || process.env.GCLOUD_PROJECT !== "demo-safracerta") throw new Error("Use apenas os emuladores demo-safracerta.");
const app = initializeApp({ projectId: "demo-safracerta" });
const banco = getFirestore(app);
const auth = getAuth(app);
let regras;
let funcionario;
let admin;
const talhaoId = "talhao-teste-123";

async function conta(uid, tipoUsuario) {
  const email = `${uid}@teste.local`;
  await auth.createUser({ uid, email, password: "Teste-local-123!" });
  await banco.doc(`usuarios/${uid}`).set({ nomeCompleto: uid, matricula: "20260001", tipoUsuario, statusConta: "ATIVO" });
  const resposta = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=teste`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "Teste-local-123!", returnSecureToken: true }) });
  return (await resposta.json()).idToken;
}
async function chamar(nome, dados, token = funcionario) {
  const resposta = await fetch(`http://127.0.0.1:5001/demo-safracerta/southamerica-east1/${nome}`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ data: dados }) });
  const corpo = await resposta.json();
  if (corpo.error) throw Object.assign(new Error(corpo.error.message), { status: corpo.error.status });
  return corpo.result;
}
const pedido = (extras = {}) => ({ analiseId: randomUUID(), talhaoId, origemFoto: "CAMERA", analiseAnteriorId: null, ...extras });
before(async () => { regras = await initializeTestEnvironment({ projectId: "demo-safracerta", firestore: { rules: readFileSync("../firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 }, storage: { rules: readFileSync("../storage.rules", "utf8"), host: "127.0.0.1", port: 9199 } }); });
beforeEach(async () => {
  await regras.clearFirestore();
  const usuarios = await auth.listUsers();
  if (usuarios.users.length) await auth.deleteUsers(usuarios.users.map((item) => item.uid));
  funcionario = await conta("funcionario", "FUNCIONARIO");
  admin = await conta("admin", "ADMIN");
  await banco.doc(`talhoes/${talhaoId}`).set({ codigo: "TAL-001", nome: "Baixada", propriedadeNome: "Propriedade", status: "ATIVO", versao: 1 });
  await banco.doc("_talhoes_por_codigo/TAL-001").set({ talhaoId });
});
after(async () => { await regras.cleanup(); await deleteApp(app); });

test("inicia histórico com snapshots do servidor para ambos os perfis", async () => {
  for (const token of [funcionario, admin]) {
    const dados = pedido();
    await chamar("iniciarAnalise", dados, token);
    const atual = (await banco.doc(`analises/${dados.analiseId}`).get()).data();
    assert.equal(atual.status, "AGUARDANDO_ENVIO");
    assert.equal(atual.talhaoSnapshot.nome, "Baixada");
    assert.equal(atual.usuarioSnapshot.matricula, "20260001");
    assert.equal(atual.resultado, null);
    assert.ok(atual.criadoEm.toMillis() > 0);
    assert.ok(atual.expiraEm.toMillis() > atual.criadoEm.toMillis());
  }
});

test("reenvio concorrente não duplica nem altera contexto já aceito", async () => {
  const dados = pedido();
  await Promise.all([chamar("iniciarAnalise", dados), chamar("iniciarAnalise", dados)]);
  await banco.doc(`talhoes/${talhaoId}`).update({ nome: "Nome novo", status: "INATIVO" });
  await chamar("iniciarAnalise", dados);
  const registros = await banco.collection("analises").get();
  assert.equal(registros.size, 1);
  assert.equal(registros.docs[0].data().talhaoSnapshot.nome, "Baixada");
  await assert.rejects(chamar("iniciarAnalise", { ...dados, origemFoto: "GALERIA" }), { status: "ALREADY_EXISTS" });
  await assert.rejects(chamar("iniciarAnalise", dados, admin), { status: "ALREADY_EXISTS" });
});

test("recusa metadados, contexto inválido e conta indisponível", async () => {
  for (const extra of [{ usuarioId: "admin" }, { resultado: {} }, { criadoEm: "ontem" }, { origemFoto: "OUTRA" }, { talhaoId: "../outro" }]) await assert.rejects(chamar("iniciarAnalise", pedido(extra)), { status: "INVALID_ARGUMENT" });
  await assert.rejects(chamar("iniciarAnalise", pedido(), null), { status: "UNAUTHENTICATED" });
  for (const extra of [{ statusConta: "INATIVO" }, { cadastroPendente: true }, { exclusaoPendente: true }, { tipoUsuario: "OUTRO" }]) {
    await banco.doc("usuarios/funcionario").set({ tipoUsuario: "FUNCIONARIO", statusConta: "ATIVO", ...extra });
    await assert.rejects(chamar("iniciarAnalise", pedido()), { status: "PERMISSION_DENIED" });
  }
  await banco.doc("usuarios/funcionario").set({ tipoUsuario: "FUNCIONARIO", statusConta: "ATIVO" });
  await auth.updateUser("funcionario", { disabled: true });
  await assert.rejects(chamar("iniciarAnalise", pedido()), { status: "PERMISSION_DENIED" });
});

test("talhão inativo não recebe nova tentativa", async () => {
  await banco.doc(`talhoes/${talhaoId}`).update({ status: "INATIVO" });
  await assert.rejects(chamar("iniciarAnalise", pedido()), { status: "FAILED_PRECONDITION" });
  assert.equal((await banco.collection("analises").get()).size, 0);
});

test("falha de envio não substitui resultado ou processamento assumido pela API", async () => {
  const dados = pedido();
  await chamar("iniciarAnalise", dados);
  for (const status of ["EM_PROCESSAMENTO", "CONCLUIDA"]) {
    await banco.doc(`analises/${dados.analiseId}`).update({ status });
    assert.equal((await chamar("registrarFalhaEnvioAnalise", { analiseId: dados.analiseId, codigo: "CONEXAO" })).status, status);
  }
  await banco.doc(`analises/${dados.analiseId}`).update({ status: "AGUARDANDO_ENVIO" });
  await chamar("registrarFalhaEnvioAnalise", { analiseId: dados.analiseId, codigo: "API_RECUSOU" });
  const atual = (await banco.doc(`analises/${dados.analiseId}`).get()).data();
  assert.equal(atual.status, "FALHOU");
  assert.equal(atual.erro.codigo, "API_RECUSOU");
  await assert.rejects(chamar("registrarFalhaEnvioAnalise", { analiseId: dados.analiseId, codigo: "CONEXAO" }, admin), { status: "PERMISSION_DENIED" });
});

test("regras isolam histórico por autoria e impedem escritas diretas", async () => {
  const propria = pedido();
  const outra = pedido();
  await chamar("iniciarAnalise", propria);
  await chamar("iniciarAnalise", outra, admin);
  const cliente = regras.authenticatedContext("funcionario").firestore();
  await assertSucceeds(getDoc(doc(cliente, "analises", propria.analiseId)));
  await assertFails(getDoc(doc(cliente, "analises", outra.analiseId)));
  await assertFails(getDocs(collection(cliente, "analises")));
  const consulta = query(collection(cliente, "analises"), where("usuarioId", "==", "funcionario"), orderBy("criadoEm", "desc"), limit(1));
  const primeira = await assertSucceeds(getDocs(consulta));
  assert.equal(primeira.size, 1);
  assert.equal((await getDocs(query(consulta, startAfter(primeira.docs[0])))).size, 0);
  for (const uid of ["funcionario", "admin"]) await assertFails(setDoc(doc(regras.authenticatedContext(uid).firestore(), "analises", propria.analiseId), { status: "CONCLUIDA" }, { merge: true }));
  assert.equal((await assertSucceeds(getDocs(collection(regras.authenticatedContext("admin").firestore(), "analises")))).size, 2);
  await banco.doc("usuarios/funcionario").update({ statusConta: "INATIVO" });
  await assertFails(getDoc(doc(cliente, "analises", propria.analiseId)));
});

test("foto exige autoria e metadados de arquivo válidos", async () => {
  const dados = pedido();
  await chamar("iniciarAnalise", dados);
  await assert.rejects(chamar("obterFotoAnalise", { analiseId: dados.analiseId }), { status: "NOT_FOUND" });
  const outros = pedido();
  await chamar("iniciarAnalise", outros, admin);
  await assert.rejects(chamar("obterFotoAnalise", { analiseId: outros.analiseId }), { status: "PERMISSION_DENIED" });
  await banco.doc(`analises/${dados.analiseId}`).update({ foto: { situacao: "SALVA", caminho: "arquivo/fora/do/historico", geracao: "123" } });
  await assert.rejects(chamar("obterFotoAnalise", { analiseId: dados.analiseId }), { status: "NOT_FOUND" });
});

test("Storage nega uploads e leituras diretas aos dois perfis", async () => {
  const caminho = `analises/funcionario/${randomUUID()}/foto.jpg`;
  const arquivoServidor = getStorage().bucket("safracerta-ee9ce.firebasestorage.app").file(caminho);
  await arquivoServidor.save(Buffer.from([1, 2, 3]), { contentType: "image/jpeg" });
  for (const uid of ["funcionario", "admin"]) {
    const armazenamento = regras.authenticatedContext(uid).storage("gs://safracerta-ee9ce.firebasestorage.app");
    const arquivo = ref(armazenamento, `analises/${uid}/tentativa-teste/foto.jpg`);
    await assertFails(uploadBytes(arquivo, new Uint8Array([1, 2, 3]), { contentType: "image/jpeg" }));
    await assert.rejects(getBytes(ref(armazenamento, caminho)), { code: "storage/unauthorized" });
  }
  await arquivoServidor.delete();
});

test("sessão revogada não inicia análise nem recebe link de foto", async () => {
  const dados = pedido();
  await chamar("iniciarAnalise", dados);
  await new Promise((resolve) => setTimeout(resolve, 1100));
  await auth.revokeRefreshTokens("funcionario");
  await assert.rejects(chamar("iniciarAnalise", pedido()), { status: "PERMISSION_DENIED" });
  await assert.rejects(chamar("obterFotoAnalise", { analiseId: dados.analiseId }), { status: "PERMISSION_DENIED" });
});

test("histórico impede exclusão do talhão e criação concorre com exclusão", async () => {
  const dados = pedido();
  await chamar("iniciarAnalise", dados);
  await assert.rejects(chamar("excluirTalhao", { talhaoId, versao: 1, operacaoId: randomUUID() }, admin), { status: "FAILED_PRECONDITION" });
  await banco.doc(`analises/${dados.analiseId}`).delete();
  const disputa = await Promise.allSettled([chamar("iniciarAnalise", pedido()), chamar("excluirTalhao", { talhaoId, versao: 1, operacaoId: randomUUID() }, admin)]);
  assert.equal(disputa.filter((item) => item.status === "fulfilled").length, 1);
  if (!(await banco.doc(`talhoes/${talhaoId}`).get()).exists) assert.equal((await banco.collection("analises").get()).size, 0);
});

test("reconciliação encerra apenas pendências vencidas", async () => {
  const { encerrarExpiradasParaTeste } = require("../analises");
  for (const status of ["AGUARDANDO_ENVIO", "EM_PROCESSAMENTO", "CONCLUIDA"]) {
    const dados = pedido();
    await chamar("iniciarAnalise", dados);
    await banco.doc(`analises/${dados.analiseId}`).update({ status, expiraEm: Timestamp.fromMillis(Date.now() - 1000) });
  }
  await encerrarExpiradasParaTeste();
  const registros = (await banco.collection("analises").get()).docs.map((item) => item.data());
  assert.equal(registros.filter((item) => item.status === "INTERROMPIDA").length, 2);
  assert.equal(registros.filter((item) => item.status === "CONCLUIDA").length, 1);
});

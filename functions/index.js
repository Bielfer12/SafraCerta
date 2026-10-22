const { randomUUID, createHash } = require("node:crypto");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { CAMPOS_TALHAO, validarTalhao } = require("./talhoes-validacao");

initializeApp();
const banco = getFirestore();
const autenticacao = getAuth();
const usuarios = banco.collection("usuarios");
const controle = banco.doc("_controle_usuarios/administracao");
const opcoes = {
  region: "southamerica-east1",
  serviceAccount: "safracerta-usuarios@safracerta-ee9ce.iam.gserviceaccount.com",
  minInstances: 0,
  maxInstances: 5,
  timeoutSeconds: 120,
};

function texto(valor, limite = 150) {
  return typeof valor === "string" ? valor.trim().slice(0, limite) : "";
}

function ativo(perfil) {
  return perfil?.statusConta === "ATIVO" && !perfil.exclusaoPendente && !perfil.cadastroPendente;
}

function dadosCadastro(dados) {
  const cadastro = {
    nomeCompleto: texto(dados.nomeCompleto),
    matricula: texto(dados.matricula, 64).replace(/\s+/g, ""),
    emailInstitucional: texto(dados.emailInstitucional, 254).toLowerCase(),
    telefone: texto(dados.telefone, 30),
    tipoUsuario: dados.tipoUsuario,
  };
  const erros = {};
  if (cadastro.nomeCompleto.length < 2) erros.nomeCompleto = "Informe o nome completo.";
  if (!cadastro.matricula || /[/\\]/.test(cadastro.matricula) || /^\.{1,2}$/.test(cadastro.matricula))
    erros.matricula = "Informe uma matrícula válida, sem barras.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cadastro.emailInstitucional))
    erros.emailInstitucional = "Informe um e-mail válido.";
  if (cadastro.telefone && !/^[\d\s()+.-]{8,30}$/.test(cadastro.telefone))
    erros.telefone = "Confira o telefone informado.";
  if (!["ADMIN", "FUNCIONARIO"].includes(cadastro.tipoUsuario))
    erros.tipoUsuario = "Selecione Funcionário ou Admin.";
  if (Object.keys(erros).length)
    throw new HttpsError("invalid-argument", "Confira os campos destacados.", { campos: erros });
  return cadastro;
}

async function exigirAdmin(requisicao) {
  if (!requisicao.auth) throw new HttpsError("unauthenticated", "Entre na sua conta para continuar.");
  const conta = await autenticacao.getUser(requisicao.auth.uid);
  const perfil = await usuarios.doc(conta.uid).get();
  if (conta.disabled || !ativo(perfil.data()) || perfil.data()?.tipoUsuario !== "ADMIN") {
    throw new HttpsError("permission-denied", "Seu acesso administrativo não está disponível.");
  }
  return conta.uid;
}

async function conferirAdmin(transacao, uid) {
  const perfil = await transacao.get(usuarios.doc(uid));
  if (!ativo(perfil.data()) || perfil.data()?.tipoUsuario !== "ADMIN")
    throw new HttpsError("permission-denied", "Sua permissão administrativa mudou. Entre novamente.");
}

function versao(documento) {
  return `${documento.updateTime.seconds}.${documento.updateTime.nanoseconds}`;
}

function conferirVersao(documento, esperada, originais) {
  if (!documento.exists)
    throw new HttpsError("not-found", "Este usuário não está mais cadastrado. Atualize a lista.");
  const campos = ["nomeCompleto", "matricula", "emailInstitucional", "telefone", "tipoUsuario", "statusConta", "cadastroPendente", "exclusaoPendente"];
  const dados = documento.data();
  const mesmosDados = originais && campos.every((campo) => Object.hasOwn(originais, campo) && (originais[campo] ?? null) === (dados[campo] ?? null));
  if (versao(documento) !== esperada && !mesmosDados)
    throw new HttpsError(
      "aborted",
      "Este cadastro mudou. Feche o formulário e atualize a lista antes de continuar.",
    );
}

async function protegerUltimoAdmin(transacao, documento, perdePermissao = true) {
  const trava = await transacao.get(controle);
  if (perdePermissao && documento.data().tipoUsuario === "ADMIN" && ativo(documento.data())) {
    const administradores = await transacao.get(usuarios.where("tipoUsuario", "==", "ADMIN"));
    if (administradores.docs.filter((item) => ativo(item.data())).length <= 1) {
      throw new HttpsError("failed-precondition", "Mantenha pelo menos um administrador ativo no sistema.");
    }
  }
  return Number(trava.data()?.versao || 0) + 1;
}

async function desfazerReserva(registro, indice, uid, operacaoId) {
  await banco.runTransaction(async (transacao) => {
    const atual = await transacao.get(registro);
    const associacao = await transacao.get(indice);
    const perfil = await transacao.get(usuarios.doc(uid));
    if (
      !atual.data()?.concluida &&
      associacao.data()?.cadastroId === operacaoId &&
      perfil.data()?.cadastroPendente
    ) {
      transacao.delete(indice);
      transacao.delete(registro);
      transacao.delete(perfil.ref);
    }
  });
}

function operacao(funcao) {
  return onCall(opcoes, async (requisicao) => {
    try {
      const adminUid = await exigirAdmin(requisicao);
      return await funcao(requisicao.data || {}, adminUid);
    } catch (erro) {
      if (erro instanceof HttpsError) throw erro;
      if (["auth/email-already-exists", "auth/email-already-in-use"].includes(erro.code))
        throw new HttpsError(
          "already-exists",
          "Este e-mail já possui uma conta. Utilize outro e-mail ou confira o cadastro existente.",
          { campos: { emailInstitucional: "E-mail já cadastrado." } },
        );
      if (erro.code === "auth/invalid-email")
        throw new HttpsError("invalid-argument", "Confira o e-mail informado.", {
          campos: { emailInstitucional: "E-mail inválido." },
        });
      throw new HttpsError(
        "internal",
        "A operação não foi concluída. Atualize a lista e tente novamente.",
      );
    }
  });
}

exports.cadastrarUsuario = operacao(async (dados, adminUid) => {
  const cadastro = dadosCadastro(dados);
  const operacaoId = texto(dados.operacaoId, 128);
  if (!/^[\w-]{16,128}$/.test(operacaoId))
    throw new HttpsError("invalid-argument", "Reabra o formulário e tente novamente.");
  const assinatura = createHash("sha256").update(JSON.stringify(cadastro)).digest("hex");
  const registro = banco.doc(`_operacoes_usuarios/${operacaoId}`);
  const indice = banco.doc(`login_por_matricula/${cadastro.matricula}`);
  const reserva = await banco.runTransaction(async (transacao) => {
    await conferirAdmin(transacao, adminUid);
    const anterior = await transacao.get(registro);
    if (anterior.exists) {
      if (anterior.data().assinatura !== assinatura)
        throw new HttpsError(
          "failed-precondition",
          "Há um cadastro pendente com outros dados. Retome os dados originais antes de tentar novamente.",
        );
      return anterior.data();
    }
    const matricula = await transacao.get(indice);
    const existentes = await transacao.get(usuarios.where("matricula", "==", cadastro.matricula).limit(1));
    if (matricula.exists || !existentes.empty)
      throw new HttpsError(
        "already-exists",
        "Esta matrícula já está cadastrada ou reservada por um cadastro em andamento.",
        { campos: { matricula: "Matrícula já cadastrada." } },
      );
    const nova = { uid: randomUUID(), assinatura, concluida: false };
    transacao.create(registro, nova);
    transacao.create(indice, {
      email: cadastro.emailInstitucional,
      uid: nova.uid,
      cadastroPendente: true,
      cadastroId: operacaoId,
    });
    transacao.create(usuarios.doc(nova.uid), {
      ...cadastro,
      statusConta: "ATIVO",
      cadastroPendente: true,
      cadastroId: operacaoId,
    });
    return nova;
  });
  if (reserva.concluida) {
    const existente = await usuarios.doc(reserva.uid).get();
    if (!existente.exists || existente.data().exclusaoPendente)
      throw new HttpsError("not-found", "O cadastro desta operação foi removido. Atualize a lista.");
    await autenticacao.getUser(reserva.uid);
    return { uid: reserva.uid, concluido: true };
  }
  try {
    await autenticacao.createUser({
      uid: reserva.uid,
      email: cadastro.emailInstitucional,
      displayName: cadastro.nomeCompleto,
      disabled: true,
    });
  } catch (erro) {
    if (["auth/invalid-email", "auth/invalid-display-name", "auth/invalid-uid"].includes(erro.code))
      await desfazerReserva(registro, indice, reserva.uid, operacaoId);
    if (!["auth/uid-already-exists", "auth/email-already-exists"].includes(erro.code)) throw erro;
    let existente;
    try {
      existente = await autenticacao.getUser(reserva.uid);
    } catch (falha) {
      if (falha.code === "auth/user-not-found" && erro.code === "auth/email-already-exists") {
        await desfazerReserva(registro, indice, reserva.uid, operacaoId);
      }
      throw erro;
    }
    if (existente.email !== cadastro.emailInstitucional)
      throw new HttpsError(
        "failed-precondition",
        "A conta vinculada está inconsistente. Confira o cadastro antes de continuar.",
      );
  }
  const perfil = usuarios.doc(reserva.uid);
  const pronto = await banco.runTransaction(async (transacao) => {
    await conferirAdmin(transacao, adminUid);
    const atual = await transacao.get(registro);
    const existente = await transacao.get(perfil);
    if (atual.data()?.concluida) return true;
    if (!existente.exists)
      transacao.create(perfil, {
        ...cadastro,
        statusConta: "ATIVO",
        cadastroPendente: true,
        cadastroId: operacaoId,
      });
    return false;
  });
  if (!pronto) {
    await autenticacao.updateUser(reserva.uid, { disabled: false });
    await banco.runTransaction(async (transacao) => {
      await conferirAdmin(transacao, adminUid);
      const atual = await transacao.get(registro);
      if (atual.data()?.concluida) return;
      transacao.update(perfil, { cadastroPendente: FieldValue.delete(), cadastroId: FieldValue.delete() });
      transacao.set(indice, { email: cadastro.emailInstitucional, uid: reserva.uid });
      transacao.update(registro, { concluida: true });
    });
  }
  return { uid: reserva.uid, concluido: true };
});

exports.alterarUsuario = operacao(async (dados, adminUid) => {
  const cadastro = dadosCadastro(dados);
  const uid = texto(dados.uid, 128);
  if (!uid || uid.includes("/")) throw new HttpsError("invalid-argument", "Usuário inválido.");
  await banco.runTransaction(async (transacao) => {
    await conferirAdmin(transacao, adminUid);
    const documento = await transacao.get(usuarios.doc(uid));
    conferirVersao(documento, dados.versao, dados.originais);
    const anterior = documento.data();
    if (anterior.cadastroPendente || anterior.exclusaoPendente)
      throw new HttpsError(
        "failed-precondition",
        "Conclua a operação pendente antes de alterar este usuário.",
      );
    if (cadastro.matricula !== String(anterior.matricula))
      throw new HttpsError("failed-precondition", "A matrícula não pode ser alterada.");
    if (cadastro.emailInstitucional !== anterior.emailInstitucional)
      throw new HttpsError("failed-precondition", "O e-mail de acesso não pode ser alterado nesta tela.");
    const numero = await protegerUltimoAdmin(transacao, documento, cadastro.tipoUsuario !== "ADMIN");
    transacao.update(documento.ref, {
      nomeCompleto: cadastro.nomeCompleto,
      telefone: cadastro.telefone,
      tipoUsuario: cadastro.tipoUsuario,
    });
    transacao.set(controle, { versao: numero });
  });
  return { concluido: true };
});

exports.excluirUsuario = operacao(async (dados, adminUid) => {
  const uid = texto(dados.uid, 128);
  if (!uid || uid.includes("/")) throw new HttpsError("invalid-argument", "Usuário inválido.");
  if (uid === adminUid)
    throw new HttpsError("failed-precondition", "Você não pode excluir a própria conta nesta tela.");
  const referencia = usuarios.doc(uid);
  const vinculos = await referencia.listCollections();
  if (vinculos.length)
    throw new HttpsError(
      "failed-precondition",
      "Este usuário possui dados vinculados. A exclusão precisa ser analisada antes de continuar.",
    );
  const matricula = await banco.runTransaction(async (transacao) => {
    await conferirAdmin(transacao, adminUid);
    const documento = await transacao.get(referencia);
    if (!documento.exists) return null;
    const associacao = await transacao.get(banco.doc(`login_por_matricula/${documento.data().matricula}`));
    if (
      associacao.exists &&
      ((associacao.data().uid && associacao.data().uid !== uid) ||
        associacao.data().email !== documento.data().emailInstitucional)
    )
      throw new HttpsError(
        "failed-precondition",
        "A matrícula está vinculada a outra conta. Confira os dados antes de continuar.",
      );
    if (documento.data().cadastroPendente)
      throw new HttpsError("failed-precondition", "Conclua o cadastro pendente antes de excluir a conta.");
    if (!documento.data().exclusaoPendente) conferirVersao(documento, dados.versao, dados.originais);
    const numero = await protegerUltimoAdmin(transacao, documento);
    transacao.update(referencia, { exclusaoPendente: true });
    transacao.set(controle, { versao: numero });
    return String(documento.data().matricula);
  });
  if (matricula === null) return { concluido: true };
  try {
    await autenticacao.deleteUser(uid);
  } catch (erro) {
    if (erro.code !== "auth/user-not-found") throw erro;
  }
  await banco.runTransaction(async (transacao) => {
    await conferirAdmin(transacao, adminUid);
    const documento = await transacao.get(referencia);
    const indice = banco.doc(`login_por_matricula/${matricula}`);
    const associacao = await transacao.get(indice);
    if (!documento.exists) return;
    if (!documento.data().exclusaoPendente)
      throw new HttpsError("failed-precondition", "O estado da exclusão mudou. Atualize a lista.");
    if (associacao.exists && associacao.data().uid && associacao.data().uid !== uid)
      throw new HttpsError(
        "failed-precondition",
        "A matrícula está vinculada a outra conta. Confira os dados antes de continuar.",
      );
    transacao.delete(referencia);
    if (associacao.exists) transacao.delete(indice);
  });
  return { concluido: true };
});

async function gravarTalhao(tipo, entrada, adminUid) {
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada))
    throw new HttpsError("invalid-argument", "Solicitação inválida.");
  const permitidos = tipo === "EXCLUIR" ? [] : CAMPOS_TALHAO;
  if (Object.keys(entrada).some((campo) => ![...permitidos, "operacaoId", ...(tipo === "CADASTRAR" ? [] : ["talhaoId", "versao"])].includes(campo)))
    throw new HttpsError("invalid-argument", "A solicitação contém campos não permitidos.");
  if (typeof entrada.operacaoId !== "string" || !/^[A-Za-z0-9_-]{10,128}$/.test(entrada.operacaoId))
    throw new HttpsError("invalid-argument", "Identificador da operação inválido.");
  const validacao = tipo === "EXCLUIR" ? { dados: {} , erros: {} } : validarTalhao(entrada);
  if (Object.keys(validacao.erros).length)
    throw new HttpsError("invalid-argument", "Confira os campos destacados.", { campos: validacao.erros });
  if (tipo !== "CADASTRAR" && (typeof entrada.talhaoId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(entrada.talhaoId)
    || !Number.isSafeInteger(entrada.versao) || entrada.versao < 1))
    throw new HttpsError("invalid-argument", "Talhão ou versão inválidos. Atualize a lista.");
  const registro = banco.doc(`_operacoes_talhoes/${entrada.operacaoId}`);
  const referencia = tipo === "CADASTRAR" ? banco.collection("talhoes").doc() : banco.doc(`talhoes/${entrada.talhaoId}`);
  const assinatura = createHash("sha256").update(JSON.stringify({ tipo, ...validacao.dados, talhaoId: entrada.talhaoId || null, versao: entrada.versao || null })).digest("hex");
  return banco.runTransaction(async (transacao) => {
    await conferirAdmin(transacao, adminUid);
    const anteriorOperacao = await transacao.get(registro);
    if (anteriorOperacao.exists) {
      const anterior = anteriorOperacao.data();
      if (anterior.usuarioId !== adminUid || anterior.tipo !== tipo || anterior.entradaHash !== assinatura)
        throw new HttpsError("failed-precondition", "Esta operação já foi usada com outros dados. Atualize a lista.");
      return anterior.resultado;
    }
    const atual = await transacao.get(referencia);
    if (tipo !== "CADASTRAR") {
      if (!atual.exists) throw new HttpsError("not-found", "Este talhão não está mais cadastrado. Atualize a lista.");
      if (atual.data().versao !== entrada.versao)
        throw new HttpsError("aborted", "Este talhão foi alterado. Feche o formulário e atualize a lista antes de continuar.");
    }
    const codigoAnterior = atual.data()?.codigo;
    const codigoNovo = tipo === "EXCLUIR" ? codigoAnterior : validacao.dados.codigo;
    const indiceNovo = banco.doc(`_talhoes_por_codigo/${codigoNovo}`);
    const reservaNova = await transacao.get(indiceNovo);
    const indiceAnterior = codigoAnterior && codigoAnterior !== codigoNovo ? banco.doc(`_talhoes_por_codigo/${codigoAnterior}`) : null;
    const reservaAnterior = indiceAnterior ? await transacao.get(indiceAnterior) : null;
    if (reservaNova.exists && reservaNova.data().talhaoId !== referencia.id)
      throw new HttpsError(tipo === "EXCLUIR" ? "failed-precondition" : "already-exists", "O código informado já está vinculado a outro talhão.", { campos: { codigo: "Código já cadastrado." } });
    if (reservaAnterior?.exists && reservaAnterior.data().talhaoId !== referencia.id)
      throw new HttpsError("failed-precondition", "O índice deste talhão está inconsistente. Confira o cadastro antes de continuar.");
    if (tipo === "EXCLUIR") {
      const vinculos = await transacao.get(banco.collection("analises").where("talhaoId", "==", referencia.id).limit(1));
      if (!vinculos.empty) throw new HttpsError("failed-precondition", "Este talhão possui análises vinculadas. Altere a situação para Inativo para preservar o histórico.");
      transacao.delete(referencia);
      if (reservaNova.exists) transacao.delete(indiceNovo);
    } else {
      const valores = {
        ...validacao.dados,
        atualizadoEm: FieldValue.serverTimestamp(),
        atualizadoPor: adminUid,
        versao: tipo === "CADASTRAR" ? 1 : entrada.versao + 1,
      };
      if (tipo === "CADASTRAR") transacao.create(referencia, { ...valores, criadoEm: FieldValue.serverTimestamp(), criadoPor: adminUid });
      else transacao.update(referencia, valores);
      if (!reservaNova.exists) transacao.create(indiceNovo, { talhaoId: referencia.id, criadoEm: FieldValue.serverTimestamp() });
      if (reservaAnterior?.exists) transacao.delete(indiceAnterior);
    }
    const resultado = { talhaoId: referencia.id, concluido: true };
    transacao.create(registro, { usuarioId: adminUid, tipo, talhaoId: referencia.id, entradaHash: assinatura, concluida: true, criadaEm: FieldValue.serverTimestamp(), resultado });
    return resultado;
  });
}

exports.cadastrarTalhao = operacao((dados, uid) => gravarTalhao("CADASTRAR", dados, uid));
exports.alterarTalhao = operacao((dados, uid) => gravarTalhao("ALTERAR", dados, uid));
exports.excluirTalhao = operacao((dados, uid) => gravarTalhao("EXCLUIR", dados, uid));

const analises = require("./analises");
for (const nome of ["iniciarAnalise", "registrarFalhaEnvioAnalise", "obterFotoAnalise", "encerrarAnalisesExpiradas"]) exports[nome] = analises[nome];

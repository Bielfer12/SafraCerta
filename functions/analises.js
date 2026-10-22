const { getAuth } = require("firebase-admin/auth");
const {
  getFirestore,
  FieldValue,
  Timestamp,
} = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");

const banco = getFirestore();
const opcoes = {
  region: "southamerica-east1",
  serviceAccount:
    "safracerta-usuarios@safracerta-ee9ce.iam.gserviceaccount.com",
  minInstances: 0,
  maxInstances: 5,
  timeoutSeconds: 120,
};
const pendentes = ["AGUARDANDO_ENVIO", "EM_PROCESSAMENTO"];
const idValido = (id) =>
  typeof id === "string" && /^[A-Za-z0-9_-]{10,128}$/.test(id);
const ativo = (perfil) =>
  perfil?.statusConta === "ATIVO" &&
  ["ADMIN", "FUNCIONARIO"].includes(perfil.tipoUsuario) &&
  !perfil.cadastroPendente &&
  !perfil.exclusaoPendente;
const bucket = () =>
  getStorage().bucket(
    process.env.SAFRACERTA_STORAGE_BUCKET ||
      "safracerta-ee9ce.firebasestorage.app",
  );

async function autorizar(requisicao) {
  if (!requisicao.auth)
    throw new HttpsError(
      "unauthenticated",
      "Entre na sua conta para continuar.",
    );
  const uid = requisicao.auth.uid;
  const conta = await getAuth().getUser(uid);
  const perfil = (await banco.doc(`usuarios/${uid}`).get()).data();
  const sessaoRevogada = Number(requisicao.auth.token.auth_time) * 1000 < Date.parse(conta.tokensValidAfterTime);
  if (conta.disabled || sessaoRevogada || !ativo(perfil))
    throw new HttpsError(
      "permission-denied",
      "Seu acesso não está disponível.",
    );
  return { uid, perfil };
}

function entrada(dados, campos) {
  if (
    !dados ||
    typeof dados !== "object" ||
    Array.isArray(dados) ||
    Object.keys(dados).some((campo) => !campos.includes(campo))
  )
    throw new HttpsError(
      "invalid-argument",
      "A solicitação contém campos inválidos.",
    );
}

exports.iniciarAnalise = onCall(opcoes, async (requisicao) => {
  const { uid } = await autorizar(requisicao);
  const dados = requisicao.data;
  entrada(dados, ["analiseId", "talhaoId", "origemFoto", "analiseAnteriorId"]);
  if (
    !idValido(dados.analiseId) ||
    !idValido(dados.talhaoId) ||
    !["CAMERA", "GALERIA"].includes(dados.origemFoto) ||
    (dados.analiseAnteriorId != null && !idValido(dados.analiseAnteriorId))
  )
    throw new HttpsError(
      "invalid-argument",
      "Confira a foto e o talhão selecionado.",
    );
  const referencia = banco.doc(`analises/${dados.analiseId}`);
  return banco.runTransaction(async (transacao) => {
    const perfil = (await transacao.get(banco.doc(`usuarios/${uid}`))).data();
    if (!ativo(perfil))
      throw new HttpsError("permission-denied", "Seu acesso foi encerrado.");
    const anterior = await transacao.get(referencia);
    if (anterior.exists) {
      const valor = anterior.data();
      if (
        valor.usuarioId !== uid ||
        valor.talhaoId !== dados.talhaoId ||
        valor.origemFoto !== dados.origemFoto ||
        valor.analiseAnteriorId !== (dados.analiseAnteriorId || null)
      )
        throw new HttpsError(
          "already-exists",
          "Esta solicitação já foi usada para outra análise.",
        );
      return { analiseId: referencia.id, status: valor.status };
    }
    const talhao = (
      await transacao.get(banco.doc(`talhoes/${dados.talhaoId}`))
    ).data();
    if (!talhao || talhao.status !== "ATIVO")
      throw new HttpsError(
        "failed-precondition",
        "O talhão não está mais ativo. Selecione outro talhão.",
      );
    if (dados.analiseAnteriorId) {
      const origem = (
        await transacao.get(banco.doc(`analises/${dados.analiseAnteriorId}`))
      ).data();
      if (
        !origem ||
        (origem.usuarioId !== uid && perfil.tipoUsuario !== "ADMIN")
      )
        throw new HttpsError(
          "permission-denied",
          "A análise anterior não está disponível.",
        );
    }
    const snapshot = Object.fromEntries(
      [
        "codigo",
        "nome",
        "propriedadeNome",
        "localidade",
        "municipio",
        "uf",
        "areaHa",
        "versao",
      ].map((campo) => [campo, talhao[campo] ?? null]),
    );
    transacao.create(referencia, {
      versaoEsquema: 1,
      tipoTeste: "TESTE_FOLHA",
      status: "AGUARDANDO_ENVIO",
      usuarioId: uid,
      usuarioSnapshot: {
        nomeCompleto: perfil.nomeCompleto || "",
        matricula: perfil.matricula || "",
        tipoUsuario: perfil.tipoUsuario,
      },
      talhaoId: dados.talhaoId,
      talhaoSnapshot: snapshot,
      origemFoto: dados.origemFoto,
      foto: {
        situacao: "PENDENTE",
        caminho: null,
        geracao: null,
        tipoMime: null,
        tamanhoBytes: null,
        largura: null,
        altura: null,
        sha256: null,
      },
      resultado: null,
      modelo: null,
      erro: null,
      analiseAnteriorId: dados.analiseAnteriorId || null,
      criadoEm: FieldValue.serverTimestamp(),
      atualizadoEm: FieldValue.serverTimestamp(),
      iniciadoEm: null,
      finalizadoEm: null,
      expiraEm: Timestamp.fromMillis(Date.now() + 600000),
      duracaoProcessamentoMs: null,
    });
    return { analiseId: referencia.id, status: "AGUARDANDO_ENVIO" };
  });
});

exports.registrarFalhaEnvioAnalise = onCall(opcoes, async (requisicao) => {
  const { uid } = await autorizar(requisicao);
  const dados = requisicao.data;
  entrada(dados, ["analiseId", "codigo"]);
  if (
    !idValido(dados.analiseId) ||
    !["CONEXAO", "CANCELAMENTO", "API_RECUSOU"].includes(dados.codigo)
  )
    throw new HttpsError("invalid-argument", "Solicitação inválida.");
  return banco.runTransaction(async (transacao) => {
    const perfil = (await transacao.get(banco.doc(`usuarios/${uid}`))).data();
    if (!ativo(perfil))
      throw new HttpsError("permission-denied", "Seu acesso foi encerrado.");
    const referencia = banco.doc(`analises/${dados.analiseId}`);
    const atual = (await transacao.get(referencia)).data();
    if (!atual || atual.usuarioId !== uid)
      throw new HttpsError("permission-denied", "Análise indisponível.");
    if (atual.status === "AGUARDANDO_ENVIO") {
      const status =
        dados.codigo === "CANCELAMENTO" ? "INTERROMPIDA" : "FALHOU";
      const mensagens = {
        CONEXAO:
          "A foto não chegou à API. Confira a conexão e inicie outra tentativa.",
        CANCELAMENTO: "O envio da foto foi interrompido.",
        API_RECUSOU:
          "A API recusou o envio. Confira a sessão e a configuração do servidor antes de iniciar outra tentativa.",
      };
      transacao.update(referencia, {
        status,
        erro: {
          codigo: dados.codigo,
          etapa: "ENVIO",
          mensagem: mensagens[dados.codigo],
        },
        atualizadoEm: FieldValue.serverTimestamp(),
        finalizadoEm: FieldValue.serverTimestamp(),
      });
      return { status };
    }
    return { status: atual.status };
  });
});

exports.obterFotoAnalise = onCall(opcoes, async (requisicao) => {
  const { uid, perfil } = await autorizar(requisicao);
  entrada(requisicao.data, ["analiseId"]);
  if (!idValido(requisicao.data.analiseId))
    throw new HttpsError("invalid-argument", "Análise inválida.");
  const atual = (
    await banco.doc(`analises/${requisicao.data.analiseId}`).get()
  ).data();
  if (!atual || (atual.usuarioId !== uid && perfil.tipoUsuario !== "ADMIN"))
    throw new HttpsError("permission-denied", "Análise indisponível.");
  const prefixo = `analises/${atual.usuarioId}/${requisicao.data.analiseId}/`;
  if (
    atual.foto?.situacao !== "SALVA" ||
    !["foto.jpg", "foto.png", "foto.webp"].some(
      (nome) => atual.foto.caminho === `${prefixo}${nome}`,
    ) ||
    !/^\d+$/.test(atual.foto.geracao || "")
  )
    throw new HttpsError(
      "not-found",
      "A foto desta tentativa não está disponível.",
    );
  const expiraEm = Date.now() + 300000;
  const [url] = await bucket()
    .file(atual.foto.caminho)
    .getSignedUrl({
      version: "v4",
      action: "read",
      expires: expiraEm,
      queryParams: { generation: atual.foto.geracao },
    });
  return { url, expiraEm };
});

async function encerrarExpiradas() {
  for (const status of pendentes) {
    for (let pagina = 0; pagina < 5; pagina += 1) {
      const registros = await banco
        .collection("analises")
        .where("status", "==", status)
        .where("expiraEm", "<=", Timestamp.now())
        .orderBy("expiraEm")
        .limit(100)
        .get();
      for (const registro of registros.docs) {
        const valor = registro.data();
        let foto = valor.foto;
        if (
          foto?.situacao === "PENDENTE" &&
          foto.caminho &&
          foto.caminho.startsWith(`analises/${valor.usuarioId}/${registro.id}/`)
        ) {
          try {
            const [meta] = await bucket().file(foto.caminho).getMetadata();
            if (meta.metadata?.sha256 === foto.sha256)
              foto = {
                ...foto,
                situacao: "SALVA",
                geracao: String(meta.generation),
              };
          } catch (erro) {
            if (Number(erro.code) !== 404) throw erro;
          }
        }
        await banco.runTransaction(async (transacao) => {
          const atual = (await transacao.get(registro.ref)).data();
          if (
            !atual ||
            atual.status !== status ||
            atual.expiraEm.toMillis() > Date.now()
          )
            return;
          transacao.update(registro.ref, {
            status: "INTERROMPIDA",
            foto: atual.foto?.situacao === "SALVA" ? atual.foto : foto,
            erro: {
              codigo: "EXPIRADA",
              etapa: status === "AGUARDANDO_ENVIO" ? "ENVIO" : "PROCESSAMENTO",
              mensagem:
                "A tentativa foi interrompida antes da confirmação. Inicie outra análise.",
            },
            finalizadoEm: FieldValue.serverTimestamp(),
            atualizadoEm: FieldValue.serverTimestamp(),
          });
        });
      }
      if (registros.size < 100) break;
    }
  }
}

exports.encerrarAnalisesExpiradas = onSchedule(
  {
    ...opcoes,
    schedule: "every 5 minutes",
    timeZone: "America/Sao_Paulo",
    maxInstances: 1,
  },
  encerrarExpiradas,
);
exports.encerrarExpiradasParaTeste = encerrarExpiradas;

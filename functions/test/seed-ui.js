const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

if (
  process.env.GCLOUD_PROJECT !== "demo-safracerta" ||
  !process.env.FIRESTORE_EMULATOR_HOST ||
  !process.env.FIREBASE_AUTH_EMULATOR_HOST
) {
  throw new Error(
    "As contas de demonstração só podem ser criadas nos emuladores do projeto demo-safracerta.",
  );
}

initializeApp({ projectId: "demo-safracerta" });

async function preparar() {
  const pessoas = [
    { uid: "qa-admin", nomeCompleto: "Ana Costa", matricula: "00001", tipoUsuario: "ADMIN" },
    { uid: "qa-bruno", nomeCompleto: "Bruno Lima", matricula: "00002", tipoUsuario: "FUNCIONARIO" },
    { uid: "qa-carla", nomeCompleto: "Carla Souza", matricula: "00003", tipoUsuario: "FUNCIONARIO" },
  ];
  for (const pessoa of pessoas) {
    const email = `${pessoa.uid}@teste.local`;
    try {
      await getAuth().createUser({ uid: pessoa.uid, email, password: "Teste-local-123!" });
    } catch (erro) {
      if (erro.code !== "auth/uid-already-exists" && erro.code !== "auth/email-already-exists") throw erro;
    }
    const lote = getFirestore().batch();
    lote.set(getFirestore().doc(`usuarios/${pessoa.uid}`), {
      nomeCompleto: pessoa.nomeCompleto,
      matricula: pessoa.matricula,
      emailInstitucional: email,
      telefone: "",
      tipoUsuario: pessoa.tipoUsuario,
      statusConta: "ATIVO",
    });
    lote.set(getFirestore().doc(`login_por_matricula/${pessoa.matricula}`), { email, uid: pessoa.uid });
    await lote.commit();
  }
  console.log(
    "Contas locais preparadas. Admin: matrícula 00001; funcionário: 00002; senha de teste: Teste-local-123!",
  );
}

preparar().catch((erro) => {
  console.error(erro.message);
  process.exitCode = 1;
});

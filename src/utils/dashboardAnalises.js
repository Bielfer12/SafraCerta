// Cálculos do dashboard. Funções puras, sem Firebase nem React, para poderem ser
// testadas com `npm run test:dashboard`.
//
// Regras de leitura (ver PLANEJAMENTO_HISTORICO_ANALISES.md, seção 9):
// - gráficos de classificação usam somente análises CONCLUIDA;
// - falhas, interrupções e pendências são indicadores operacionais separados;
// - a pontuação do modelo não mede gravidade nem área afetada.

const DIA_MS = 86400000;
const MAXIMO_MESES = 24;

export const MOTIVOS_FALHA = Object.freeze({
  FOLHA_NAO_IDENTIFICADA: "Nenhuma folha identificada na foto",
  CONEXAO: "A foto não chegou à API",
  CANCELAMENTO: "Envio da foto interrompido",
  API_RECUSOU: "A API recusou o envio",
  EXPIRADA: "Tentativa encerrada sem confirmação",
  VALIDACAO: "Foto recusada na validação",
  ARMAZENAMENTO: "Falha ao guardar a foto",
  PROCESSAMENTO: "Falha ao executar o modelo",
});

const concluida = (item) => item?.status === "CONCLUIDA";
const semResultado = (item) =>
  item?.status === "FALHOU" || item?.status === "INTERROMPIDA";
const emAndamento = (item) =>
  item?.status === "AGUARDANDO_ENVIO" || item?.status === "EM_PROCESSAMENTO";

export const percentual = (parte, total) =>
  total > 0 ? Math.round((parte / total) * 100) : 0;

export function dataDoItem(item) {
  const bruto = item?.criadoEm;
  const data = typeof bruto?.toDate === "function" ? bruto.toDate() : bruto;
  return data instanceof Date && !Number.isNaN(data.getTime()) ? data : null;
}

export function inicioDoDia(data) {
  const resultado = new Date(data);
  resultado.setHours(0, 0, 0, 0);
  return resultado;
}

// "Últimos N dias" inclui hoje: 7 dias = hoje e os 6 dias anteriores.
export function inicioDoPeriodo(dias, agora = new Date()) {
  if (!dias) return null;
  const inicio = inicioDoDia(agora);
  inicio.setDate(inicio.getDate() - (dias - 1));
  return inicio;
}

export function formatarDuracao(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "Sem dados";
  if (ms < 60000) return `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
  const minutos = Math.floor(ms / 60000);
  const segundos = Math.round((ms % 60000) / 1000);
  return segundos === 60
    ? `${minutos + 1} min`
    : `${minutos} min ${String(segundos).padStart(2, "0")} s`;
}

export function calcularResumo(itens) {
  const concluidas = itens.filter(concluida);
  const falhas = itens.filter((item) => item?.status === "FALHOU").length;
  const interrompidas = itens.filter(
    (item) => item?.status === "INTERROMPIDA",
  ).length;
  const duracoes = concluidas
    .map((item) => item.duracaoProcessamentoMs)
    .filter((valor) => Number.isFinite(valor) && valor >= 0);
  const encerradas = concluidas.length + falhas + interrompidas;
  return {
    total: itens.length,
    concluidas: concluidas.length,
    falhas,
    interrompidas,
    naoConcluidas: falhas + interrompidas,
    emAndamento: itens.filter(emAndamento).length,
    taxaConclusao: encerradas
      ? percentual(concluidas.length, encerradas)
      : null,
    tempoMedioMs: duracoes.length
      ? duracoes.reduce((soma, valor) => soma + valor, 0) / duracoes.length
      : null,
  };
}

function contarClasses(itens) {
  const contagem = new Map();
  for (const item of itens.filter(concluida)) {
    const classe = item.resultado?.classe;
    if (typeof classe !== "string" || !classe) continue;
    const atual = contagem.get(classe) || {
      classe,
      nomeExibicao: item.resultado?.nome_exibicao || "",
      quantidade: 0,
    };
    atual.quantidade += 1;
    contagem.set(classe, atual);
  }
  return [...contagem.values()].sort(
    (a, b) => b.quantidade - a.quantidade || a.classe.localeCompare(b.classe),
  );
}

export function distribuirClassificacoes(itens) {
  const lista = contarClasses(itens);
  const classificadas = lista.reduce((soma, item) => soma + item.quantidade, 0);
  return {
    total: classificadas,
    semClassificacao: itens.filter(concluida).length - classificadas,
    itens: lista.map((item) => ({
      ...item,
      percentual: percentual(item.quantidade, classificadas),
    })),
  };
}

function agrupar(itens, chave, identificar) {
  const grupos = new Map();
  // Os itens chegam do mais recente para o mais antigo: o primeiro snapshot
  // encontrado é o mais atual daquele talhão/usuário.
  for (const item of itens) {
    const id = chave(item);
    if (!grupos.has(id)) {
      grupos.set(id, { id, ...identificar(item), itens: [] });
    }
    grupos.get(id).itens.push(item);
  }
  return [...grupos.values()].map(({ itens: lista, ...grupo }) => {
    const principal = contarClasses(lista)[0];
    const concluidas = lista.filter(concluida).length;
    return {
      ...grupo,
      total: lista.length,
      concluidas,
      naoConcluidas: lista.filter(semResultado).length,
      emAndamento: lista.filter(emAndamento).length,
      classePrincipal: principal
        ? {
            classe: principal.classe,
            nomeExibicao: principal.nomeExibicao,
            quantidade: principal.quantidade,
            deConcluidas: concluidas,
          }
        : null,
    };
  });
}

export function agruparPorTalhao(itens) {
  return agrupar(
    itens,
    (item) => item.talhaoId || "sem-talhao",
    (item) => ({
      codigo: item.talhaoSnapshot?.codigo || "Sem código",
      nome: item.talhaoSnapshot?.nome || "Talhão não identificado",
      propriedadeNome: item.talhaoSnapshot?.propriedadeNome || "",
    }),
  ).sort((a, b) => b.total - a.total || a.codigo.localeCompare(b.codigo));
}

export function agruparPorUsuario(itens) {
  return agrupar(
    itens,
    (item) => item.usuarioId || "sem-usuario",
    (item) => ({
      nome: item.usuarioSnapshot?.nomeCompleto || "Usuário não identificado",
      matricula: item.usuarioSnapshot?.matricula || "",
    }),
  ).sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
}

export function agruparFalhas(itens) {
  const grupos = new Map();
  for (const item of itens.filter(semResultado)) {
    const codigo = item.erro?.codigo || "SEM_CODIGO";
    const atual = grupos.get(codigo) || {
      codigo,
      rotulo:
        MOTIVOS_FALHA[codigo] ||
        (codigo === "SEM_CODIGO"
          ? "Motivo não informado"
          : `Outro motivo (${codigo})`),
      quantidade: 0,
    };
    atual.quantidade += 1;
    grupos.set(codigo, atual);
  }
  return [...grupos.values()].sort(
    (a, b) => b.quantidade - a.quantidade || a.rotulo.localeCompare(b.rotulo),
  );
}

const dois = (valor) => String(valor).padStart(2, "0");

function inicioDaSemana(data) {
  const resultado = inicioDoDia(data);
  resultado.setDate(resultado.getDate() - ((resultado.getDay() + 6) % 7));
  return resultado;
}

function inicioDoMes(data) {
  const resultado = inicioDoDia(data);
  resultado.setDate(1);
  return resultado;
}

const GRANULARIDADES = {
  dia: {
    truncar: inicioDoDia,
    avancar: (data) => data.setDate(data.getDate() + 1),
    rotulo: (data) => `${dois(data.getDate())}/${dois(data.getMonth() + 1)}`,
    completo: (data) =>
      `${dois(data.getDate())}/${dois(data.getMonth() + 1)}/${data.getFullYear()}`,
  },
  semana: {
    truncar: inicioDaSemana,
    avancar: (data) => data.setDate(data.getDate() + 7),
    rotulo: (data) => `${dois(data.getDate())}/${dois(data.getMonth() + 1)}`,
    completo: (data) =>
      `semana de ${dois(data.getDate())}/${dois(data.getMonth() + 1)}/${data.getFullYear()}`,
  },
  mes: {
    truncar: inicioDoMes,
    avancar: (data) => data.setMonth(data.getMonth() + 1),
    rotulo: (data) =>
      `${dois(data.getMonth() + 1)}/${String(data.getFullYear()).slice(-2)}`,
    completo: (data) => `${dois(data.getMonth() + 1)}/${data.getFullYear()}`,
  },
};

export function escolherGranularidade(dias) {
  return dias <= 31 ? "dia" : dias <= 120 ? "semana" : "mes";
}

// Distribui as análises por dia, semana ou mês, incluindo períodos sem análises.
export function serieTemporal(itens, { inicio = null, fim = new Date() } = {}) {
  const datas = itens.map(dataDoItem).filter(Boolean);
  if (!datas.length) return { granularidade: "dia", pontos: [] };
  const primeira = inicio || new Date(Math.min(...datas.map((d) => d.getTime())));
  const dias =
    Math.max(
      0,
      Math.round((inicioDoDia(fim) - inicioDoDia(primeira)) / DIA_MS),
    ) + 1;
  const granularidade = escolherGranularidade(dias);
  const { truncar, avancar, rotulo, completo } = GRANULARIDADES[granularidade];

  const pontos = [];
  for (
    const cursor = truncar(primeira);
    cursor <= fim;
    avancar(cursor)
  ) {
    pontos.push({
      chave: cursor.getTime(),
      rotulo: rotulo(cursor),
      rotuloCompleto: completo(cursor),
      concluidas: 0,
      semResultado: 0,
      emAndamento: 0,
      total: 0,
    });
  }
  const visiveis =
    granularidade === "mes" ? pontos.slice(-MAXIMO_MESES) : pontos;
  const porChave = new Map(visiveis.map((ponto) => [ponto.chave, ponto]));
  for (const item of itens) {
    const data = dataDoItem(item);
    const ponto = data && porChave.get(truncar(data).getTime());
    if (!ponto) continue;
    ponto.total += 1;
    if (concluida(item)) ponto.concluidas += 1;
    else if (emAndamento(item)) ponto.emAndamento += 1;
    else ponto.semResultado += 1;
  }
  return { granularidade, pontos: visiveis };
}

export function montarPainel(itens, { inicio = null, fim = new Date() } = {}) {
  return {
    resumo: calcularResumo(itens),
    classificacoes: distribuirClassificacoes(itens),
    serie: serieTemporal(itens, { inicio, fim }),
    talhoes: agruparPorTalhao(itens),
    usuarios: agruparPorUsuario(itens),
    falhas: agruparFalhas(itens),
  };
}

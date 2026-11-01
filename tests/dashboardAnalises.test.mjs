import assert from "node:assert/strict";
import { test } from "node:test";
import {
  agruparFalhas,
  agruparPorTalhao,
  agruparPorUsuario,
  calcularResumo,
  distribuirClassificacoes,
  formatarDuracao,
  inicioDoPeriodo,
  montarPainel,
  serieTemporal,
} from "../src/utils/dashboardAnalises.js";

let contador = 0;
const em = (ano, mes, dia, hora = 10) => new Date(ano, mes - 1, dia, hora, 0);
const analise = (dados) => ({
  id: `a${++contador}`,
  status: "CONCLUIDA",
  usuarioId: "u1",
  talhaoId: "t1",
  usuarioSnapshot: { nomeCompleto: "Ana", matricula: "100" },
  talhaoSnapshot: { codigo: "TAL-001", nome: "Baixada", propriedadeNome: "Sítio" },
  resultado: { classe: "healthy", nome_exibicao: "Saudável", pontuacao: 0.9 },
  duracaoProcessamentoMs: 2000,
  criadoEm: { toDate: () => em(2026, 10, 20) },
  ...dados,
});
const falha = (codigo, extra = {}) =>
  analise({
    status: "FALHOU",
    resultado: null,
    duracaoProcessamentoMs: 500,
    erro: { codigo, etapa: "PROCESSAMENTO", mensagem: "x" },
    ...extra,
  });

test("resumo separa concluídas, falhas, interrompidas e pendentes", () => {
  const itens = [
    analise({}),
    analise({ duracaoProcessamentoMs: 4000 }),
    falha("CONEXAO"),
    analise({ status: "INTERROMPIDA", resultado: null }),
    analise({ status: "EM_PROCESSAMENTO", resultado: null }),
  ];
  const resumo = calcularResumo(itens);
  assert.equal(resumo.total, 5);
  assert.equal(resumo.concluidas, 2);
  assert.equal(resumo.falhas, 1);
  assert.equal(resumo.interrompidas, 1);
  assert.equal(resumo.naoConcluidas, 2);
  assert.equal(resumo.emAndamento, 1);
  // pendente não entra na taxa: 2 concluídas de 4 encerradas
  assert.equal(resumo.taxaConclusao, 50);
  // o tempo médio considera apenas análises concluídas (2000 e 4000)
  assert.equal(resumo.tempoMedioMs, 3000);
});

test("resumo não inventa taxa nem tempo quando faltam dados", () => {
  const resumo = calcularResumo([
    analise({ status: "AGUARDANDO_ENVIO", resultado: null }),
    analise({ duracaoProcessamentoMs: null }),
    analise({ duracaoProcessamentoMs: -5 }),
  ]);
  assert.equal(resumo.tempoMedioMs, null);
  assert.equal(calcularResumo([]).taxaConclusao, null);
  assert.equal(calcularResumo([]).tempoMedioMs, null);
  assert.equal(calcularResumo([]).total, 0);
});

test("classificações usam somente análises concluídas", () => {
  const itens = [
    analise({}),
    analise({}),
    analise({ resultado: { classe: "brown_spot", nome_exibicao: "Brown spot" } }),
    // uma falha nunca entra na distribuição, mesmo com resultado residual
    falha("PROCESSAMENTO", { resultado: { classe: "brown_spot" } }),
    analise({ status: "EM_PROCESSAMENTO", resultado: { classe: "frog_eye" } }),
    // concluída sem classe legível fica fora do gráfico, mas é contada à parte
    analise({ resultado: {} }),
  ];
  const { itens: classes, total, semClassificacao } =
    distribuirClassificacoes(itens);
  assert.equal(total, 3);
  assert.equal(semClassificacao, 1);
  assert.deepEqual(
    classes.map((c) => [c.classe, c.quantidade, c.percentual]),
    [
      ["healthy", 2, 67],
      ["brown_spot", 1, 33],
    ],
  );
});

test("desempata classes por nome para manter a ordem estável", () => {
  const classes = distribuirClassificacoes([
    analise({ resultado: { classe: "tmv" } }),
    analise({ resultado: { classe: "cmv" } }),
  ]).itens;
  assert.deepEqual(
    classes.map((c) => c.classe),
    ["cmv", "tmv"],
  );
});

test("talhões usam o snapshot mais recente e apontam a classe mais frequente", () => {
  const itens = [
    // mais recente primeiro, como na consulta ordenada por criadoEm desc
    analise({ talhaoSnapshot: { codigo: "TAL-001", nome: "Baixada nova", propriedadeNome: "Sítio" } }),
    analise({ resultado: { classe: "brown_spot" } }),
    analise({ resultado: { classe: "brown_spot" } }),
    falha("CONEXAO"),
    analise({
      talhaoId: "t2",
      talhaoSnapshot: { codigo: "TAL-002", nome: "Morro", propriedadeNome: "Sítio" },
    }),
  ];
  const [primeiro, segundo] = agruparPorTalhao(itens);
  assert.equal(primeiro.id, "t1");
  assert.equal(primeiro.nome, "Baixada nova");
  assert.equal(primeiro.total, 4);
  assert.equal(primeiro.concluidas, 3);
  assert.equal(primeiro.naoConcluidas, 1);
  assert.equal(primeiro.classePrincipal.classe, "brown_spot");
  assert.equal(primeiro.classePrincipal.quantidade, 2);
  assert.equal(primeiro.classePrincipal.deConcluidas, 3);
  assert.equal(segundo.id, "t2");
  assert.equal(segundo.total, 1);
});

test("talhão só com falhas não tem classe principal", () => {
  const [grupo] = agruparPorTalhao([falha("CONEXAO")]);
  assert.equal(grupo.classePrincipal, null);
  assert.equal(grupo.concluidas, 0);
});

test("usuários ficam agrupados por UID, com o nome do registro mais recente", () => {
  const itens = [
    analise({ usuarioId: "u2", usuarioSnapshot: { nomeCompleto: "Bruno", matricula: "200" } }),
    analise({}),
    analise({}),
  ];
  const [primeiro, segundo] = agruparPorUsuario(itens);
  assert.deepEqual([primeiro.id, primeiro.nome, primeiro.total], ["u1", "Ana", 2]);
  assert.deepEqual([segundo.id, segundo.matricula], ["u2", "200"]);
});

test("falhas são agrupadas por motivo e códigos desconhecidos aparecem sem esconder dados", () => {
  const itens = [
    falha("CONEXAO"),
    falha("CONEXAO"),
    falha("FOLHA_NAO_IDENTIFICADA"),
    analise({ status: "INTERROMPIDA", resultado: null, erro: { codigo: "EXPIRADA" } }),
    analise({ status: "FALHOU", resultado: null, erro: null }),
    falha("CODIGO_NOVO"),
    analise({}),
  ];
  const motivos = agruparFalhas(itens);
  assert.equal(motivos[0].codigo, "CONEXAO");
  assert.equal(motivos[0].quantidade, 2);
  assert.equal(motivos.reduce((soma, m) => soma + m.quantidade, 0), 6);
  assert.ok(motivos.some((m) => m.rotulo === "Motivo não informado"));
  assert.ok(motivos.some((m) => m.rotulo === "Outro motivo (CODIGO_NOVO)"));
  assert.ok(motivos.some((m) => m.rotulo === "Tentativa encerrada sem confirmação"));
});

test("últimos 7 dias geram exatamente 7 barras diárias, inclusive dias sem análise", () => {
  const fim = em(2026, 10, 22, 15);
  const inicio = inicioDoPeriodo(7, fim);
  assert.equal(inicio.getDate(), 16);
  const itens = [
    analise({ criadoEm: { toDate: () => em(2026, 10, 22, 9) } }),
    analise({ criadoEm: { toDate: () => em(2026, 10, 22, 11) }, status: "FALHOU", resultado: null }),
    analise({ criadoEm: { toDate: () => em(2026, 10, 18) } }),
  ];
  const { granularidade, pontos } = serieTemporal(itens, { inicio, fim });
  assert.equal(granularidade, "dia");
  assert.equal(pontos.length, 7);
  assert.equal(pontos[0].rotulo, "16/10");
  assert.equal(pontos.at(-1).rotulo, "22/10");
  const hoje = pontos.at(-1);
  assert.deepEqual([hoje.total, hoje.concluidas, hoje.semResultado], [2, 1, 1]);
  assert.equal(pontos[2].total, 1); // 18/10
  assert.equal(pontos[1].total, 0); // 17/10, sem análises
  assert.equal(pontos.reduce((soma, p) => soma + p.total, 0), 3);
});

test("90 dias usam semanas que começam na segunda-feira", () => {
  const fim = em(2026, 10, 22);
  const inicio = inicioDoPeriodo(90, fim);
  const { granularidade, pontos } = serieTemporal(
    [analise({ criadoEm: { toDate: () => em(2026, 10, 21) } })],
    { inicio, fim },
  );
  assert.equal(granularidade, "semana");
  assert.ok(pontos.length >= 13 && pontos.length <= 14);
  // 19/10/2026 é segunda-feira e 21/10 pertence a essa semana
  const semana = pontos.find((p) => p.rotulo === "19/10");
  assert.equal(semana.total, 1);
  assert.equal(new Date(semana.chave).getDay(), 1);
});

test("todo o período longo agrupa por mês e limita a 24 meses", () => {
  const fim = em(2026, 10, 22);
  const itens = [
    analise({ criadoEm: { toDate: () => em(2026, 10, 2) } }),
    analise({ criadoEm: { toDate: () => em(2026, 9, 30) } }),
    analise({ criadoEm: { toDate: () => em(2020, 1, 15) } }),
  ];
  const { granularidade, pontos } = serieTemporal(itens, { inicio: null, fim });
  assert.equal(granularidade, "mes");
  assert.equal(pontos.length, 24);
  assert.equal(pontos.at(-1).rotulo, "10/26");
  assert.equal(pontos.at(-1).total, 1);
  assert.equal(pontos.at(-2).total, 1);
  // a análise de 2020 está fora da janela e não é atribuída a outro mês
  assert.equal(pontos.reduce((soma, p) => soma + p.total, 0), 2);
});

test("análises sem data ainda não confirmada não quebram a série", () => {
  const fim = em(2026, 10, 22);
  const { pontos } = serieTemporal(
    [analise({ criadoEm: null }), analise({ criadoEm: { toDate: () => em(2026, 10, 22) } })],
    { inicio: inicioDoPeriodo(7, fim), fim },
  );
  assert.equal(pontos.reduce((soma, p) => soma + p.total, 0), 1);
  assert.deepEqual(serieTemporal([analise({ criadoEm: null })]).pontos, []);
});

test("lista vazia produz um painel vazio e consistente", () => {
  const painel = montarPainel([]);
  assert.equal(painel.resumo.total, 0);
  assert.deepEqual(painel.classificacoes.itens, []);
  assert.deepEqual(painel.serie.pontos, []);
  assert.deepEqual(painel.talhoes, []);
  assert.deepEqual(painel.falhas, []);
});

test("formata duração em segundos e minutos", () => {
  assert.equal(formatarDuracao(3200), "3,2 s");
  assert.equal(formatarDuracao(65000), "1 min 05 s");
  assert.equal(formatarDuracao(119700), "2 min");
  assert.equal(formatarDuracao(null), "Sem dados");
  assert.equal(formatarDuracao(-1), "Sem dados");
});

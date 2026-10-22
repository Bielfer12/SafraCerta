const NOMES_EM_PORTUGUES = Object.freeze({
  anthracnose: "Antracnose",
  black_shank: "Canela-preta",
  brown_spot: "Mancha-parda",
  cmv: "Mosaico do pepino (CMV)",
  frog_eye: "Mancha olho-de-rã",
  genetic_abnormality: "Anomalia genética",
  healthy: "Folha saudável",
  nematodes: "Danos por nematoides",
  potato_tuber_moth: "Traça-da-batata",
  pvy: "Mosaico causado pelo vírus Y (PVY)",
  sunscald: "Queimadura solar",
  target_spot: "Mancha-alvo",
  tmv: "Mosaico do tabaco (TMV)",
  tswv: "Vira-cabeça (TSWV)",
  weather_fleck: "Danos por ozônio",
  wildfire: "Queima bacteriana",
});

export const CLASSIFICACOES = Object.entries(NOMES_EM_PORTUGUES).map(([valor, nome]) => ({ valor, nome }));

const formatarNomeTecnico = (valor) =>
  valor
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (letra) => letra.toLocaleUpperCase("pt-BR"));

export const obterNomeClassificacao = (classe, nomeExibicao) => {
  const chave = String(classe ?? "").trim().toLowerCase();

  if (NOMES_EM_PORTUGUES[chave]) {
    return NOMES_EM_PORTUGUES[chave];
  }

  const nomeRecebido = String(nomeExibicao ?? "").trim();
  const nomeFallback = nomeRecebido || chave;

  return formatarNomeTecnico(nomeFallback) || "Classificação não identificada";
};

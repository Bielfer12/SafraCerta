export function caixaValida(caixa) {
  return Array.isArray(caixa) && caixa.length === 4
    && caixa.every((valor) => Number.isFinite(valor) && valor >= 0 && valor <= 1)
    && caixa[0] < caixa[2] && caixa[1] < caixa[3];
}

export function analiseValida(analise) {
  const previsaoValida = (item) => item && Number.isInteger(item.classe_id)
    && item.classe_id >= 0 && typeof item.classe === "string"
    && typeof item.nome_exibicao === "string"
    && Number.isFinite(item.pontuacao) && item.pontuacao >= 0 && item.pontuacao <= 1;
  if (!previsaoValida(analise) || !Array.isArray(analise.top3) || !analise.top3.every(previsaoValida)) return false;
  if (analise.versao_resposta === undefined) {
    return analise.imagem === undefined && analise.deteccao_folha === undefined && analise.deteccao_lesoes === undefined;
  }
  if (analise.versao_resposta !== 2 || !Number.isInteger(analise.imagem?.largura)
    || !Number.isInteger(analise.imagem?.altura) || analise.imagem.largura <= 0 || analise.imagem.altura <= 0) return false;
  for (const [nome, classe] of [["deteccao_folha", "folha"], ["deteccao_lesoes", "lesao"]]) {
    const deteccao = analise[nome];
    if (!deteccao || !["concluido", "nao_disponivel", "erro"].includes(deteccao.estado)
      || !Array.isArray(deteccao.itens) || deteccao.itens.length > 100) return false;
    if (deteccao.estado !== "concluido" && deteccao.itens.length) return false;
    const ids = new Set();
    for (const item of deteccao.itens) {
      if (!item || !Number.isInteger(item.id) || item.id <= 0 || ids.has(item.id)
        || item.classe !== classe || !Number.isFinite(item.pontuacao)
        || item.pontuacao < 0 || item.pontuacao > 1 || !caixaValida(item.caixa_xyxyn)) return false;
      ids.add(item.id);
    }
  }
  return analise.deteccao_folha.estado === "concluido" && analise.deteccao_folha.itens.length === 1;
}

export function calcularMarcacao(caixa, imagem, visor) {
  if (!caixaValida(caixa) || ![imagem?.largura, imagem?.altura, visor?.largura, visor?.altura]
    .every((valor) => Number.isFinite(valor) && valor > 0)) return null;
  const escala = Math.min(visor.largura / imagem.largura, visor.altura / imagem.altura);
  const largura = imagem.largura * escala;
  const altura = imagem.altura * escala;
  return {
    left: (visor.largura - largura) / 2 + caixa[0] * largura,
    top: (visor.altura - altura) / 2 + caixa[1] * altura,
    width: (caixa[2] - caixa[0]) * largura,
    height: (caixa[3] - caixa[1]) * altura,
  };
}

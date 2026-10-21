import assert from "node:assert/strict";
import { test } from "node:test";
import { analiseValida, caixaValida, calcularMarcacao } from "../src/utils/localizacaoFolha.js";

const previsao = { classe_id: 6, classe: "healthy", nome_exibicao: "Saudável", pontuacao: 0.9 };
const antiga = () => ({ ...previsao, top3: [previsao] });
const atual = () => ({
  ...antiga(), versao_resposta: 2, imagem: { largura: 1200, altura: 1600 },
  deteccao_folha: { estado: "concluido", itens: [{ id: 1, classe: "folha", pontuacao: 0.8, caixa_xyxyn: [0.1, 0.1, 0.9, 0.9] }] },
  deteccao_lesoes: { estado: "nao_disponivel", itens: [] },
});

test("preserva classificação da API antiga sem fabricar marcações", () => {
  assert.equal(analiseValida(antiga()), true);
  assert.equal(analiseValida({ ...antiga(), imagem: { largura: 1, altura: 1 } }), false);
  assert.equal(analiseValida(null), false);
});

test("distingue lesões indisponíveis, nenhum resultado e falha parcial", () => {
  for (const estado of ["nao_disponivel", "concluido", "erro"]) {
    const dados = atual();
    dados.deteccao_lesoes.estado = estado;
    assert.equal(analiseValida(dados), true);
  }
  const dados = atual();
  dados.deteccao_lesoes.itens = [{ id: 1, classe: "lesao", pontuacao: 0.7, caixa_xyxyn: [0.3, 0.3, 0.4, 0.4] }];
  assert.equal(analiseValida(dados), false);
  dados.deteccao_lesoes.estado = "concluido";
  assert.equal(analiseValida(dados), true);
});

test("recusa coordenadas invertidas, fora da imagem e não finitas", () => {
  for (const caixa of [[0.8, 0.1, 0.2, 0.9], [-0.1, 0, 1, 1], [0, 0, 1.01, 1], [0, 0, NaN, 1], [0, 0, Infinity, 1], [0, 0, 0, 1], [0, 0, 1]]) {
    assert.equal(caixaValida(caixa), false);
    const dados = atual();
    dados.deteccao_folha.itens[0].caixa_xyxyn = caixa;
    assert.equal(analiseValida(dados), false);
  }
});

test("rejeita metadados incompatíveis e IDs de regiões repetidos", () => {
  const dados = atual();
  dados.imagem.largura = 0;
  assert.equal(analiseValida(dados), false);
  dados.imagem.largura = 1200;
  dados.versao_resposta = 3;
  assert.equal(analiseValida(dados), false);
  dados.versao_resposta = 2;
  dados.deteccao_lesoes = { estado: "concluido", itens: [
    { id: 1, classe: "lesao", pontuacao: 0.7, caixa_xyxyn: [0, 0, 0.2, 0.2] },
    { id: 1, classe: "lesao", pontuacao: 0.8, caixa_xyxyn: [0.3, 0.3, 0.4, 0.4] },
  ] };
  assert.equal(analiseValida(dados), false);
});

test("imagem vertical centralizada conserva as margens laterais", () => {
  assert.deepEqual(calcularMarcacao([0, 0, 1, 1], { largura: 100, altura: 200 }, { largura: 300, altura: 400 }),
    { left: 50, top: 0, width: 200, height: 400 });
});

test("imagem horizontal centralizada conserva as margens verticais", () => {
  assert.deepEqual(calcularMarcacao([0.25, 0.25, 0.75, 0.75], { largura: 400, altura: 200 }, { largura: 300, altura: 400 }),
    { left: 75, top: 162.5, width: 150, height: 75 });
});

test("recalcula a caixa ao ampliar e ignora o visor ainda não medido", () => {
  assert.equal(calcularMarcacao([0, 0, 1, 1], { largura: 100, altura: 200 }, { largura: 0, altura: 0 }), null);
  const inline = calcularMarcacao([0.2, 0.1, 0.8, 0.9], { largura: 100, altura: 200 }, { largura: 200, altura: 400 });
  const ampliada = calcularMarcacao([0.2, 0.1, 0.8, 0.9], { largura: 100, altura: 200 }, { largura: 400, altura: 800 });
  for (const campo of ["left", "top", "width", "height"]) assert.equal(ampliada[campo], inline[campo] * 2);
});

// Script que audita a interface (issue #65).
// Lê o código das telas e lista problemas de acessibilidade e usabilidade.
//
//   npm run audit:interface                 resumo por tela
//   npm run audit:interface -- --detalhes   lista cada ocorrência
//   npm run audit:interface -- --falhar     sai com erro se tiver ocorrência grave
//   npm run audit:interface -- src/screens/Login.js
//
// Regras:
//   A1  botão só com ícone e sem accessibilityLabel (alta)
//   A2  botão sem onPress (alta)
//   A3  alvo de toque menor que 48px (alta abaixo de 40, média até 47)
//   A3b alvo sem altura mínima e com conteúdo pequeno (baixa)
//   A5  input sem accessibilityLabel (média)
//   A6  Modal sem onRequestClose, o voltar do android não fecha (alta)
//   A7  ScrollView com input sem keyboardShouldPersistTaps (alta)
//   A8  altura fixa em View com texto, corta com fonte grande (baixa)
//   A9  texto menor que 14px (alta abaixo de 12, média de 12 a 13)
//   A10 tela com input e sem KeyboardAvoidingView (média)
//   A11 contraste estimado abaixo do mínimo WCAG (média)
//   A4  botão sem accessibilityRole, só com --estrito (baixa)
//
// É análise estática: não enxerga o layout real nem cor herdada do componente
// pai. Texto claro é tratado como se estivesse em fundo escuro e não é avaliado.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const TOQUE = new Set([
  "Pressable",
  "TouchableOpacity",
  "TouchableHighlight",
  "TouchableWithoutFeedback",
]);
const FUNDOS_CLAROS = ["#F7F8F4", "#FFFFFF", "#FAFAF5"];
const ALVO_MINIMO = 48;
const FONTE_MINIMA = 14;

const hex = (cor) => {
  let h = cor.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const luminancia = ([r, g, b]) => {
  const f = (v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
export const contraste = (a, b) => {
  const [claro, escuro] = [luminancia(hex(a)), luminancia(hex(b))].sort(
    (x, y) => y - x,
  );
  return (claro + 0.05) / (escuro + 0.05);
};

const literal = (no) => {
  if (!no) return undefined;
  if (ts.isNumericLiteral(no)) return Number(no.text);
  if (ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no))
    return no.text;
  if (ts.isPrefixUnaryExpression(no) && ts.isNumericLiteral(no.operand))
    return -Number(no.operand.text);
  return undefined;
};

function lerEstilos(sf) {
  const estilos = {};
  const visitar = (no) => {
    if (
      ts.isVariableDeclaration(no) &&
      no.name.getText() === "styles" &&
      no.initializer &&
      ts.isCallExpression(no.initializer)
    ) {
      const objeto = no.initializer.arguments[0];
      if (objeto && ts.isObjectLiteralExpression(objeto)) {
        for (const p of objeto.properties) {
          if (!ts.isPropertyAssignment(p) || !ts.isObjectLiteralExpression(p.initializer))
            continue;
          const props = {};
          for (const q of p.initializer.properties)
            if (ts.isPropertyAssignment(q))
              props[q.name.getText()] = literal(q.initializer);
          estilos[p.name.getText()] = props;
        }
      }
    }
    ts.forEachChild(no, visitar);
  };
  visitar(sf);
  return estilos;
}

const nomeDoElemento = (el) =>
  (ts.isJsxElement(el) ? el.openingElement.tagName : el.tagName).getText();

function atributos(el) {
  const lista = (ts.isJsxElement(el) ? el.openingElement : el).attributes
    .properties;
  const mapa = {};
  for (const p of lista) if (ts.isJsxAttribute(p)) mapa[p.name.getText()] = p.initializer;
  return mapa;
}

function nomesDeEstilo(expressao) {
  const nomes = [];
  const visitar = (no) => {
    if (ts.isPropertyAccessExpression(no) && no.expression.getText() === "styles")
      nomes.push(no.name.text);
    ts.forEachChild(no, visitar);
  };
  if (expressao) visitar(expressao);
  return nomes;
}

function temTexto(el) {
  let achou = false;
  const visitar = (no) => {
    if (ts.isJsxText(no) && no.getText().trim()) achou = true;
    if ((ts.isJsxElement(no) || ts.isJsxSelfClosingElement(no)) && nomeDoElemento(no) === "Text")
      achou = true;
    ts.forEachChild(no, visitar);
  };
  if (ts.isJsxElement(el)) el.children.forEach(visitar);
  return achou;
}

function contem(el, nomeProcurado) {
  let achou = false;
  const visitar = (no) => {
    if ((ts.isJsxElement(no) || ts.isJsxSelfClosingElement(no)) && nomeDoElemento(no) === nomeProcurado)
      achou = true;
    ts.forEachChild(no, visitar);
  };
  if (ts.isJsxElement(el)) el.children.forEach(visitar);
  return achou;
}

function folgaDeToque(inicializador) {
  const expr = inicializador?.expression;
  if (!expr) return { vertical: 0, horizontal: 0 };
  if (ts.isNumericLiteral(expr)) {
    const n = Number(expr.text);
    return { vertical: 2 * n, horizontal: 2 * n };
  }
  if (ts.isObjectLiteralExpression(expr)) {
    const v = {};
    for (const p of expr.properties)
      if (ts.isPropertyAssignment(p)) v[p.name.getText()] = literal(p.initializer) || 0;
    return {
      vertical: (v.top || 0) + (v.bottom || 0),
      horizontal: (v.left || 0) + (v.right || 0),
    };
  }
  return { vertical: 0, horizontal: 0 };
}

export function auditarCodigo(codigo, nomeDoArquivo = "arquivo.js", { estrito = false } = {}) {
  const sf = ts.createSourceFile(
    nomeDoArquivo,
    codigo,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.JSX,
  );
  const achados = [];
  const registrar = (no, regra, gravidade, mensagem) => {
    const { line } = sf.getLineAndCharacterOfPosition(no ? no.getStart() : 0);
    achados.push({ arquivo: nomeDoArquivo, linha: no ? line + 1 : 0, regra, gravidade, mensagem });
  };

  const estilos = lerEstilos(sf);
  const mesclar = (nomes) => Object.assign({}, ...nomes.map((n) => estilos[n] || {}));
  const temCampo = codigo.includes("<TextInput");
  const usaKAV = codigo.includes("<KeyboardAvoidingView");
  const fontes = {};

  const visitar = (no) => {
    if (ts.isJsxElement(no) || ts.isJsxSelfClosingElement(no)) {
      const tag = nomeDoElemento(no);
      const attrs = atributos(no);
      const estilo = mesclar(nomesDeEstilo(attrs.style?.expression ?? attrs.style));

      if (TOQUE.has(tag)) {
        // botão vazio (ex.: fundo transparente que fecha o menu) não precisa de nome
        const comNome =
          Boolean(attrs.accessibilityLabel) || temTexto(no) || ts.isJsxSelfClosingElement(no);
        if (!comNome)
          registrar(no, "A1", "alta", "Botão só com ícone e sem accessibilityLabel: o leitor de tela não sabe o que ele faz.");
        if (!(attrs.onPress || attrs.onPressIn || attrs.onLongPress) && tag !== "TouchableWithoutFeedback")
          registrar(no, "A2", "alta", "Botão sem onPress: toca e nada acontece.");
        const folga = folgaDeToque(attrs.hitSlop);
        const altura = Math.max(estilo.height ?? 0, estilo.minHeight ?? 0);
        const temAltura = estilo.height !== undefined || estilo.minHeight !== undefined;
        if (temAltura && altura + folga.vertical < ALVO_MINIMO) {
          const total = altura + folga.vertical;
          registrar(no, "A3", total < 40 ? "alta" : "média",
            `Alvo de toque com ${altura} px de altura${folga.vertical ? ` (+${folga.vertical} de hitSlop)` : ""}; o mínimo recomendado é ${ALVO_MINIMO}.`);
        } else if (!temAltura && temTexto(no)) {
          const estimada = (estilo.paddingVertical ?? estilo.padding ?? 0) * 2 + 14 * 1.4;
          if (estimada < 44)
            registrar(no, "A3b", "baixa", `Sem altura mínima; a altura depende do conteúdo (~${Math.round(estimada)} px estimados).`);
        }
        if (estrito && !attrs.accessibilityRole)
          registrar(no, "A4", "baixa", 'Sem accessibilityRole: o leitor de tela não anuncia "botão".');
      }
      if (tag === "TextInput" && !attrs.accessibilityLabel)
        registrar(no, "A5", "média", "Campo de texto sem accessibilityLabel (o placeholder some ao digitar).");
      if (tag === "Modal" && !attrs.onRequestClose)
        registrar(no, "A6", "alta", "Modal sem onRequestClose: o botão Voltar do Android não fecha.");
      if (tag === "ScrollView" && contem(no, "TextInput") && !attrs.keyboardShouldPersistTaps)
        registrar(no, "A7", "alta", 'Rolagem com campo de texto sem keyboardShouldPersistTaps="handled": com o teclado aberto, o primeiro toque num botão só fecha o teclado.');
      if (tag === "Text") {
        const tamanho = estilo.fontSize;
        if (tamanho !== undefined && tamanho < FONTE_MINIMA)
          for (const nome of nomesDeEstilo(attrs.style?.expression ?? attrs.style)) {
            const chave = `${nome}|${tamanho}`;
            (fontes[chave] ||= []).push(sf.getLineAndCharacterOfPosition(no.getStart()).line + 1);
          }
      }
      if (tag === "View" && estilo.height >= 20 && estilo.height < 120 && temTexto(no))
        registrar(no, "A8", "baixa", `Altura fixa (${estilo.height}) em contêiner com texto: com fonte maior do sistema o texto pode ser cortado; prefira minHeight.`);
    }
    ts.forEachChild(no, visitar);
  };
  visitar(sf);

  for (const [chave, linhas] of Object.entries(fontes)) {
    const [nome, tamanho] = chave.split("|");
    achados.push({
      arquivo: nomeDoArquivo, linha: linhas[0], regra: "A9",
      gravidade: Number(tamanho) < 12 ? "alta" : "média",
      mensagem: `Texto de ${tamanho} px (estilo "${nome}", ${linhas.length} uso${linhas.length > 1 ? "s" : ""}); abaixo de ${FONTE_MINIMA} px fica difícil de ler ao sol.`,
    });
  }
  if (temCampo && !usaKAV)
    registrar(null, "A10", "média", "Tem campos de texto e não usa KeyboardAvoidingView: o teclado pode cobrir campos e botões.");

  for (const [nome, e] of Object.entries(estilos)) {
    if (typeof e.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(e.color) || e.fontSize === undefined) continue;
    if (luminancia(hex(e.color)) > 0.6) continue; // texto claro, deve estar em fundo escuro
    const fundos = typeof e.backgroundColor === "string" && /^#[0-9a-fA-F]{6}$/.test(e.backgroundColor)
      ? [e.backgroundColor] : FUNDOS_CLAROS;
    const pior = Math.min(...fundos.map((f) => contraste(e.color, f)));
    const grande = e.fontSize >= 18 || (e.fontSize >= 14 && Number(e.fontWeight) >= 700);
    const exigido = grande ? 3 : 4.5;
    if (pior < exigido)
      registrar(null, "A11", "média", `Contraste estimado de ${pior.toFixed(2)}:1 em "${nome}" (cor ${e.color}); o mínimo WCAG é ${exigido}:1.`);
  }
  return achados;
}

function arquivosPadrao(raiz) {
  const pastas = ["src/screens", "src/components"];
  return pastas.flatMap((pasta) => {
    const dir = path.join(raiz, pasta);
    return fs.existsSync(dir)
      ? fs.readdirSync(dir).filter((f) => f.endsWith(".js")).map((f) => path.join(pasta, f))
      : [];
  });
}

function executar(argv) {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const opcoes = new Set(argv.filter((a) => a.startsWith("--")));
  const indicados = argv.filter((a) => !a.startsWith("--"));
  const arquivos = indicados.length ? indicados : arquivosPadrao(raiz);
  const ordem = { alta: 0, média: 1, baixa: 2 };
  let graves = 0;

  console.log("Auditoria de interface (alta / média / baixa)\n");
  for (const arquivo of arquivos) {
    const completo = path.resolve(raiz, arquivo);
    if (!fs.existsSync(completo)) { console.log(`  ${arquivo}: arquivo não encontrado`); continue; }
    const achados = auditarCodigo(fs.readFileSync(completo, "utf8"), arquivo, { estrito: opcoes.has("--estrito") })
      .sort((a, b) => ordem[a.gravidade] - ordem[b.gravidade] || a.linha - b.linha);
    const conta = (g) => achados.filter((a) => a.gravidade === g).length;
    graves += conta("alta");
    console.log(`  ${arquivo.padEnd(44)} ${conta("alta")} / ${conta("média")} / ${conta("baixa")}`);
    if (opcoes.has("--detalhes"))
      for (const a of achados) console.log(`      [${a.gravidade}] ${a.regra} linha ${a.linha || "-"}: ${a.mensagem}`);
  }
  console.log(`\nOcorrências graves: ${graves}`);
  if (opcoes.has("--falhar") && graves > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) executar(process.argv.slice(2));

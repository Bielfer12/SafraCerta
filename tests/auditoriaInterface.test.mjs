import assert from "node:assert/strict";
import { test } from "node:test";
import { auditarCodigo, contraste } from "../scripts/auditoria-interface.mjs";

const tela = (corpo, estilos = "") => `
import { Text, TouchableOpacity, Pressable, Modal, ScrollView, TextInput, View } from "react-native";
export default function T() { return (<View>${corpo}</View>); }
const styles = StyleSheet.create({ ${estilos} });`;
const regras = (codigo, opcoes) =>
  auditarCodigo(codigo, "T.js", opcoes).map((a) => a.regra).sort();

test("A1: botão só com ícone precisa de rótulo; com texto ou rótulo está certo", () => {
  assert.ok(regras(tela("<TouchableOpacity onPress={f}><Icone /></TouchableOpacity>")).includes("A1"));
  assert.ok(!regras(tela('<TouchableOpacity onPress={f} accessibilityLabel="Voltar"><Icone /></TouchableOpacity>')).includes("A1"));
  assert.ok(!regras(tela("<TouchableOpacity onPress={f}><Text>Entrar</Text></TouchableOpacity>")).includes("A1"));
});

test("A1: botão vazio que serve de fundo para fechar menu não conta", () => {
  assert.ok(!regras(tela("<Pressable onPress={fechar} />")).includes("A1"));
});

test("A2: botão sem onPress", () => {
  assert.ok(regras(tela("<TouchableOpacity><Text>Ajuda</Text></TouchableOpacity>")).includes("A2"));
  assert.ok(!regras(tela("<TouchableOpacity onPress={f}><Text>Ajuda</Text></TouchableOpacity>")).includes("A2"));
});

test("A3: alvo menor que 48 px, considerando hitSlop", () => {
  const botao = (extra = "") =>
    tela(`<TouchableOpacity style={styles.b} onPress={f} accessibilityLabel="x" ${extra}><Icone /></TouchableOpacity>`, "b: { width: 36, height: 36 }");
  const achados = auditarCodigo(botao(), "T.js").filter((a) => a.regra === "A3");
  assert.equal(achados.length, 1);
  assert.equal(achados[0].gravidade, "alta");
  assert.ok(!regras(botao("hitSlop={6}")).includes("A3"), "hitSlop de 6 de cada lado completa 48");
  assert.ok(!regras(botao("hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}")).includes("A3"));
  const quarentaE4 = auditarCodigo(
    tela('<Pressable style={styles.b} onPress={f} accessibilityLabel="x"><Icone /></Pressable>', "b: { minHeight: 44 }"), "T.js",
  ).find((a) => a.regra === "A3");
  assert.equal(quarentaE4.gravidade, "média");
});

test("A3: 48 px ou mais passa", () => {
  assert.ok(!regras(tela('<Pressable style={styles.b} onPress={f} accessibilityLabel="x"><Icone /></Pressable>', "b: { minHeight: 48 }")).includes("A3"));
});

test("A5: campo de texto sem rótulo", () => {
  assert.ok(regras(tela('<TextInput placeholder="Matrícula" />')).includes("A5"));
  assert.ok(!regras(tela('<TextInput accessibilityLabel="Matrícula" placeholder="Matrícula" />')).includes("A5"));
});

test("A6: Modal precisa de onRequestClose", () => {
  assert.ok(regras(tela("<Modal visible />")).includes("A6"));
  assert.ok(!regras(tela("<Modal visible onRequestClose={fechar} />")).includes("A6"));
});

test("A7: só vale quando o campo está dentro da própria rolagem", () => {
  assert.ok(regras(tela('<ScrollView><TextInput accessibilityLabel="a" /></ScrollView>')).includes("A7"));
  assert.ok(!regras(tela('<ScrollView keyboardShouldPersistTaps="handled"><TextInput accessibilityLabel="a" /></ScrollView>')).includes("A7"));
  // o campo existe no arquivo, mas fora da rolagem (por exemplo, dentro de um Modal)
  assert.ok(!regras(tela('<ScrollView><Text>oi</Text></ScrollView><Modal onRequestClose={f}><TextInput accessibilityLabel="a" /></Modal>')).includes("A7"));
});

test("A9: tamanho de texto, com gravidade por faixa", () => {
  const texto = (px) => tela("<Text style={styles.t}>ola</Text>", `t: { fontSize: ${px} }`);
  const de = (px) => auditarCodigo(texto(px), "T.js").find((a) => a.regra === "A9");
  assert.equal(de(10).gravidade, "alta");
  assert.equal(de(13).gravidade, "média");
  assert.equal(de(14), undefined);
});

test("A10: campos de texto sem KeyboardAvoidingView", () => {
  assert.ok(regras(tela('<TextInput accessibilityLabel="a" />')).includes("A10"));
  assert.ok(!regras(tela('<KeyboardAvoidingView><TextInput accessibilityLabel="a" /></KeyboardAvoidingView>')).includes("A10"));
});

test("A11: contraste de texto escuro fraco é apontado; texto claro não é avaliado", () => {
  assert.ok(regras(tela("<Text style={styles.t}>x</Text>", 't: { color: "#9AA396", fontSize: 14 }')).includes("A11"));
  assert.ok(!regras(tela("<Text style={styles.t}>x</Text>", 't: { color: "#596155", fontSize: 14 }')).includes("A11"));
  assert.ok(!regras(tela("<Text style={styles.t}>x</Text>", 't: { color: "#FFFFFF", fontSize: 14 }')).includes("A11"));
});

test("A4 só aparece no modo estrito", () => {
  const codigo = tela("<TouchableOpacity onPress={f}><Text>Ok</Text></TouchableOpacity>");
  assert.ok(!regras(codigo).includes("A4"));
  assert.ok(regras(codigo, { estrito: true }).includes("A4"));
});

test("contraste: valores de referência", () => {
  assert.equal(contraste("#000000", "#FFFFFF").toFixed(1), "21.0");
  assert.equal(contraste("#FFFFFF", "#FFFFFF").toFixed(1), "1.0");
  assert.ok(contraste("#717A6D", "#FAFAF5") < 4.5, "cor antiga do rodapé do Login reprova");
  assert.ok(contraste("#596155", "#FAFAF5") >= 4.5, "cor nova aprova");
});

test("código sem problemas não gera achados", () => {
  const codigo = tela(
    '<TouchableOpacity style={styles.b} onPress={f} accessibilityRole="button"><Text style={styles.t}>Salvar</Text></TouchableOpacity>',
    "b: { minHeight: 48 }, t: { fontSize: 16, color: \"#1A1C19\" }",
  );
  assert.deepEqual(auditarCodigo(codigo, "T.js"), []);
});

const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
const CAMPOS_TALHAO = ["codigo", "nome", "propriedadeNome", "localidade", "municipio", "uf", "areaHa", "status", "observacoes"];

function validarTalhao(entrada = {}) {
  const dados = {};
  const erros = {};
  for (const campo of CAMPOS_TALHAO.filter((nome) => nome !== "areaHa")) {
    dados[campo] = typeof entrada[campo] === "string" ? entrada[campo].trim() : "";
    if (entrada[campo] != null && typeof entrada[campo] !== "string") erros[campo] = "Informe um texto válido.";
  }
  dados.codigo = dados.codigo.toUpperCase();
  dados.uf = dados.uf.toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{1,19}$/.test(dados.codigo)) erros.codigo = "Use de 2 a 20 letras, números ou hífens, sem espaços.";
  for (const [campo, minimo, maximo, titulo] of [["nome", 2, 80, "nome"], ["propriedadeNome", 2, 100, "nome da propriedade"]]) {
    if (dados[campo].length < minimo || dados[campo].length > maximo) erros[campo] = `Informe o ${titulo} com ${minimo} a ${maximo} caracteres.`;
  }
  for (const [campo, limite] of [["localidade", 120], ["municipio", 100], ["observacoes", 500]]) {
    if (dados[campo].length > limite) erros[campo] = `Use no máximo ${limite} caracteres.`;
  }
  if (dados.uf && !UFS.includes(dados.uf)) erros.uf = "Selecione uma UF válida.";
  if (dados.municipio && !dados.uf) erros.uf = "Selecione a UF do município.";
  if (dados.uf && dados.municipio.length < 2) erros.municipio = "Informe o município da UF selecionada.";
  if (!["ATIVO", "INATIVO"].includes(dados.status)) erros.status = "Selecione Ativo ou Inativo.";
  const area = entrada.areaHa;
  if (area == null || (typeof area === "string" && !area.trim())) dados.areaHa = null;
  else {
    dados.areaHa = typeof area === "string" ? Number(area.trim().replace(",", ".")) : area;
    if ((typeof area === "string" && !/^\d+(?:[.,]\d{1,4})?$/.test(area.trim()))
      || !Number.isFinite(dados.areaHa) || dados.areaHa <= 0
      || !Number.isSafeInteger(Math.round(dados.areaHa * 10000))
      || Math.abs(dados.areaHa * 10000 - Math.round(dados.areaHa * 10000)) > 0.000001) {
      erros.areaHa = "Informe uma área maior que zero, com até 4 casas decimais, ou deixe vazio.";
    }
  }
  return { dados, erros };
}

module.exports = { UFS, CAMPOS_TALHAO, validarTalhao };

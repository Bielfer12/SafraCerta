import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { acompanharAnalise, analisePendente, dataAnalise, operacaoAnalise, SITUACOES_ANALISE } from "../services/historicoAnalises";
import { obterNomeClassificacao } from "../utils/nomesClassificacoes";
import ImagemAnaliseFolha from "../components/ImagemAnaliseFolha";

export default function DetalheAnalise({ id }) {
  const [registro, setRegistro] = useState(null);
  const [erro, setErro] = useState("");
  const [foto, setFoto] = useState(null);
  const [erroFoto, setErroFoto] = useState("");
  const [carregandoFoto, setCarregandoFoto] = useState(false);
  const [ampliada, setAmpliada] = useState(false);
  const [tentativaFoto, setTentativaFoto] = useState(0);
  const cancelar = useRef(() => {});

  const consultar = useCallback(() => {
    cancelar.current();
    setErro("");
    cancelar.current = acompanharAnalise(
      id,
      (dados) => {
        setRegistro(dados);
        setErro("");
      },
      (falha) => {
        setRegistro(null);
        setFoto(null);
        setErro(falha.message);
      },
    );
  }, [id]);
  useFocusEffect(
    useCallback(() => {
      consultar();
      return () => cancelar.current();
    }, [consultar]),
  );

  const fotoSalva = registro?.foto?.situacao === "SALVA";
  const geracao = registro?.foto?.geracao;
  const chaveFoto = `${geracao}-${tentativaFoto}`;
  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      setFoto(null);
      setErroFoto("");
      if (!fotoSalva) {
        setCarregandoFoto(false);
        return;
      }
      setCarregandoFoto(true);
      operacaoAnalise("obterFotoAnalise", { analiseId: id })
        .then((resposta) => {
          if (ativo) setFoto({ ...resposta, chave: chaveFoto });
        })
        .catch((falha) => {
          if (ativo) setErroFoto(falha.message);
        })
        .finally(() => {
          if (ativo) setCarregandoFoto(false);
        });
      return () => {
        ativo = false;
      };
    }, [id, fotoSalva, chaveFoto]),
  );

  const resultado = registro?.resultado;
  const pendente = analisePendente(registro?.status);
  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <View style={styles.cabecalho}>
        <Pressable
          accessibilityLabel="Voltar"
          onPress={() => router.back()}
          style={styles.toque}
        >
          <Ionicons name="arrow-back" size={25} color="#FFFFFF" />
        </Pressable>
        <Text accessibilityRole="header" style={styles.titulo}>
          Detalhe da análise
        </Text>
      </View>
      {!registro ? (
        <View style={styles.estado}>
          {erro ? (
            <>
              <Text accessibilityRole="alert" style={styles.textoErro}>
                {erro}
              </Text>
              <Pressable style={styles.botao} onPress={consultar}>
                <Text style={styles.textoBotao}>Tentar novamente</Text>
              </Pressable>
            </>
          ) : (
            <>
              <ActivityIndicator color="#1B5E20" />
              <Text style={styles.descricao}>Carregando análise…</Text>
            </>
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.conteudo}>
          <Text style={styles.data}>{dataAnalise(registro.criadoEm)}</Text>
          <View accessibilityLiveRegion="polite" style={styles.linhaSituacao}>
            {pendente ? (
              <ActivityIndicator color="#785B21" size="small" />
            ) : (
              <Ionicons
                name={
                  registro.status === "CONCLUIDA"
                    ? "checkmark-circle-outline"
                    : "information-circle-outline"
                }
                size={23}
                color={registro.status === "CONCLUIDA" ? "#1B5E20" : "#785B21"}
              />
            )}
            <Text style={styles.situacao}>
              {SITUACOES_ANALISE[registro.status]}
            </Text>
          </View>
          <Text accessibilityRole="header" style={styles.nome}>
            {registro.talhaoSnapshot?.codigo} — {registro.talhaoSnapshot?.nome}
          </Text>
          <Text style={styles.propriedade}>
            {registro.talhaoSnapshot?.propriedadeNome}
          </Text>
          <Text style={styles.descricao}>
            {[
              registro.talhaoSnapshot?.localidade,
              registro.talhaoSnapshot?.municipio,
              registro.talhaoSnapshot?.uf,
            ]
              .filter(Boolean)
              .join(", ") || "Localização não informada"}
          </Text>
          {registro.talhaoSnapshot?.areaHa != null ? (
            <Text style={styles.descricao}>
              Área do talhão:{" "}
              {registro.talhaoSnapshot.areaHa.toLocaleString("pt-BR")} ha
            </Text>
          ) : null}

          {foto ? (
            <>
              <View style={styles.foto}>
                <ImagemAnaliseFolha
                  key={foto.chave}
                  uri={foto.url}
                  resultado={resultado}
                  mostrarMarcacoes={false}
                  style={styles.imagem}
                  aoFalhar={() => {
                    setFoto(null);
                    setErroFoto(
                      "Não foi possível abrir a foto. Atualize o acesso e tente novamente.",
                    );
                  }}
                />
              </View>
              <View style={styles.acoesFoto}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setAmpliada(true)}
                  style={styles.link}
                >
                  <Ionicons name="expand-outline" size={20} color="#1B5E20" />
                  <Text style={styles.textoLink}>Ampliar foto</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setTentativaFoto((valor) => valor + 1)}
                  style={styles.link}
                >
                  <Text style={styles.textoLink}>Atualizar acesso à foto</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View style={styles.semFoto}>
              {carregandoFoto ? (
                <ActivityIndicator color="#1B5E20" />
              ) : (
                <Ionicons name="image-outline" size={34} color="#596155" />
              )}
              <Text style={styles.descricao}>
                {carregandoFoto
                  ? "Carregando foto…"
                  : erroFoto ||
                    (pendente
                      ? "Aguardando o armazenamento da foto."
                      : "Foto indisponível para esta tentativa.")}
              </Text>
              {fotoSalva && !carregandoFoto ? (
                <Pressable
                  onPress={() => setTentativaFoto((valor) => valor + 1)}
                  style={styles.link}
                >
                  <Text style={styles.textoLink}>Tentar carregar foto</Text>
                </Pressable>
              ) : null}
            </View>
          )}

          {resultado ? (
            <View style={styles.resultado}>
              <Text style={styles.rotulo}>Classificação</Text>
              <Text style={styles.classificacao}>
                {obterNomeClassificacao(
                  resultado.classe,
                  resultado.nome_exibicao,
                )}
              </Text>
              <Text style={styles.pontuacao}>
                Pontuação do modelo: {Math.round(resultado.pontuacao * 100)}%
              </Text>
              {resultado.top3?.length ? (
                <View style={styles.previsoes}>
                  {resultado.top3.map((item) => (
                    <View key={item.classe} style={styles.previsao}>
                      <Text style={styles.textoPrevisao}>
                        {obterNomeClassificacao(
                          item.classe,
                          item.nome_exibicao,
                        )}
                      </Text>
                      <Text style={styles.valorPrevisao}>
                        {Math.round(item.pontuacao * 100)}%
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <Text style={styles.descricao}>
                A pontuação não representa gravidade nem porcentagem da área
                doente.
              </Text>
            </View>
          ) : (
            <View style={styles.aviso}>
              <Text style={styles.subtitulo}>
                {pendente
                  ? "Tentativa em andamento"
                  : "Tentativa sem classificação"}
              </Text>
              <Text style={styles.descricao}>
                {registro.erro?.mensagem ||
                  "O servidor ainda não confirmou um resultado. Esta tela acompanha as atualizações do histórico."}
              </Text>
              {registro.erro ? (
                <Text style={styles.descricao}>
                  Etapa: {registro.erro.etapa} · Código: {registro.erro.codigo}
                </Text>
              ) : null}
            </View>
          )}

          <View style={styles.contexto}>
            <Text style={styles.subtitulo}>Registro da tentativa</Text>
            <Text style={styles.descricao}>
              Usuário: {registro.usuarioSnapshot?.nomeCompleto || "Sem nome"}
            </Text>
            <Text style={styles.descricao}>
              Matrícula:{" "}
              {registro.usuarioSnapshot?.matricula || "Não informada"}
            </Text>
            <Text selectable style={styles.identificador}>
              UID: {registro.usuarioId}
            </Text>
            <Text style={styles.descricao}>
              Origem da foto:{" "}
              {registro.origemFoto === "CAMERA" ? "Câmera" : "Galeria"}
            </Text>
            <Text style={styles.descricao}>
              Início do processamento:{" "}
              {registro.iniciadoEm
                ? dataAnalise(registro.iniciadoEm)
                : "Não iniciado"}
            </Text>
            <Text style={styles.descricao}>
              Encerramento:{" "}
              {registro.finalizadoEm
                ? dataAnalise(registro.finalizadoEm)
                : "Ainda não encerrada"}
            </Text>
            {registro.duracaoProcessamentoMs != null ? (
              <Text style={styles.descricao}>
                Processamento:{" "}
                {(registro.duracaoProcessamentoMs / 1000).toLocaleString(
                  "pt-BR",
                )}{" "}
                s
              </Text>
            ) : null}
            {registro.modelo ? (
              <>
                <Text style={styles.descricao}>
                  Modelo: {registro.modelo.nome} · API{" "}
                  {registro.modelo.apiVersao}
                </Text>
                <Text selectable style={styles.identificador}>
                  Pesos: {registro.modelo.pesosSha256}
                </Text>
              </>
            ) : null}
            <Text selectable style={styles.identificador}>
              Análise: {id}
            </Text>
            <Text style={styles.nota}>
              Os dados do talhão e do usuário correspondem à data desta
              tentativa.
            </Text>
          </View>
          {registro.analiseAnteriorId ? (
            <Pressable
              style={styles.link}
              onPress={() =>
                router.push({
                  pathname: "/analise/[id]",
                  params: { id: registro.analiseAnteriorId },
                })
              }
            >
              <Text style={styles.textoLink}>Ver tentativa anterior</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            style={styles.botao}
            onPress={() =>
              router.push({
                pathname: "/teste-folha",
                params: { talhaoId: registro.talhaoId, analiseAnteriorId: id },
              })
            }
          >
            <Ionicons name="leaf-outline" size={22} color="#FFFFFF" />
            <Text style={styles.textoBotao}>Nova análise</Text>
          </Pressable>
        </ScrollView>
      )}
      <Modal
        visible={ampliada && Boolean(foto)}
        onRequestClose={() => setAmpliada(false)}
        animationType="fade"
      >
        <SafeAreaView style={styles.container}>
          <Pressable
            accessibilityLabel="Fechar foto ampliada"
            onPress={() => setAmpliada(false)}
            style={styles.fechar}
          >
            <Ionicons name="arrow-back" size={24} color="#1B5E20" />
            <Text style={styles.textoLink}>Foto da análise</Text>
          </Pressable>
          {foto ? (
            <ImagemAnaliseFolha
              key={foto.chave}
              uri={foto.url}
              resultado={resultado}
              mostrarMarcacoes={false}
              style={styles.imagem}
            />
          ) : null}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8F4" },
  cabecalho: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1B5E20",
    paddingHorizontal: 10,
  },
  toque: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  titulo: { fontSize: 21, fontWeight: "700", color: "#FFFFFF", flex: 1 },
  conteudo: { padding: 20, paddingBottom: 40, gap: 8 },
  estado: {
    flex: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  data: { color: "#596155", fontSize: 14, marginBottom: 6 },
  linhaSituacao: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  situacao: { color: "#1A1C19", fontSize: 15, fontWeight: "600" },
  nome: { fontSize: 24, fontWeight: "700", color: "#1A1C19", lineHeight: 31 },
  propriedade: {
    fontSize: 17,
    color: "#1B5E20",
    fontWeight: "600",
    lineHeight: 25,
  },
  descricao: { fontSize: 14, lineHeight: 22, color: "#596155" },
  foto: { height: 370, overflow: "hidden", borderRadius: 18, marginTop: 16 },
  imagem: { flex: 1 },
  acoesFoto: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  link: {
    minHeight: 48,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    paddingVertical: 8,
  },
  textoLink: { color: "#1B5E20", fontSize: 14, fontWeight: "700" },
  semFoto: {
    minHeight: 170,
    gap: 12,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#EDF0E9",
    borderRadius: 16,
    marginVertical: 16,
  },
  resultado: {
    paddingVertical: 20,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#DDE5D8",
  },
  rotulo: { color: "#596155", fontSize: 14 },
  classificacao: {
    color: "#1B5E20",
    fontSize: 25,
    lineHeight: 32,
    fontWeight: "700",
  },
  pontuacao: { color: "#1A1C19", fontSize: 16 },
  previsoes: { gap: 12, marginVertical: 12 },
  previsao: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  textoPrevisao: { color: "#1A1C19", fontSize: 14, flex: 1 },
  valorPrevisao: { color: "#1B5E20", fontSize: 14, fontWeight: "700" },
  aviso: {
    backgroundColor: "#F3ECD9",
    borderLeftWidth: 3,
    borderLeftColor: "#785B21",
    padding: 16,
    gap: 8,
    marginVertical: 12,
  },
  subtitulo: {
    color: "#1A1C19",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 6,
  },
  contexto: { paddingVertical: 20, gap: 8 },
  identificador: { color: "#596155", fontSize: 12, lineHeight: 19 },
  nota: { color: "#596155", fontSize: 13, lineHeight: 21, marginTop: 8 },
  botao: {
    minHeight: 52,
    padding: 14,
    backgroundColor: "#1B5E20",
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  textoBotao: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  textoErro: { color: "#A01818", fontSize: 15, lineHeight: 23 },
  fechar: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
});

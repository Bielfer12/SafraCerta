import TesteFolha from "../screens/TesteFolha";
import { useSessao } from "../context/Sessao";
import { useLocalSearchParams } from "expo-router";

export default function TelaTesteFolha() {
  const { usuario } = useSessao();
  const { talhaoId, analiseAnteriorId } = useLocalSearchParams();
  return <TesteFolha key={`${usuario?.uid}-${analiseAnteriorId || "nova"}`} talhaoInicialId={typeof talhaoId === "string" ? talhaoId : undefined} analiseAnteriorId={typeof analiseAnteriorId === "string" ? analiseAnteriorId : undefined} />;
}

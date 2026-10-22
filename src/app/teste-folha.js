import TesteFolha from "../screens/TesteFolha";
import { useSessao } from "../context/Sessao";

export default function TelaTesteFolha() {
  const { usuario } = useSessao();
  return <TesteFolha key={usuario?.uid} />;
}

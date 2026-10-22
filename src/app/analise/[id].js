import { useLocalSearchParams } from "expo-router";
import DetalheAnalise from "../../screens/DetalheAnalise";
import { useSessao } from "../../context/Sessao";

export default function TelaDetalheAnalise() {
  const { id } = useLocalSearchParams();
  const { usuario, admin } = useSessao();
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{10,128}$/.test(id)) return null;
  return <DetalheAnalise key={`${usuario?.uid}-${admin}-${id}`} id={id} />;
}

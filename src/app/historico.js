import Historico from "../screens/Historico";
import { useSessao } from "../context/Sessao";

export default function TelaHistorico() {
  const { usuario, admin } = useSessao();
  return <Historico key={`${usuario?.uid}-${admin}`} />;
}

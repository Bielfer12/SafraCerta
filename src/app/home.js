import Home from "../screens/Home";
import { useSessao } from "../context/Sessao";

export default function TelaHome() {
  const { usuario, admin } = useSessao();
  return <Home key={`${usuario?.uid}-${admin}`} />;
}

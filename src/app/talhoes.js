import Talhoes from "../screens/Talhoes";
import { useSessao } from "../context/Sessao";

export default function TelaTalhoes() {
  const { usuario, perfil } = useSessao();
  return <Talhoes key={`${usuario?.uid}-${perfil?.tipoUsuario}`} />;
}

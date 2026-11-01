import Dashboard from "../screens/Dashboard";
import { useSessao } from "../context/Sessao";

export default function TelaDashboard() {
  const { usuario, admin } = useSessao();
  return <Dashboard key={`${usuario?.uid}-${admin}`} />;
}

// No Android Emulator, 10.0.2.2 aponta para o computador hospedeiro.
// Defina EXPO_PUBLIC_API_DOCS_URL para usar celular físico ou uma API online.
const API_DOCS_URL =
  process.env.EXPO_PUBLIC_API_DOCS_URL ?? "http://10.0.2.2:8000/docs";

export const API_BASE_URL = API_DOCS_URL.replace(/\/docs\/?$/, "");

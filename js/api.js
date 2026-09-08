export const API_BASE = "https://yape-backend-owoe.onrender.com";

// Wrapper de fetch que agrega el header Authorization automáticamente
// usando el token guardado en localStorage. Centraliza el patrón que
// antes se repetía en cada función (login, devices, yapes, sedes, etc).
export function apiFetch(path, options = {}) {
  const token = localStorage.getItem("yape_token");
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}
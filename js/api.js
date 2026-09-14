export const API_BASE = "https://yape-backend-owoe.onrender.com";

// Wrapper de fetch que agrega el header Authorization automáticamente
// usando el token guardado en localStorage. Centraliza el patrón que
// antes se repetía en cada función (login, devices, yapes, sedes, etc).
export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("yape_token");
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401 && path !== "/login") {
    cerrarSesion();
  }

  return res;
}

export function cerrarSesion() {
  localStorage.removeItem("yape_token");
  localStorage.removeItem("yape_tipo");
  localStorage.removeItem("yape_sede_id");
  localStorage.removeItem("yape_device");
  location.reload();
}
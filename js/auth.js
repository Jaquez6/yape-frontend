import { API_BASE } from "./api.js";
import { renderDashboardView, renderFeedView } from "./app.js";

document.getElementById("logout-btn").addEventListener("click", () => {
  localStorage.removeItem("yape_token");
  location.reload();
});

document.getElementById("lock-btn").addEventListener("click", intentarEntrar);
document.getElementById("lock-input").addEventListener("keypress", (e) => {
  if (e.key === "Enter") intentarEntrar();
});
document.getElementById("lock-sede-id").addEventListener("keypress", (e) => {
  if (e.key === "Enter") intentarEntrar();
});

async function intentarEntrar() {
  const sedeId = document.getElementById("lock-sede-id").value.trim();
  const clave = document.getElementById("lock-input").value;
  const btn = document.getElementById("lock-btn");
  const errorMsg = document.getElementById("lock-error");

  errorMsg.style.display = "none";
  btn.disabled = true;
  btn.innerText = "Ingresando...";

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sede_id: sedeId, password: clave })
    });
    if (!res.ok) {
      const errorData = await res.json();
      errorMsg.innerText = errorData.detail || "Clave incorrecta";
      errorMsg.style.display = "block";
      return;
    }
    const data = await res.json();
    localStorage.setItem("yape_token", data.token);
    localStorage.setItem("yape_tipo", data.tipo);
    localStorage.setItem("yape_device", data.device || "");
    localStorage.setItem("yape_sede_id", sedeId);
    document.getElementById("lock-screen").style.display = "none";
    iniciarApp();
  } catch (err) {
    errorMsg.innerText = "Error de conexión";
    errorMsg.style.display = "block";
  } finally {
    btn.disabled = false;
    btn.innerText = "Entrar";
  }
}

function iniciarApp() {
  const tipo = localStorage.getItem("yape_tipo");
  const deviceAsignado = localStorage.getItem("yape_device");

  document.getElementById("sound-btn").style.display = tipo === "admin" ? "inline-flex" : "none";

  if (tipo === "admin") {
    const urlParams = new URLSearchParams(window.location.search);
    const selectedDevice = urlParams.get("device");
    if (selectedDevice !== null) {
      renderFeedView(selectedDevice);
    } else {
      renderDashboardView();
    }
  } else {
    renderFeedView(deviceAsignado);
  }
}

const tokenGuardado = localStorage.getItem("yape_token");
if (tokenGuardado) {
  document.getElementById("lock-screen").style.display = "none";
  iniciarApp();
}
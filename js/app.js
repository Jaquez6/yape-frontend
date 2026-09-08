import { apiFetch } from "./api.js";

let soundEnabled = false;
const audio = new Audio("yape.mp3");

document.getElementById("sound-btn").addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  document.getElementById("sound-btn").innerText = soundEnabled ? "🔊" : "🔇";
  if (soundEnabled) audio.play().catch(() => {});
});

export async function renderDashboardView() {
  document.getElementById("total-day-card").style.display = "none";
  document.getElementById("live-indicator").style.display = "none";

  const app = document.getElementById("app");
  app.innerHTML = `<p style="color:var(--text-secondary); font-size:0.85rem;">Cargando lista de dispositivos...</p>`;

  try {
    const res = await apiFetch("/devices");
    const data = await res.json();
    const devices = data.devices || [];

    let html = `
      <p style="color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500;">Seleccionar canal</p>
      <div class="device-grid">
        <div class="device-card" onclick="location.href='?device='">
          <div>
            <strong style="font-size:0.9rem; color:var(--text-primary);">Todos los dispositivos</strong>
            <p style="font-size:0.75rem; color: var(--text-secondary); margin-top:2px;">Consolidado global en tiempo real</p>
          </div>
          <span class="btn btn-secondary">Ver Feed</span>
        </div>
    `;

    devices.forEach(dev => {
      html += `
        <div class="device-card" onclick="location.href='?device=${encodeURIComponent(dev)}'">
          <div>
            <strong style="font-size:0.9rem; color:var(--text-primary);">${dev}</strong>
          </div>
          <span class="btn btn-secondary">Filtrar</span>
        </div>
      `;
    });

    html += `</div>`;
    app.innerHTML = html;
  } catch (err) {
    app.innerHTML = `<p style="color:#f87171; font-size:0.85rem;">Error de conexión con la API.</p>`;
  }
}

export async function renderFeedView(device) {
  const app = document.getElementById("app");
  const esAdmin = localStorage.getItem("yape_tipo") === "admin";
  const sedeLogueada = localStorage.getItem("yape_sede_id");

  document.getElementById("view-title").innerText = (device === "" ? "Feed Global" : device) + " — " + sedeLogueada;
  document.getElementById("total-day-card").style.display = "flex";
  document.getElementById("live-indicator").style.display = "flex";

  app.innerHTML = `
    ${esAdmin ? `<div class="nav-bar"><a href="index.html" class="btn btn-secondary">⬅️ Cambiar canal</a></div>` : ""}
    <div id="yape-list" class="yape-list"></div>
  `;

  let currentYapes = [];
  const listContainer = document.getElementById("yape-list");
  const token = localStorage.getItem("yape_token");

  try {
    const path = device ? `/yapes?device=${encodeURIComponent(device)}` : `/yapes`;
    const res = await apiFetch(path);
    const history = await res.json();

    currentYapes = history;
    history.forEach(item => listContainer.appendChild(createYapeCard(item)));
    updateDayTotal(currentYapes);
  } catch (err) {
    console.error("Error al cargar historial:", err);
  }

  const { API_BASE } = await import("./api.js");
  const streamUrl = device
    ? `${API_BASE}/yapes/stream?device=${encodeURIComponent(device)}&token=${token}`
    : `${API_BASE}/yapes/stream?token=${token}`;
  const eventSource = new EventSource(streamUrl);

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.tipo === "reclamo") {
      actualizarEstadoTarjeta(data.yape_id, data.reclamado_por);
      return;
    }

    currentYapes.unshift(data);
    listContainer.prepend(createYapeCard(data));
    updateDayTotal(currentYapes);

    if (soundEnabled) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  };
}

function actualizarEstadoTarjeta(yapeId, reclamadoPor) {
  const estadoDiv = document.getElementById(`estado-${yapeId}`);
  if (!estadoDiv) return;

  const esAdmin = localStorage.getItem("yape_tipo") === "admin";
  const temp = document.createElement("div");
  temp.innerHTML = renderEstadoHTML(yapeId, reclamadoPor, esAdmin);
  estadoDiv.replaceWith(temp.firstElementChild);

  const card = document.getElementById(`yape-${yapeId}`);
  if (card) card.style.cursor = "default";
}

function createYapeCard(data) {
  const card = document.createElement("div");
  card.className = "yape-card";
  card.id = "yape-" + data.id;

  let fechaTexto = "Reciente";
  if (data.timestamp) {
    const fechaObj = new Date(data.timestamp);
    fechaTexto = fechaObj.toLocaleString("es-PE", {
      timeZone: "America/Lima",
      day: "numeric", month: "numeric", year: "2-digit",
      hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true
    });
  }

  const codigo = data.codigoSeguridad ? `<span class="meta-tag">Cód: ${data.codigoSeguridad}</span>` : "";
  const dev = data.deviceId ? `<span class="meta-tag">${data.deviceId}</span>` : "";
  const esAdmin = localStorage.getItem("yape_tipo") === "admin";

  card.innerHTML = `
    <div class="yape-row-main">
      <span class="remitente">${data.remitente}</span>
      <span class="monto">S/ ${data.monto.toFixed(2)}</span>
    </div>
    <div class="yape-row-sub">
      <div style="display:flex; gap:6px; align-items:center;">${dev}${codigo}${renderEstadoHTML(data.id, data.reclamado_por, esAdmin)}</div>
      <span>${fechaTexto}</span>
    </div>
  `;

  if (!data.reclamado_por && !esAdmin) {
    card.style.cursor = "pointer";
    card.addEventListener("click", () => abrirModalReclamo(data.id, data.remitente, data.monto, fechaTexto, data.codigoSeguridad));
  }

  return card;
}

function abrirModalReclamo(yapeId, remitente, monto, fechaTexto, codigo) {
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:1000;";
  overlay.innerHTML = `
    <div style="background:var(--panel-bg); border:1px solid var(--panel-border); border-radius:10px; padding:20px; max-width:300px; text-align:center;">
      <p style="margin-bottom:10px; font-size:0.9rem;">¿Confirmas que vas a atender este yapeo?</p>
      <p style="font-weight:600; font-size:1rem;">${remitente}</p>
      <p style="color:var(--status-green); font-weight:700; font-size:1.15rem; margin:4px 0;">S/ ${monto.toFixed(2)}</p>
      ${codigo ? `<p style="color:var(--text-secondary); font-size:0.8rem;">Cód: ${codigo}</p>` : ""}
      <p style="color:var(--text-secondary); font-size:0.8rem; margin-bottom:16px;">${fechaTexto}</p>
      <div style="display:flex; gap:8px; justify-content:center;">
        <button class="btn btn-secondary" id="cancelar-reclamo">Cancelar</button>
        <button class="btn" id="confirmar-reclamo">Confirmar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector("#cancelar-reclamo").onclick = () => overlay.remove();
  overlay.querySelector("#confirmar-reclamo").onclick = async () => {
    overlay.remove();
    await reclamarYapeo(yapeId);
  };
}

async function reclamarYapeo(yapeId) {
  const res = await apiFetch(`/yapes/${yapeId}/reclamar`, { method: "POST" });

  if (res.status === 409) {
    const data = await res.json();
    alert(data.detail || "Ya fue reclamado por otra sede");
  } else if (!res.ok) {
    alert("Error al reclamar el yapeo");
  }
  // Si sale bien (200), no hacemos nada más acá:
  // el propio backend te va a mandar el evento SSE de reclamo,
  // y ese evento es el que actualiza la tarjeta.
}

function renderEstadoHTML(id, reclamadoPor, esAdmin) {
  const texto = reclamadoPor
    ? `<span class="meta-tag" style="color:var(--status-green); border-color: rgba(16,185,129,0.3); font-size:0.68rem;">✓ ${reclamadoPor}</span>`
    : `<span class="meta-tag" style="font-size:0.68rem;">Sin atender</span>`;
  const lapiz = esAdmin
    ? `<span onclick="window.toggleAsignacion(${id}, event)" style="cursor:pointer; color: var(--text-secondary); font-size:0.75rem;">✎</span>`
    : "";
  return `<span id="estado-${id}" style="display:inline-flex; align-items:center; gap:4px;">${texto}${lapiz}</span>`;
}

let listaSedesCache = null;

async function obtenerSedes() {
  if (listaSedesCache) return listaSedesCache;
  const res = await apiFetch("/sedes");
  listaSedesCache = await res.json();
  return listaSedesCache;
}

async function toggleAsignacion(yapeId, event) {
  event.stopPropagation();
  const estadoDiv = document.getElementById(`estado-${yapeId}`);
  if (!estadoDiv || estadoDiv.dataset.editando === "1") return;

  const sedes = await obtenerSedes();
  const opciones = sedes.map(s => `<option value="${s}">${s}</option>`).join("");

  estadoDiv.dataset.htmlOriginal = estadoDiv.innerHTML;
  estadoDiv.dataset.editando = "1";
  estadoDiv.innerHTML = `
    <select id="select-sede-${yapeId}" style="background:var(--panel-bg); color:var(--text-primary); border:1px solid var(--panel-border); border-radius:6px; padding:2px 6px; font-size:0.75rem;">
      ${opciones}
    </select>
    <button class="btn" style="padding:2px 8px; font-size:0.72rem; margin-left:6px;" onclick="window.confirmarAsignacion(${yapeId})">OK</button>
    <button class="btn btn-secondary" style="padding:2px 8px; font-size:0.72rem;" onclick="window.cancelarAsignacion(${yapeId})">✕</button>
  `;
}

function cancelarAsignacion(yapeId) {
  const estadoDiv = document.getElementById(`estado-${yapeId}`);
  if (estadoDiv && estadoDiv.dataset.htmlOriginal) {
    estadoDiv.innerHTML = estadoDiv.dataset.htmlOriginal;
    estadoDiv.dataset.editando = "0";
  }
}

async function confirmarAsignacion(yapeId) {
  const sedeDestino = document.getElementById(`select-sede-${yapeId}`).value;

  const res = await apiFetch(`/yapes/${yapeId}/asignar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sede_destino: sedeDestino })
  });

  if (!res.ok) alert("Error al asignar");
  // igual que en reclamarYapeo: el SSE actualiza la tarjeta, no lo hacemos acá
}

function updateDayTotal(yapesList) {
  const totalContainer = document.getElementById("total-day-amount");
  if (!totalContainer) return;

  const hoyLima = new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" });

  const totalHoy = yapesList.reduce((acc, item) => {
    if (!item.timestamp) return acc;
    const itemFechaLima = new Date(item.timestamp).toLocaleDateString("en-CA", { timeZone: "America/Lima" });
    return itemFechaLima === hoyLima ? acc + (Number(item.monto) || 0) : acc;
  }, 0);

  totalContainer.innerText = `S/ ${totalHoy.toFixed(2)}`;
}

// toggleAsignacion, cancelarAsignacion y confirmarAsignacion se llaman desde
// atributos onclick inline generados dinámicamente (innerHTML), así que
// necesitan quedar expuestas en window ya que los módulos ES no las hacen
// globales automáticamente.
window.toggleAsignacion = toggleAsignacion;
window.cancelarAsignacion = cancelarAsignacion;
window.confirmarAsignacion = confirmarAsignacion;
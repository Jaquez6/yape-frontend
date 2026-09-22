import { apiFetch } from "./api.js";

// ============================================================
// Vista "Estado de equipos" (solo admin).
// - El estado actual sale de la RAM del backend: se refresca cada
//   30 s mientras la vista está abierta y la pestaña visible.
// - Los incidentes leen Neon: solo se piden al abrir la vista o
//   al pulsar "Actualizar".
// ============================================================

const REFRESCO_MS = 30_000;
const DATO_VIEJO_S = 15 * 60; // igual que UMBRAL_SIN_CONTACTO del backend

let intervaloStatus = null;
let incidentesCache = {};

const ESTADO_CONEXION = {
  vivo: { color: "#10b981", texto: "En línea" },
  sin_contacto: { color: "#eab308", texto: "Sin contacto" },
  caido: { color: "#f87171", texto: "Caído" },
  sin_datos: { color: "var(--text-secondary)", texto: "Sin datos desde el reinicio" },
};

const ETIQUETA_INCIDENTE = {
  caido: "🔴 Caído",
  inactivo: "🔴 Listener desconectado",
  baja: "🪫 Batería baja",
  critica: "🪫 Batería crítica",
};

export async function renderStatusView() {
  detenerRefresco();

  const btnVolver = document.getElementById("btn-cambiar-canal");
  btnVolver.style.display = "inline-flex";
  btnVolver.onclick = null;
  btnVolver.setAttribute("href", "index.html");
  document.getElementById("total-day-card").style.display = "none";
  document.getElementById("live-indicator").style.display = "none";
  document.getElementById("sound-btn").style.display = "none";
  document.getElementById("view-title").innerText = "Estado de equipos";
  document.body.classList.add("vista-ancha");

  document.getElementById("app").innerHTML = `
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px; flex-wrap:wrap;">
      <p id="status-actualizado" style="font-size:0.75rem; color:var(--text-secondary);">Cargando...</p>
      <button class="btn btn-secondary" id="status-btn-actualizar" style="margin-left:auto; font-size:0.75rem; padding:5px 10px;">Actualizar</button>
    </div>
    <p id="status-error" style="color:#f87171; font-size:0.8rem; display:none; margin-bottom:10px;"></p>
    <div id="status-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:12px;"></div>
  `;

  document.getElementById("status-btn-actualizar").addEventListener("click", cargarTodo);

  await cargarTodo();
  intervaloStatus = setInterval(refrescoPeriodico, REFRESCO_MS);
}

function detenerRefresco() {
  if (intervaloStatus) clearInterval(intervaloStatus);
  intervaloStatus = null;
}

async function cargarTodo() {
  const [equipos] = await Promise.all([pedirEstado(), cargarIncidentes()]);
  if (equipos) pintarEquipos(equipos);
}

async function refrescoPeriodico() {
  if (!document.getElementById("status-grid")) {
    detenerRefresco(); // la vista ya no está en pantalla
    return;
  }
  if (document.hidden) return; // pestaña en segundo plano: no consultar
  const equipos = await pedirEstado();
  if (equipos) pintarEquipos(equipos);
}

async function pedirEstado() {
  try {
    const res = await apiFetch("/heartbeat/status");
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || `Error ${res.status}`);
    }
    const error = document.getElementById("status-error");
    if (error) error.style.display = "none";
    return await res.json();
  } catch (err) {
    const error = document.getElementById("status-error");
    if (error) {
      error.innerText = err.message || "Error de conexión con la API.";
      error.style.display = "block";
    }
    return null;
  }
}

async function cargarIncidentes() {
  try {
    const res = await apiFetch("/heartbeat/incidentes");
    if (res.ok) incidentesCache = await res.json();
  } catch (err) {
    console.error("Error al cargar incidentes:", err);
  }
}

function pintarEquipos(equipos) {
  const grid = document.getElementById("status-grid");
  if (!grid) return;

  grid.innerHTML = equipos.length === 0
    ? `<p style="color:var(--text-secondary); font-size:0.85rem;">Todavía no hay equipos reportando.</p>`
    : equipos.map(tarjetaEquipo).join("");

  const hora = new Date().toLocaleTimeString("es-PE", { timeZone: "America/Lima", hour12: false });
  document.getElementById("status-actualizado").innerText = `Actualizado a las ${hora} · se refresca cada 30 s`;
}

function colorGeneral(e) {
  if (e.estado === "caido") return "#f87171";
  if (e.estado === "sin_datos") return "var(--text-secondary)";
  if (e.listener_activo === false) return "#f87171";
  if (e.estado === "sin_contacto") return "#eab308";
  if (e.bateria != null && e.bateria <= 20 && e.enchufado === false) return "#eab308";
  return "#10b981";
}

function tarjetaEquipo(e) {
  const conexion = ESTADO_CONEXION[e.estado] || ESTADO_CONEXION.sin_datos;
  const edadLatido = segundosDesde(e.ultimo_latido);
  const latidoViejo = edadLatido === null || edadLatido > DATO_VIEJO_S;
  const atenuado = latidoViejo ? "opacity:0.5;" : "";
  const sufijoViejo = latidoViejo && e.ultimo_latido
    ? ` <span style="font-size:0.7rem; color:var(--text-secondary);">(${haceCuanto(e.ultimo_latido)})</span>`
    : "";

  return `
    <div style="background:var(--panel-bg); border:1px solid var(--panel-border); border-left:4px solid ${colorGeneral(e)}; border-radius:10px; padding:14px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <strong style="font-size:0.95rem; color:var(--text-primary);">${e.device_id}</strong>
        <span style="font-size:0.75rem; font-weight:600; color:${conexion.color};">● ${conexion.texto}</span>
      </div>
      ${fila("Último contacto", `<span title="${formatoHoraLima(e.ultimo_contacto)}">${haceCuanto(e.ultimo_contacto)}</span>`)}
      ${fila("Listener", `<span style="${atenuado}">${textoListener(e.listener_activo)}</span>${sufijoViejo}`)}
      ${fila("Batería", `<span style="${atenuado}">${textoBateria(e)}</span>${sufijoViejo}`)}
      ${filasEquipo(e.equipo)}
      ${fila("Último yapeo", e.ultimo_yapeo
        ? `<span title="${formatoHoraLima(e.ultimo_yapeo)}">${haceCuanto(e.ultimo_yapeo)}</span>`
        : `<span style="color:var(--text-secondary);">Sin yapeos desde el reinicio</span>`)}
      ${bloqueIncidentes(incidentesCache[e.device_id] || [])}
    </div>
  `;
}

function fila(etiqueta, valor) {
  return `
    <div style="display:flex; justify-content:space-between; gap:10px; font-size:0.8rem; padding:3px 0;">
      <span style="color:var(--text-secondary);">${etiqueta}</span>
      <span style="color:var(--text-primary); text-align:right;">${valor}</span>
    </div>`;
}

function textoListener(activo) {
  if (activo === true) return `<span style="color:#10b981;">Conectado</span>`;
  if (activo === false) return `<span style="color:#f87171;">Desconectado</span>`;
  return "—";
}

function textoBateria(e) {
  if (!e.ultimo_latido) return "—";
  if (e.bateria == null) return `<span style="color:var(--text-secondary);">Sin dato (app sin actualizar)</span>`;
  const icono = e.bateria <= 20 && !e.enchufado ? "🪫" : "🔋";
  const carga = e.enchufado ? " · enchufado" : e.enchufado === false ? " · desenchufado" : "";
  return `${icono} ${e.bateria}%${carga}`;
}

function filasEquipo(eq) {
  const sinDato = `<span style="color:var(--text-secondary);">Sin dato aún</span>`;
  if (!eq) return fila("App", sinDato) + fila("Equipo", sinDato);
  return fila("App", `v${eq.app_version} (${eq.app_version_code})`)
       + fila("Equipo", `${eq.marca} ${eq.modelo} · Android ${eq.android}`);
}

function bloqueIncidentes(lista) {
  const titulo = `<p style="font-size:0.72rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin:12px 0 4px;">Últimos incidentes (7 días)</p>`;
  if (lista.length === 0) {
    return titulo + `<p style="font-size:0.78rem; color:var(--text-secondary);">Sin incidentes.</p>`;
  }
  const items = lista.map(i => {
    const bateria = i.status === "caido" && i.bateria != null ? ` · con ${i.bateria}%` : "";
    const duracion = i.fin
      ? formatoDuracion(i.inicio, i.fin)
      : `<span style="color:#f87171;">en curso · ${formatoDuracion(i.inicio, null)}</span>`;
    return `
      <div style="display:flex; justify-content:space-between; gap:8px; font-size:0.75rem; padding:2px 0;">
        <span>${ETIQUETA_INCIDENTE[i.status] || i.status}${bateria}</span>
        <span style="color:var(--text-secondary); text-align:right;">${formatoHoraLima(i.inicio)} · ${duracion}</span>
      </div>`;
  }).join("");
  return titulo + items;
}

function segundosDesde(iso) {
  if (!iso) return null;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
}

function haceCuanto(iso) {
  const seg = segundosDesde(iso);
  if (seg === null) return "—";
  if (seg < 60) return "hace un momento";
  const min = Math.floor(seg / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h ${min % 60} min`;
  return `hace ${Math.floor(h / 24)} d`;
}

function formatoDuracion(inicioIso, finIso) {
  const fin = finIso ? new Date(finIso).getTime() : Date.now();
  const min = Math.max(0, Math.round((fin - new Date(inicioIso).getTime()) / 60000));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

function formatoHoraLima(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}
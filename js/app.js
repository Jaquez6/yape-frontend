import { apiFetch } from "./api.js";

let soundEnabled = false;
const audio = new Audio("yape.mp3");

document.getElementById("sound-btn").addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  document.getElementById("sound-btn").innerText = soundEnabled ? "🔊" : "🔇";
  if (soundEnabled) audio.play().catch(() => {});
});

export async function renderDashboardView() {
  document.getElementById("btn-cambiar-canal").style.display = "none";
  document.getElementById("total-day-card").style.display = "none";
  document.getElementById("live-indicator").style.display = "none";

  const app = document.getElementById("app");
  app.style.maxWidth = "";
  app.style.width = "";
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

    html += `
      <div class="device-card" onclick="window.irAConciliacion()">
        <div>
          <strong style="font-size:0.9rem; color:var(--text-primary);">Conciliación diaria</strong>
          <p style="font-size:0.75rem; color: var(--text-secondary); margin-top:2px;">Subir reporte de Yape y comparar contra lo capturado</p>
        </div>
        <span class="btn btn-secondary">Abrir</span>
      </div>
    </div>`;

    app.innerHTML = html;
  } catch (err) {
    app.innerHTML = `<p style="color:#f87171; font-size:0.85rem;">Error de conexión con la API.</p>`;
  }
}

// ============================================================
// Vista de conciliación diaria (solo admin).
// 1. Elige cuenta y fecha -> se cargan las capturas de ese día.
// 2. Sube el reporte de Yape y concilia -> la misma tabla se pinta
//    con verde / amarillo / rojo y aparece el resumen.
// ============================================================

function ayerEnLima() {
  const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return ayer.toLocaleDateString("en-CA", { timeZone: "America/Lima" });
}

function formatoDiferencia(segundos) {
  if (segundos === null || segundos === undefined) return "";
  const signo = segundos < 0 ? "-" : "";
  const abs = Math.abs(Math.round(segundos));
  if (abs < 60) return `${signo}${abs}s`;
  return `${signo}${Math.floor(abs / 60)}m ${abs % 60}s`;
}

function formatoHoraLima(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  });
}

const CONC_COLORES = {
  sin_conciliar: "var(--text-secondary)",
  verde: "#10b981",
  amarillo: "#eab308",
  rojo: "#f87171",
};

const CONC_ETIQUETAS = {
  sin_conciliar: "Sin conciliar",
  verde: "Conciliado",
  amarillo: "No capturado",
  rojo: "Sin respaldo",
};

export async function renderConciliacionView() {
  document.getElementById("btn-cambiar-canal").style.display = "none";
  document.getElementById("total-day-card").style.display = "none";
  document.getElementById("live-indicator").style.display = "none";
  document.getElementById("view-title").innerText = "Conciliación diaria";

  const app = document.getElementById("app");
  app.style.maxWidth = "none";
  app.style.width = "100%";
  app.innerHTML = `<p style="color:var(--text-secondary); font-size:0.85rem;">Cargando cuentas...</p>`;

  let devices = [];
  try {
    const res = await apiFetch("/devices");
    const data = await res.json();
    devices = data.devices || [];
  } catch (err) {
    app.innerHTML = `<p style="color:#f87171; font-size:0.85rem;">Error de conexión con la API.</p>`;
    return;
  }

  const opcionesDevice = devices.map(d => `<option value="${d}">${d}</option>`).join("");

  app.innerHTML = `
    <button class="btn btn-secondary" id="conc-volver" style="margin-bottom:14px;">⬅️ Volver</button>

    <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end; margin-bottom:12px;">
      <label style="font-size:0.75rem; color:var(--text-secondary); display:flex; flex-direction:column; gap:4px;">
        Cuenta
        <select id="conc-device" style="${estiloInputChico()}">${opcionesDevice}</select>
      </label>
      <label style="font-size:0.75rem; color:var(--text-secondary); display:flex; flex-direction:column; gap:4px;">
        Fecha
        <input id="conc-fecha" type="date" value="${ayerEnLima()}" style="${estiloInputChico()}" />
      </label>
      <label style="font-size:0.75rem; color:var(--text-secondary); display:flex; flex-direction:column; gap:4px;">
        Reporte de Yape (.xlsx)
        <input id="conc-archivo" type="file" accept=".xlsx" style="font-size:0.78rem; color:var(--text-primary);" />
      </label>
      <button class="btn" id="conc-btn-enviar">Conciliar</button>
    </div>

    <p id="conc-error" style="color:#f87171; font-size:0.8rem; display:none; margin-bottom:10px;"></p>
    <div id="conc-resumen" style="margin-bottom:12px;"></div>
    <div id="conc-tabla"></div>
  `;

  document.getElementById("conc-volver").addEventListener("click", renderDashboardView);
  document.getElementById("conc-device").addEventListener("change", cargarCapturasConciliacion);
  document.getElementById("conc-fecha").addEventListener("change", cargarCapturasConciliacion);
  document.getElementById("conc-btn-enviar").addEventListener("click", conciliarSubmit);

  await cargarCapturasConciliacion();
}

async function cargarCapturasConciliacion() {
  const device = document.getElementById("conc-device").value;
  const fecha = document.getElementById("conc-fecha").value;
  const tabla = document.getElementById("conc-tabla");
  const errorMsg = document.getElementById("conc-error");

  errorMsg.style.display = "none";
  document.getElementById("conc-resumen").innerHTML = "";
  if (!device || !fecha) {
    tabla.innerHTML = "";
    return;
  }

  tabla.innerHTML = `<p style="color:var(--text-secondary); font-size:0.85rem;">Cargando capturas...</p>`;

  try {
    const params = new URLSearchParams({ device_id: device, fecha });
    const res = await apiFetch(`/conciliacion/capturas?${params.toString()}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Error ${res.status}`);
    }
    const data = await res.json();

    // Mismo formato de fila que devuelve el motor, en estado "sin_conciliar"
    const filas = data.capturas.map(c => ({
      estado: "sin_conciliar",
      captura_id: c.id,
      origen_reporte: null,
      monto_centavos: c.monto_centavos,
      fecha_operacion: null,
      remitente_capturado: c.remitente,
      timestamp_captura: c.timestamp_lima,
      diferencia_yape_app_seg: null,
      diferencia_yape_backend_seg: null,
    }));

    pintarTablaConciliacion(filas);
  } catch (err) {
    tabla.innerHTML = "";
    errorMsg.innerText = err.message || "Error al cargar las capturas.";
    errorMsg.style.display = "block";
  }
}

async function conciliarSubmit() {
  const device = document.getElementById("conc-device").value;
  const fecha = document.getElementById("conc-fecha").value;
  const archivo = document.getElementById("conc-archivo").files[0];
  const btn = document.getElementById("conc-btn-enviar");
  const errorMsg = document.getElementById("conc-error");

  errorMsg.style.display = "none";

  if (!archivo) {
    errorMsg.innerText = "Selecciona el archivo del reporte.";
    errorMsg.style.display = "block";
    return;
  }

  btn.disabled = true;
  btn.innerText = "Conciliando...";

  const formData = new FormData();
  formData.append("device_id", device);
  formData.append("fecha", fecha);
  formData.append("archivo", archivo);

  try {
    // No poner "Content-Type": el navegador arma el boundary de multipart.
    const res = await apiFetch("/conciliacion", { method: "POST", body: formData });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Error ${res.status}`);
    }
    const data = await res.json();
    pintarResumenConciliacion(data);
    pintarTablaConciliacion(data.filas);
  } catch (err) {
    errorMsg.innerText = err.message || "Error al conciliar.";
    errorMsg.style.display = "block";
  } finally {
    btn.disabled = false;
    btn.innerText = "Conciliar";
  }
}

function pintarResumenConciliacion(data) {
  const r = data.resumen;
  const app = r.diferencia_yape_app;
  const back = r.diferencia_yape_backend;

  let avisos = "";
  if (r.filas_reporte_otro_dia > 0) {
    avisos += `<p style="color:#eab308; font-size:0.78rem; margin-top:6px;">
      ${r.filas_reporte_otro_dia} fila(s) del reporte eran de otro día y se descartaron.</p>`;
  }
  if (data.errores_lectura && data.errores_lectura.length > 0) {
    avisos += `<p style="color:#eab308; font-size:0.78rem; margin-top:6px;">
      ${data.errores_lectura.length} fila(s) del reporte no se pudieron leer (detalle en consola).</p>`;
    console.warn("Errores al leer el reporte:", data.errores_lectura);
  }

  document.getElementById("conc-resumen").innerHTML = `
    <div style="display:flex; gap:18px; flex-wrap:wrap; font-size:0.85rem;">
      <div><strong>Cobertura:</strong> ${r.cobertura}%</div>
      <div><strong>Confiabilidad:</strong> ${r.confiabilidad}%</div>
      <div style="color:${CONC_COLORES.verde};">Conciliados: ${r.totales.verde}</div>
      <div style="color:${CONC_COLORES.amarillo};">No capturados: ${r.totales.amarillo}</div>
      <div style="color:${CONC_COLORES.rojo};">Sin respaldo: ${r.totales.rojo}</div>
    </div>
    <div style="display:flex; gap:18px; flex-wrap:wrap; font-size:0.75rem; color:var(--text-secondary); margin-top:6px;">
      <div>Δ Yape→app: mediana ${formatoDiferencia(app.mediana) || "—"} · p95 ${formatoDiferencia(app.p95) || "—"} · máx ${formatoDiferencia(app.maximo) || "—"} (n=${app.n})</div>
      <div>Δ Yape→backend: mediana ${formatoDiferencia(back.mediana) || "—"} · p95 ${formatoDiferencia(back.p95) || "—"} · máx ${formatoDiferencia(back.maximo) || "—"} (n=${back.n})</div>
    </div>
    ${avisos}
  `;
}

function pintarTablaConciliacion(filas) {
  const cont = document.getElementById("conc-tabla");

  if (filas.length === 0) {
    cont.innerHTML = `<p style="color:var(--text-secondary); font-size:0.85rem;">No hay capturas para esta cuenta y fecha.</p>`;
    return;
  }

  const th = "text-align:left; padding:6px 8px; border-bottom:1px solid var(--panel-border); color:var(--text-secondary); font-weight:600; white-space:nowrap;";
  const td = "padding:5px 8px; border-bottom:1px solid var(--panel-border); white-space:nowrap;";

  const cuerpo = filas.map(f => {
    const color = CONC_COLORES[f.estado];
    const monto = (f.monto_centavos / 100).toFixed(2);
    return `
      <tr style="border-left:3px solid ${color};">
        <td style="${td} color:${color}; font-weight:600;">${CONC_ETIQUETAS[f.estado]}</td>
        <td style="${td}">${formatoHoraLima(f.fecha_operacion)}</td>
        <td style="${td}">${f.origen_reporte || ""}</td>
        <td style="${td}">${f.remitente_capturado || ""}</td>
        <td style="${td} text-align:right;">S/ ${monto}</td>
        <td style="${td}">${formatoHoraLima(f.timestamp_captura)}</td>
        <td style="${td} text-align:right;">${formatoDiferencia(f.diferencia_yape_app_seg)}</td>
        <td style="${td} text-align:right;">${formatoDiferencia(f.diferencia_yape_backend_seg)}</td>
      </tr>
    `;
  }).join("");

  cont.innerHTML = `
    <p style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:6px;">${filas.length} fila(s)</p>
    <div style="overflow-x:auto;">
      <table style="width:100%; min-width:760px; border-collapse:collapse; font-size:0.8rem; color:var(--text-primary);">
        <thead>
          <tr>
            <th style="${th}">Estado</th>
            <th style="${th}">Hora reporte</th>
            <th style="${th}">Origen (reporte)</th>
            <th style="${th}">Remitente (captura)</th>
            <th style="${th} text-align:right;">Monto</th>
            <th style="${th}">Hora captura</th>
            <th style="${th} text-align:right;">Δ app</th>
            <th style="${th} text-align:right;">Δ backend</th>
          </tr>
        </thead>
        <tbody>${cuerpo}</tbody>
      </table>
    </div>
  `;
}

// ============================================================
// Estado del feed (buscador, filtros, paginación).
//
// Vive en una sola variable de módulo porque esta app solo muestra
// un feed a la vez (no hay dos vistas de búsqueda simultáneas).
// Se reinicia por completo cada vez que renderFeedView() se llama.
// ============================================================

const DEBOUNCE_MS = 300;
const LIMA_OFFSET = "-05:00"; // Perú no tiene horario de verano, el offset es fijo

const HORA_DESDE_DEFAULT = "00:00";
const HORA_HASTA_DEFAULT = "23:59";

function hoyEnLima() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" });
}

let estadoFeed = null;

function crearEstadoInicial(device, esAdmin) {
  return {
    device,
    esAdmin,
    q: "",
    horaDesde: HORA_DESDE_DEFAULT,
    horaHasta: HORA_HASTA_DEFAULT,
    fechaDesde: hoyEnLima(),
    fechaHasta: hoyEnLima(),
    // Sede parte viendo solo lo accionable; admin/contable ve todo.
    soloEstado: esAdmin ? "todos" : "sin_reclamar",
    reclamadaPor: "",
    cursor: null,
    hayMas: true,
    cargando: false,
    abortController: null,
    debounceId: null,
    tocoFiltroAlgunaVez: false, // true en cuanto el usuario toca cualquier control
    cargoMasDeUnaTanda: false,
    pendientesNuevos: [], // yapeos que llegaron por SSE mientras había filtro activo
  };
}

function filtroActivo(estado) {
  const defaultEstado = estado.esAdmin ? "todos" : "sin_reclamar";
  return (
    estado.q.trim() !== "" ||
    estado.soloEstado !== defaultEstado ||
    estado.horaDesde !== HORA_DESDE_DEFAULT ||
    estado.horaHasta !== HORA_HASTA_DEFAULT ||
    estado.fechaDesde !== hoyEnLima() ||
    estado.fechaHasta !== hoyEnLima() ||
    estado.reclamadaPor !== "" ||
    estado.cargoMasDeUnaTanda
  );
}

export async function renderFeedView(device) {
  const app = document.getElementById("app");
  app.style.maxWidth = "";
  app.style.width = "";
  const esAdmin = localStorage.getItem("yape_tipo") === "admin";
  const sedeLogueada = localStorage.getItem("yape_sede_id");

  document.getElementById("view-title").innerText = (device === "" ? "Feed Global" : device) + " — " + sedeLogueada;
  document.getElementById("total-day-card").style.display = "flex";
  document.getElementById("live-indicator").style.display = "flex";

  estadoFeed = crearEstadoInicial(device, esAdmin);

  document.getElementById("btn-cambiar-canal").style.display = esAdmin ? "inline-flex" : "none";

  app.innerHTML = `
    ${renderBarraFiltros(esAdmin)}
    <div id="pendientes-anteriores-cont" style="display:none; margin-bottom:14px;"></div>
    <p id="contador-resultados" role="status" aria-live="polite"
       style="font-size:0.75rem; color:var(--text-secondary); margin:0 0 10px 0; min-height:1em;"></p>
    <div id="chip-nuevos" style="display:none; margin-bottom:10px;"></div>
    <div id="yape-list" class="yape-list"></div>
    <p id="estado-vacio" style="display:none; text-align:center; color:var(--text-secondary); font-size:0.85rem; padding:20px 0;"></p>
    <button id="btn-cargar-mas" class="btn btn-secondary" style="display:none; width:100%; margin-top:14px;">Cargar más</button>
  `;

  conectarControlesFiltro(esAdmin);
  await Promise.all([ejecutarBusqueda(true), cargarResumenDia(), actualizarPendientes()]);
  conectarSSE(device);
}

function renderBarraFiltros(esAdmin) {
  return `
    <div id="filtros-bar" style="display:flex; flex-direction:column; gap:8px; margin-bottom:6px;">
      <input id="input-busqueda" type="text" placeholder="Buscar por código, monto o nombre..."
        autocomplete="off"
        style="background:var(--panel-bg); border:1px solid var(--panel-border); color:var(--text-primary);
               padding:11px 14px; border-radius:8px; font-size:0.95rem; width:100%;" />

      <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
        <label style="font-size:0.75rem; color:var(--text-secondary); display:flex; align-items:center; gap:5px;">
          Desde
          <input id="hora-desde" type="time" value="${HORA_DESDE_DEFAULT}" style="${estiloInputChico()}" />
        </label>
        <label style="font-size:0.75rem; color:var(--text-secondary); display:flex; align-items:center; gap:5px;">
          Hasta
          <input id="hora-hasta" type="time" value="${HORA_HASTA_DEFAULT}" style="${estiloInputChico()}" />
        </label>

        ${esAdmin ? `
          <label style="font-size:0.75rem; color:var(--text-secondary); display:flex; align-items:center; gap:5px;">
            Fecha desde
            <input id="fecha-desde" type="date" value="${hoyEnLima()}" style="${estiloInputChico()}" />
          </label>
          <label style="font-size:0.75rem; color:var(--text-secondary); display:flex; align-items:center; gap:5px;">
            Fecha hasta
            <input id="fecha-hasta" type="date" value="${hoyEnLima()}" style="${estiloInputChico()}" />
          </label>
          <label style="font-size:0.75rem; color:var(--text-secondary); display:flex; align-items:center; gap:5px;">
            Sede
            <select id="filtro-sede-reclamante" style="${estiloInputChico()}">
              <option value="">Todas</option>
            </select>
          </label>
        ` : ""}

        <label style="font-size:0.75rem; color:var(--text-secondary); display:flex; align-items:center; gap:5px; margin-left:auto;">
          <input id="check-solo-sin-reclamar" type="checkbox" ${esAdmin ? "" : "checked"} />
          Solo sin reclamar
        </label>

        ${esAdmin ? `<button id="btn-exportar" class="btn btn-secondary" style="font-size:0.75rem; padding:5px 10px;">Exportar CSV</button>` : ""}
      </div>
    </div>
  `;
}

function estiloInputChico() {
  return "background:var(--panel-bg); border:1px solid var(--panel-border); color:var(--text-primary); " +
         "border-radius:6px; padding:4px 6px; font-size:0.78rem;";
}

function conectarControlesFiltro(esAdmin) {
  const inputBusqueda = document.getElementById("input-busqueda");
  inputBusqueda.addEventListener("input", () => {
    estadoFeed.q = inputBusqueda.value;
    estadoFeed.tocoFiltroAlgunaVez = true;
    dispararBusquedaConDebounce();
  });

  document.getElementById("hora-desde").addEventListener("change", (e) => {
    estadoFeed.horaDesde = e.target.value;
    estadoFeed.tocoFiltroAlgunaVez = true;
    ejecutarBusqueda(true);
  });
  document.getElementById("hora-hasta").addEventListener("change", (e) => {
    estadoFeed.horaHasta = e.target.value;
    estadoFeed.tocoFiltroAlgunaVez = true;
    ejecutarBusqueda(true);
  });

  if (esAdmin) {
    document.getElementById("fecha-desde").addEventListener("change", (e) => {
      estadoFeed.fechaDesde = e.target.value;
      estadoFeed.tocoFiltroAlgunaVez = true;
      ejecutarBusqueda(true);
    });
    document.getElementById("fecha-hasta").addEventListener("change", (e) => {
      estadoFeed.fechaHasta = e.target.value;
      estadoFeed.tocoFiltroAlgunaVez = true;
      ejecutarBusqueda(true);
    });
    const selectSedeReclamante = document.getElementById("filtro-sede-reclamante");
    obtenerSedes().then(sedes => {
      sedes.forEach(s => selectSedeReclamante.add(new Option(s, s)));
    });
    selectSedeReclamante.addEventListener("change", (e) => {
      estadoFeed.reclamadaPor = e.target.value;
      estadoFeed.tocoFiltroAlgunaVez = true;
      ejecutarBusqueda(true);
    });
    
    document.getElementById("btn-exportar").addEventListener("click", exportarCSV);
  }

  document.getElementById("check-solo-sin-reclamar").addEventListener("change", (e) => {
    estadoFeed.soloEstado = e.target.checked ? "sin_reclamar" : "todos";
    estadoFeed.tocoFiltroAlgunaVez = true;
    ejecutarBusqueda(true);
  });

  document.getElementById("btn-cargar-mas").addEventListener("click", () => {
    estadoFeed.cargoMasDeUnaTanda = true;
    ejecutarBusqueda(false);
  });
}

// ============================================================
// Validación del término de búsqueda antes de disparar la request.
//
// Numérico (código o monto) -> válido desde el primer dígito.
// Texto -> mínimo 3 caracteres, si no Postgres no tiene trigramas
// suficientes y cae a escaneo completo.
// ============================================================
function terminoValido(q) {
  const t = q.trim();
  if (!t) return true; // vacío = sin filtro de texto, siempre válido
  if (/^\d+([.,]\d{1,2})?$/.test(t)) return true;
  return t.length >= 3;
}

function dispararBusquedaConDebounce() {
  clearTimeout(estadoFeed.debounceId);

  const contador = document.getElementById("contador-resultados");
  if (!terminoValido(estadoFeed.q)) {
    contador.innerText = "Escribe al menos 3 letras para buscar por nombre";
    if (!estadoFeed.esAdmin) {
      const cont = document.getElementById("pendientes-anteriores-cont");
      cont.style.display = "none";
      cont.innerHTML = "";
    }
    return;
  }

  // Feedback inmediato: el spinner aparece al instante aunque la
  // request recién salga 300ms después.
  contador.innerText = "Buscando...";

  estadoFeed.debounceId = setTimeout(() => ejecutarBusqueda(true), DEBOUNCE_MS);
}

// Combina fecha + hora en ISO con el offset fijo de Lima.
// Si falta la hora, usa el límite del día (00:00 o 23:59:59).
// El "hasta" siempre cierra en :59 -- incluso con hora explícita --
// para que "hasta las 18:00" incluya todo ese minuto y no lo excluya
// por los segundos.
function construirISO(fecha, hora, esInicio) {
  if (!fecha && !hora) return null;

  const fechaEf = fecha || hoyEnLima();
  let horaEf = hora || (esInicio ? "00:00" : "23:59");

  // El input type=time devuelve "HH:MM", o "HH:MM:SS" si tiene step="1".
  // Solo agregamos los segundos si no vienen ya.
  if (horaEf.split(":").length === 2) {
    horaEf += esInicio ? ":00" : ":59";
  }

  return `${fechaEf}T${horaEf}${LIMA_OFFSET}`;
}

function calcularRangoISO(estado) {
  const desde = construirISO(estado.fechaDesde, estado.horaDesde, true);
  const hasta = construirISO(estado.fechaHasta || estado.fechaDesde, estado.horaHasta, false);
  return { desde, hasta };
}

async function ejecutarBusqueda(reset) {
  const estado = estadoFeed;
  if (!estado) return; // la vista ya cambió (p.ej. el usuario navegó)

  if (reset) {
    if (estado.abortController) estado.abortController.abort();
    estado.cursor = null;
    estado.hayMas = true;
    document.getElementById("yape-list").innerHTML = "";
    document.getElementById("estado-vacio").style.display = "none";
  }

  if (!estado.hayMas || estado.cargando) return;

  estado.cargando = true;
  const controller = new AbortController();
  estado.abortController = controller;

  const params = new URLSearchParams();
  const t = estado.q.trim();
  if (t) params.set("q", t);
  params.set("estado", estado.soloEstado);
  if (estado.device) params.set("device", estado.device);
  if (estado.reclamadaPor) params.set("reclamado_por_filtro", estado.reclamadaPor);
  if (estado.cursor) {
    params.set("cursor_ts", estado.cursor.cursor_ts);
    params.set("cursor_id", estado.cursor.cursor_id);
  }

  const { desde, hasta } = calcularRangoISO(estado);
  if (desde) params.set("desde", desde);
  if (hasta) params.set("hasta", hasta);

  try {
    const res = await apiFetch(`/yapes?${params.toString()}`, { signal: controller.signal });
    if (!res.ok) {
      let detalle = `Error ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson.detail) detalle = errJson.detail;
      } catch (_) { /* la respuesta no era JSON */ }
      throw new Error(detalle);
    }
    const data = await res.json();

    if (estado !== estadoFeed) return; // la vista cambió mientras esperábamos

    const listContainer = document.getElementById("yape-list");
    data.items.forEach(item => listContainer.appendChild(createYapeCard(item)));

    estado.cursor = data.siguiente;
    estado.hayMas = !!data.siguiente;

    document.getElementById("btn-cargar-mas").style.display = estado.hayMas ? "block" : "none";
    actualizarContador(data, estado, reset);

    if (reset && data.items.length === 0) {
      mostrarEstadoVacio(estado);
    }
    if (reset) actualizarPendientes();
  } catch (err) {
    if (err.name === "AbortError") return; // reemplazada por una búsqueda más nueva
    console.error("Error en búsqueda:", err);
    document.getElementById("contador-resultados").innerText = err.message || "Error al buscar. Intenta de nuevo.";
  } finally {
    if (estado === estadoFeed) estado.cargando = false;
  }
}

function actualizarContador(data, estado, reset) {
  const contador = document.getElementById("contador-resultados");
  if (data.resumen_filtrado) {
    contador.innerText = `${data.resumen_filtrado.cantidad} resultado(s) · S/ ${data.resumen_filtrado.suma.toFixed(2)}`;
  } else if (reset) {
    contador.innerText = "";
  }
}

function mostrarEstadoVacio(estado) {
  const vacio = document.getElementById("estado-vacio");

  if (estado.soloEstado === "sin_reclamar") {
    vacio.innerHTML = `
      No hay pagos sin reclamar${estado.q ? " con ese criterio" : ""}.<br>
      <button id="btn-ver-reclamados" class="btn btn-secondary" style="margin-top:10px;">Ver los ya reclamados</button>
    `;
    vacio.style.display = "block";
    document.getElementById("btn-ver-reclamados").addEventListener("click", () => {
      document.getElementById("check-solo-sin-reclamar").checked = false;
      estado.soloEstado = "todos";
      estado.tocoFiltroAlgunaVez = true;
      ejecutarBusqueda(true);
    });
  } else {
    vacio.innerText = "Sin resultados para esta búsqueda.";
    vacio.style.display = "block";
  }
}

// ============================================================
// Resumen del día (total fijo, separado del subtotal de búsqueda)
// ============================================================

async function cargarResumenDia() {
  try {
    const res = await apiFetch("/yapes/resumen");
    if (!res.ok) return;
    const data = await res.json();
    pintarResumenDia(data);
  } catch (err) {
    console.error("Error al cargar el resumen del día:", err);
  }
}

async function actualizarPendientes() {
  const estado = estadoFeed;
  if (!estado) return;
  const cont = document.getElementById("pendientes-anteriores-cont");

  // Admin ya tiene fecha + "Solo sin reclamar" en su propio feed para
  // encontrar pendientes de cualquier rango -- no necesita esta sección
  // aparte, que además competía visualmente con esos mismos filtros.
  if (estado.esAdmin) {
    cont.style.display = "none";
    cont.innerHTML = "";
    return;
  }

  // Sede: solo se consulta si hay un término de búsqueda válido en curso.
  // Sin búsqueda no se muestra nada -- nunca un contador esperando a vaciarse.
  const t = estado.q.trim();
  if (!t || !terminoValido(t)) {
    cont.style.display = "none";
    cont.innerHTML = "";
    return;
  }

  try {
    const params = new URLSearchParams();
    const t = estado.q.trim();
    if (t) params.set("q", t);
    const res = await apiFetch(`/yapes/pendientes-anteriores?${params.toString()}`);
    if (!res.ok) return;
    const data = await res.json();

    if (estado !== estadoFeed) return;

    pintarPendientes(data.items, estado.esAdmin);
  } catch (err) {
    console.error("Error al cargar pendientes:", err);
  }
}

function pintarPendientes(items, esAdmin) {
  const cont = document.getElementById("pendientes-anteriores-cont");

  if (items.length === 0) {
    if (esAdmin) {
      cont.style.display = "block";
      cont.innerHTML = `<p style="color:var(--text-secondary); font-size:0.8rem; padding:6px 0;">Sin pendientes de días anteriores.</p>`;
    } else {
      cont.style.display = "none";
      cont.innerHTML = "";
    }
    return;
  }

  cont.style.display = "block";
  const titulo = esAdmin
    ? `<p style="color:var(--text-secondary); font-size:0.8rem; font-weight:600; margin-bottom:8px;">Pendientes de días anteriores (${items.length})</p>`
    : `<p style="color:var(--text-secondary); font-size:0.8rem; font-weight:600; margin-bottom:8px;">De días anteriores</p>`;

  const lista = document.createElement("div");
  lista.className = "yape-list";
  items.forEach(item => lista.appendChild(createYapeCard(item, { esPendiente: true })));

  cont.innerHTML = titulo;
  cont.appendChild(lista);
}

function pintarResumenDia(data) {
  const label = document.querySelector("#total-day-card .summary-label");
  const monto = document.getElementById("total-day-amount");
  if (label) label.innerText = data.alcance === "sede" ? "Mis reclamados hoy:" : "Hoy:";
  if (monto) monto.innerText = `S/ ${data.suma.toFixed(2)}`;
  monto.dataset.cantidad = data.cantidad; // por si se necesita luego
}

function incrementarResumenDia(monto) {
  const el = document.getElementById("total-day-amount");
  if (!el) return;
  const actual = parseFloat(el.innerText.replace("S/", "").trim()) || 0;
  el.innerText = `S/ ${(actual + Number(monto)).toFixed(2)}`;
}

// ============================================================
// Export CSV (solo admin)
// ============================================================

async function exportarCSV() {
  const estado = estadoFeed;
  const params = new URLSearchParams();
  const t = estado.q.trim();
  if (t) params.set("q", t);
  params.set("estado", estado.soloEstado);
  if (estado.device) params.set("device", estado.device);
  if (estado.reclamadaPor) params.set("reclamado_por_filtro", estado.reclamadaPor);

  const { desde, hasta } = calcularRangoISO(estado);
  if (desde) params.set("desde", desde);
  if (hasta) params.set("hasta", hasta);

  const btn = document.getElementById("btn-exportar");
  btn.disabled = true;
  btn.innerText = "Exportando...";

  try {
    // No se puede usar un <a href> directo porque el endpoint requiere
    // el header Authorization -- lo traemos como blob y disparamos la
    // descarga manualmente.
    const res = await apiFetch(`/yapes/export?${params.toString()}`);
    if (!res.ok) throw new Error("Error al exportar");

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "yapes_export.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert("No se pudo exportar. Intenta de nuevo.");
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.innerText = "Exportar CSV";
  }
}

// ============================================================
// SSE: conecta y decide si inserta en vivo o guarda como pendiente
// ============================================================

function conectarSSE(device) {
  const token = localStorage.getItem("yape_token");
  const estado = estadoFeed;

  const armarUrl = async () => {
    const { API_BASE } = await import("./api.js");
    return device
      ? `${API_BASE}/yapes/stream?device=${encodeURIComponent(device)}&token=${token}`
      : `${API_BASE}/yapes/stream?token=${token}`;
  };

  armarUrl().then(streamUrl => {
    const eventSource = new EventSource(streamUrl);

    eventSource.onmessage = (event) => {
      if (estado !== estadoFeed) {
        eventSource.close(); // la vista cambió, esta conexión ya no sirve
        return;
      }

      const data = JSON.parse(event.data);

      if (data.tipo === "reclamo") {
        actualizarEstadoTarjeta(data.yape_id, data.reclamado_por);
        if (!estado.esAdmin && data.reclamado_por === localStorage.getItem("yape_sede_id")) {
          // Nota: esto suma en cada reclamo propio, incluyendo reasignaciones
          // hacia la sede. No resta si se reasigna AWAY -- caso raro, se
          // corrige recargando el resumen si hace falta.
          cargarResumenDia();
        }
        return;
      }

      // data.tipo === "nuevo_yapeo"
      if (estado.esAdmin) incrementarResumenDia(data.monto);

      if (filtroActivo(estado)) {
        estado.pendientesNuevos.push(data);
        mostrarChipNuevos(estado);
      } else {
        document.getElementById("yape-list").prepend(createYapeCard(data));
        if (soundEnabled) {
          audio.currentTime = 0;
          audio.play().catch(() => {});
        }
      }
    };
  });
}

function mostrarChipNuevos(estado) {
  const chip = document.getElementById("chip-nuevos");
  const n = estado.pendientesNuevos.length;
  chip.style.display = "block";
  chip.innerHTML = `
    <button class="btn" style="width:100%;">
      ${n} yapeo${n > 1 ? "s" : ""} nuevo${n > 1 ? "s" : ""} · ver
    </button>
  `;
  chip.querySelector("button").onclick = () => {
    // Limpiar filtros de texto/fecha no correspondería acá -- solo
    // recargamos la búsqueda actual, que ya va a incluir lo nuevo
    // porque quedó guardado en el servidor.
    estado.pendientesNuevos = [];
    chip.style.display = "none";
    ejecutarBusqueda(true);
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

function createYapeCard(data, opts = {}) {
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
  const etiquetaPendiente = opts.esPendiente ? `<span class="meta-tag">Pendiente</span> ` : "";
  const dev = data.deviceId ? `<span class="meta-tag">${data.deviceId}</span>` : "";
  const esAdmin = localStorage.getItem("yape_tipo") === "admin";

  card.innerHTML = `
    <div class="yape-row-main">
      <span class="remitente">${etiquetaPendiente}${data.remitente}</span>
      <span class="monto">S/ ${data.monto.toFixed(2)}</span>
    </div>
    <div class="yape-row-sub">
      <div style="display:flex; gap:6px; align-items:center;">${dev}${codigo}${renderEstadoHTML(data.id, data.reclamado_por, esAdmin)}</div>
      <span>${fechaTexto}</span>
    </div>
  `;

  if (!data.reclamado_por && !esAdmin) {
    card.style.cursor = "pointer";
    card.addEventListener("click", () => abrirModalReclamo(data.id, data.remitente, data.monto, fechaTexto, data.codigoSeguridad, opts.esPendiente));
  }

  return card;
}

function abrirModalReclamo(yapeId, remitente, monto, fechaTexto, codigo, esPendiente) {
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:1000;";
  overlay.innerHTML = `
    <div style="background:var(--panel-bg); border:1px solid var(--panel-border); border-radius:10px; padding:20px; max-width:300px; text-align:center;">
      <p style="margin-bottom:10px; font-size:0.9rem;">¿Confirmas que vas a atender este yapeo?</p>
      <p style="font-weight:600; font-size:1rem;">${remitente}</p>
      <p style="color:var(--status-green); font-weight:700; font-size:1.15rem; margin:4px 0;">S/ ${monto.toFixed(2)}</p>
      ${codigo ? `<p style="color:var(--text-secondary); font-size:0.8rem;">Cód: ${codigo}</p>` : ""}
      ${esPendiente ? `<p style="color:var(--text-secondary); font-size:0.78rem; margin:4px 0;">Es de un día anterior. Confirma que corresponde a una venta tuya.</p>` : ""}
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
    alert((data.detail || "Ya fue reclamado por otra sede") + "\n\nNo entregues el producto. Comunica el caso a contabilidad con el código del yapeo.");
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

// toggleAsignacion, cancelarAsignacion y confirmarAsignacion se llaman desde
// atributos onclick inline generados dinámicamente (innerHTML), así que
// necesitan quedar expuestas en window ya que los módulos ES no las hacen
// globales automáticamente.
window.toggleAsignacion = toggleAsignacion;
window.cancelarAsignacion = cancelarAsignacion;
window.confirmarAsignacion = confirmarAsignacion;
window.irAConciliacion = renderConciliacionView;
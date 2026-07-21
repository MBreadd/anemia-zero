const state = {
  user: null,
  patients: [],
  currentView: "overview",
  peruDepartments: null,
  deptByName: {},
  deptStats: {},
  punoProvinces: null,
  provinceByName: {},
  provinceStats: {},
  mapLevel: "nacional",
  selectedZone: null,
  ayudas: [],
  referencia: null
};

// ---------- Helpers ----------
function levelColor(level) {
  if (level === "alto") return "#ef4444";
  if (level === "medio") return "#f59e0b";
  return "#22c55e";
}

function levelBadgeClasses(level) {
  if (level === "alto") return "bg-red-100 text-red-700";
  if (level === "medio") return "bg-amber-100 text-amber-700";
  return "bg-green-100 text-green-700";
}

function alertColor(level) {
  switch (level) {
    case "critico": return "#ef4444";
    case "alerta": return "#fb923c";
    case "moderado": return "#facc15";
    case "bajo": return "#4ade80";
    default: return "#e2e8f0";
  }
}

function alertLabel(level) {
  switch (level) {
    case "critico": return "Crítico";
    case "alerta": return "Alerta";
    case "moderado": return "Moderado";
    case "bajo": return "Bajo";
    default: return "Sin datos";
  }
}

function alertBadgeClasses(level) {
  switch (level) {
    case "critico": return "bg-red-100 text-red-700";
    case "alerta": return "bg-orange-100 text-orange-700";
    case "moderado": return "bg-yellow-100 text-yellow-700";
    case "bajo": return "bg-green-100 text-green-700";
    default: return "bg-slate-100 text-slate-500";
  }
}

function toast(message, type = "info") {
  const colors = { success: "bg-green-600", error: "bg-red-600", info: "bg-slate-800" };
  const el = document.createElement("div");
  el.className = `${colors[type] || colors.info} text-white text-sm font-medium px-4 py-3 rounded-xl shadow-xl animate-slide-in-right max-w-xs`;
  el.textContent = message;
  document.getElementById("toastContainer").appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity .3s ease, transform .3s ease";
    el.style.opacity = "0";
    el.style.transform = "translateX(16px)";
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

function animateCount(el, target, isFloat) {
  const startTime = performance.now();
  const duration = 650;
  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = target * eased;
    el.textContent = isFloat ? value.toFixed(1) : Math.round(value).toLocaleString("es-PE");
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = isFloat ? target.toFixed(1) : target.toLocaleString("es-PE");
  }
  requestAnimationFrame(tick);
}

function replay(el, className) {
  if (!el) return;
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
}

async function api(path, options) {
  const response = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  const data = await response.json().catch(() => ({ ok: false, error: "Respuesta invalida" }));
  if (response.status === 401 && path !== "/api/auth/me" && path !== "/api/auth/login") showLogin();
  return data;
}

// ---------- Auth ----------
function initials(name) {
  return (name || "?").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
}

function applyRoleVisibility() {
  const role = state.user ? state.user.role : null;
  document.querySelectorAll("[data-role]").forEach((el) => {
    const allowed = el.getAttribute("data-role").split(",");
    el.classList.toggle("hidden", !allowed.includes(role));
  });
}

function showLogin() {
  state.user = null;
  document.getElementById("appShell").classList.add("hidden");
  document.getElementById("appShell").classList.remove("lg:grid");
  document.getElementById("loginScreen").style.display = "flex";
  document.getElementById("loginError").classList.add("hidden");
  document.getElementById("loginForm").reset();
}

function showApp() {
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("appShell").classList.remove("hidden");
  document.getElementById("appShell").classList.add("lg:grid");
  document.getElementById("sidebarName").textContent = state.user.name;
  document.getElementById("sidebarRole").textContent = state.user.role === "admin" ? "Administración" : "Promotor de salud";
  document.getElementById("sidebarInitials").textContent = initials(state.user.name);
  applyRoleVisibility();
  switchView("overview");
  refreshAll();
}

async function checkSession() {
  const result = await api("/api/auth/me");
  if (result.ok) { state.user = result.data; showApp(); } else { showLogin(); }
}

async function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;
  const errorBox = document.getElementById("loginError");
  const result = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });

  if (!result.ok) {
    errorBox.textContent = result.error || "No se pudo iniciar sesión";
    errorBox.classList.remove("hidden");
    replay(errorBox, "animate-pop-in");
    return;
  }

  state.user = result.data;
  showApp();
}

async function handleLogout() {
  await api("/api/auth/logout", { method: "POST" });
  showLogin();
}

// ---------- Views ----------
function switchView(view) {
  state.currentView = view;
  document.querySelectorAll(".view").forEach((section) => {
    const isActive = section.id === `view-${view}`;
    section.classList.toggle("active", isActive);
    if (isActive) replay(section, "animate-fade-in");
  });
  document.querySelectorAll(".nav-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.view === view));
}

// ---------- Patients ----------
function getFormPatient() {
  const departamento = document.getElementById("f_departamento").value;
  const provinciaSelect = document.getElementById("f_provincia");
  return {
    nombre: document.getElementById("f_nombre").value.trim() || "Sin nombre",
    edad: Number(document.getElementById("f_edad").value || 0),
    hb: Number(document.getElementById("f_hb").value || 0),
    km: Number(document.getElementById("f_km").value || 0),
    omitidas: Number(document.getElementById("f_om").value || 0),
    idioma: document.getElementById("f_idioma").value,
    departamento,
    provincia: departamento === "PUNO" ? provinciaSelect.value : "",
    chatId: ""
  };
}

function deptLabel(name) {
  const dept = state.deptByName[name];
  return dept ? dept.label : name;
}

function provLabel(name) {
  const prov = state.provinceByName[name];
  return prov ? prov.label : name;
}

function patientRow(p, { showIdioma } = {}) {
  const color = levelColor(p.riskLevel);
  const location = p.provincia ? `${provLabel(p.provincia)}, ${deptLabel(p.departamento)}` : deptLabel(p.departamento);
  return `
    <tr class="border-t border-slate-100 hover:bg-slate-50 transition">
      <td class="px-3.5 py-2.5"><strong class="font-semibold">${p.nombre}</strong><br><span class="text-xs text-slate-400">${p.km} km de la posta</span></td>
      <td class="px-3.5 py-2.5">${p.edad} m</td>
      <td class="px-3.5 py-2.5 tabular-nums">${Number(p.hb).toFixed(1)}</td>
      <td class="px-3.5 py-2.5">
        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${levelBadgeClasses(p.riskLevel)}">${p.riskScore}% ${p.riskLevel}</span>
        <div class="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1.5 max-w-[100px]"><div class="h-full rounded-full" style="width:${p.riskScore}%;background:${color}"></div></div>
      </td>
      <td class="px-3.5 py-2.5 text-slate-600">${location}</td>
      ${showIdioma ? `<td class="px-3.5 py-2.5 text-slate-600">${p.idioma}</td>` : ""}
    </tr>
  `;
}

function renderPatients() {
  const query = (document.getElementById("patientSearch").value || "").toLowerCase();
  const filtered = state.patients.filter((p) =>
    p.nombre.toLowerCase().includes(query) ||
    p.idioma.toLowerCase().includes(query) ||
    deptLabel(p.departamento).toLowerCase().includes(query) ||
    (p.provincia && provLabel(p.provincia).toLowerCase().includes(query))
  );

  document.getElementById("tbody").innerHTML = filtered.map((p) => patientRow(p, { showIdioma: true })).join("");
  document.getElementById("vacio").classList.toggle("hidden", filtered.length > 0);
  document.getElementById("patientCount").textContent = `${filtered.length} pacientes`;
}

function renderPriority() {
  const top = [...state.patients].sort((a, b) => b.riskScore - a.riskScore).slice(0, 5);
  document.getElementById("tbodyPriority").innerHTML = top.map((p) => patientRow(p, { showIdioma: false })).join("");
  document.getElementById("vacioPriority").classList.toggle("hidden", top.length > 0);
}

function riskRow(label, count, total, color) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return `
    <div class="flex items-center gap-3 text-sm">
      <span class="w-16 text-slate-600">${label}</span>
      <div class="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden"><div class="h-full rounded-full transition-all duration-700" style="width:${pct}%;background:${color}"></div></div>
      <span class="w-16 text-right text-slate-500 tabular-nums text-xs">${count} (${pct}%)</span>
    </div>
  `;
}

function renderRiskDistribution() {
  const total = state.patients.length;
  const levels = [
    { key: "alto", label: "Alto", color: "#ef4444" },
    { key: "medio", label: "Medio", color: "#f59e0b" },
    { key: "bajo", label: "Bajo", color: "#22c55e" }
  ];
  document.getElementById("riskDistribution").innerHTML = levels
    .map((lvl) => riskRow(lvl.label, state.patients.filter((p) => p.riskLevel === lvl.key).length, total, lvl.color))
    .join("");
}

function statTile(label, value, accent, id) {
  return `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 animate-fade-up hover:shadow-md hover:-translate-y-0.5 transition-all">
      <span class="block text-xs text-slate-500 mb-1.5">${label}</span>
      <b id="${id}" class="text-2xl font-extrabold tabular-nums" style="color:${accent || "#0f172a"}">${value}</b>
    </div>
  `;
}

async function refreshStats() {
  const stats = await api("/api/stats");
  if (!stats.ok) return;
  document.getElementById("ov_stats").innerHTML =
    statTile("Niños monitoreados", "0", null, "s_total") +
    statTile("Riesgo alto", "0", "#ef4444", "s_alto") +
    statTile("Hb promedio (g/dL)", "0", null, "s_hb") +
    statTile("Ayudas enviadas", "0", "#2563eb", "s_ayudas");

  animateCount(document.getElementById("s_total"), stats.data.total, false);
  animateCount(document.getElementById("s_alto"), stats.data.alto, false);
  document.getElementById("s_hb").textContent = stats.data.hbPromedio ?? "-";
  animateCount(document.getElementById("s_ayudas"), stats.data.ayudasEnviadas, false);
}

async function refreshPatients() {
  const result = await api("/api/patients");
  if (result.ok) {
    state.patients = result.data;
    renderPatients();
    renderPriority();
    renderRiskDistribution();
  }
}

async function refreshAll() {
  await loadPeruDepartments();
  await Promise.all([refreshPatients(), refreshStats(), refreshAnalytics(), loadAyudas(), loadReferencia()]);
  await initPeruMap();
  await refreshChoropleths();
  renderOverviewRanking();
}

async function registerPatient() {
  const payload = getFormPatient();
  const result = await api("/api/patients", { method: "POST", body: JSON.stringify(payload) });

  if (!result.ok) {
    toast(result.error || "Error al registrar paciente", "error");
    return;
  }

  const { patient, prediction } = result.data;
  toast(`${patient.nombre} registrado — riesgo ${prediction.score}% (${prediction.level})`, "success");
  await refreshAll();
}

async function seedDemo() {
  const demo = [
    { nombre: "Mayra Q.", edad: 14, hb: 9.4, km: 12, omitidas: 7, idioma: "Quechua", departamento: "PUNO", provincia: "SAN ROMAN" },
    { nombre: "Elmer H.", edad: 22, hb: 8.1, km: 19, omitidas: 9, idioma: "Aymara", departamento: "PUNO", provincia: "CHUCUITO" },
    { nombre: "Nayeli C.", edad: 9, hb: 8.9, km: 8, omitidas: 6, idioma: "Quechua", departamento: "CUSCO" },
    { nombre: "Josue M.", edad: 30, hb: 11.6, km: 1.5, omitidas: 0, idioma: "Español", departamento: "LIMA" },
    { nombre: "Rosa T.", edad: 6, hb: 7.9, km: 17, omitidas: 8, idioma: "Aymara", departamento: "PUNO", provincia: "AZANGARO" },
    { nombre: "Kevin A.", edad: 11, hb: 9.0, km: 10, omitidas: 6, idioma: "Quechua", departamento: "CUSCO" },
    { nombre: "Diana P.", edad: 19, hb: 9.6, km: 7, omitidas: 3, idioma: "Español", departamento: "HUANCAVELICA" },
    { nombre: "Fabricio L.", edad: 13, hb: 10.5, km: 3, omitidas: 1, idioma: "Español", departamento: "PUNO", provincia: "PUNO" }
  ];

  for (const patient of demo) {
    await api("/api/patients", { method: "POST", body: JSON.stringify(patient) });
  }

  toast("Datos demo cargados", "success");
  await refreshAll();
}

// ---------- Overview: predictive ranking ----------
function renderOverviewRanking() {
  const rows = Object.values(state.deptStats).filter((r) => r.total > 0).sort((a, b) => b.vulnerabilityIndex - a.vulnerabilityIndex).slice(0, 6);
  const container = document.getElementById("ov_ranking");
  if (!rows.length) {
    container.innerHTML = `<p class="text-sm text-slate-400">Aún no hay suficientes pacientes registrados para calcular el ranking.</p>`;
    return;
  }
  container.innerHTML = rows.map((row) => `
    <div class="flex items-center gap-3">
      <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${alertColor(row.alertLevel)}"></span>
      <span class="flex-1 text-sm font-medium truncate">${deptLabel(row.departamento)}</span>
      <span class="text-xs font-bold px-2 py-0.5 rounded-full ${alertBadgeClasses(row.alertLevel)}">${alertLabel(row.alertLevel)}</span>
      <span class="text-xs text-slate-500 tabular-nums w-16 text-right">${row.total} pac.</span>
    </div>
  `).join("");
}

// ---------- Geo data loading ----------
async function loadPeruDepartments() {
  if (state.peruDepartments) return state.peruDepartments;
  const result = await api("/api/geo/peru-departments");
  if (!result.ok) return null;
  state.peruDepartments = result.data;
  state.deptByName = {};
  result.data.departments.forEach((d) => { state.deptByName[d.name] = d; });
  populateDepartmentSelect(result.data.departments);
  return result.data;
}

async function loadPunoProvinces() {
  if (state.punoProvinces) return state.punoProvinces;
  const result = await api("/api/geo/puno-provinces");
  if (!result.ok) return null;
  state.punoProvinces = result.data;
  state.provinceByName = {};
  result.data.provinces.forEach((p) => { state.provinceByName[p.name] = p; });
  populateProvinceSelect(result.data.provinces);
  return result.data;
}

async function loadReferencia() {
  const result = await api("/api/referencia/salud");
  if (result.ok) { state.referencia = result.data; renderReferencia(); }
}

function renderReferencia() {
  const ref = state.referencia;
  if (!ref) return;

  const max = Math.max(...ref.rankingDepartamentos.map((d) => d.prevalencia), 1);
  document.getElementById("ref_ranking").innerHTML = ref.rankingDepartamentos.map((d) => `
    <div class="flex items-center gap-3 text-sm">
      <span class="w-32 truncate ${d.departamento === "PUNO" ? "font-bold text-red-700" : "text-slate-600"}">${deptLabel(d.departamento) || d.departamento}</span>
      <div class="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <div class="h-full rounded-full ${d.departamento === "PUNO" ? "bg-red-500" : "bg-slate-400"} transition-all duration-700" style="width:${(d.prevalencia / max) * 100}%"></div>
      </div>
      <span class="w-14 text-right tabular-nums text-xs font-semibold ${d.departamento === "PUNO" ? "text-red-700" : "text-slate-500"}">${d.prevalencia}%</span>
    </div>
  `).join("");

  document.getElementById("ref_puno_prev").textContent = `${ref.puno.prevalenciaAnemia6a35meses}%`;
  document.getElementById("ref_nacional_prev").textContent = `${ref.promedioNacional}%`;
  document.getElementById("ref_puno_pop").textContent = ref.puno.poblacionDepartamento2023Proyectada.toLocaleString("es-PE");
  document.getElementById("ref_sources").innerHTML =
    `Fuente: ${ref.fuente}. ` +
    ref.sources.map((s) => `<a href="${s.url}" target="_blank" rel="noopener" class="text-blue-600 hover:underline">${s.titulo}</a>`).join(" · ");
}

function populateDepartmentSelect(departments) {
  const select = document.getElementById("f_departamento");
  const rest = departments.filter((d) => d.name !== "PUNO").sort((a, b) => a.label.localeCompare(b.label, "es"));
  const puno = departments.find((d) => d.name === "PUNO");
  const ordered = puno ? [puno, ...rest] : rest;
  select.innerHTML = ordered.map((d) => `<option value="${d.name}">${d.label}</option>`).join("");
}

function populateProvinceSelect(provinces) {
  const select = document.getElementById("f_provincia");
  const ordered = [...provinces].sort((a, b) => a.label.localeCompare(b.label, "es"));
  select.innerHTML = ordered.map((p) => `<option value="${p.name}">${p.label}</option>`).join("");
}

function handleDepartamentoChange() {
  const isPuno = document.getElementById("f_departamento").value === "PUNO";
  const wrap = document.getElementById("f_provincia_wrap");
  wrap.hidden = !isPuno;
  if (isPuno) replay(wrap, "animate-fade-up");
}

// ---------- Live Peru map: zoom/pan engine ----------
const mapView = { scale: 1, tx: 0, ty: 0, min: 1, max: 10 };
let mapInitialized = false;
let mapDrag = null;
let mapPinch = null;
let mapJustDragged = false;

function applyMapTransform() {
  document.getElementById("peruMapLayer").setAttribute("transform", `translate(${mapView.tx},${mapView.ty}) scale(${mapView.scale})`);
}

function getSvgPoint(clientX, clientY) {
  const svg = document.getElementById("peruMapLive");
  const pt = svg.createSVGPoint();
  pt.x = clientX; pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const transformed = pt.matrixTransform(ctm.inverse());
  return { x: transformed.x, y: transformed.y };
}

function zoomAt(px, py, newScale) {
  const clamped = Math.min(mapView.max, Math.max(mapView.min, newScale));
  const cx = (px - mapView.tx) / mapView.scale;
  const cy = (py - mapView.ty) / mapView.scale;
  mapView.tx = px - clamped * cx;
  mapView.ty = py - clamped * cy;
  mapView.scale = clamped;
  applyMapTransform();
}

function resetMapView() {
  mapView.scale = 1; mapView.tx = 0; mapView.ty = 0;
  applyMapTransform();
}

function currentGeo() {
  return state.mapLevel === "puno" ? state.punoProvinces : state.peruDepartments;
}

function zoomToBbox(bbox) {
  const data = currentGeo();
  if (!data) return;
  const [x1, y1, x2, y2] = bbox;
  const bw = Math.max(x2 - x1, 1);
  const bh = Math.max(y2 - y1, 1);
  const padding = 0.75;
  const scaleX = (data.viewBoxWidth / bw) * padding;
  const scaleY = (data.viewBoxHeight / bh) * padding;
  const scale = Math.min(Math.max(Math.min(scaleX, scaleY), mapView.min), mapView.max);
  const centerX = (x1 + x2) / 2;
  const centerY = (y1 + y2) / 2;
  mapView.scale = scale;
  mapView.tx = data.viewBoxWidth / 2 - scale * centerX;
  mapView.ty = data.viewBoxHeight / 2 - scale * centerY;
  applyMapTransform();
}

function setupMapInteractions() {
  const stage = document.getElementById("mapStage");

  stage.addEventListener("wheel", (event) => {
    event.preventDefault();
    const point = getSvgPoint(event.clientX, event.clientY);
    const factor = event.deltaY < 0 ? 1.2 : 1 / 1.2;
    zoomAt(point.x, point.y, mapView.scale * factor);
  }, { passive: false });

  stage.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    mapDrag = { startClient: { x: event.clientX, y: event.clientY }, lastPoint: getSvgPoint(event.clientX, event.clientY), moved: 0 };
    stage.classList.add("grabbing");
  });

  window.addEventListener("mousemove", (event) => {
    if (!mapDrag) return;
    const point = getSvgPoint(event.clientX, event.clientY);
    mapView.tx += point.x - mapDrag.lastPoint.x;
    mapView.ty += point.y - mapDrag.lastPoint.y;
    mapDrag.lastPoint = point;
    mapDrag.moved += Math.abs(event.clientX - mapDrag.startClient.x) + Math.abs(event.clientY - mapDrag.startClient.y);
    applyMapTransform();
  });

  window.addEventListener("mouseup", () => {
    if (mapDrag) {
      mapJustDragged = mapDrag.moved > 6;
      setTimeout(() => { mapJustDragged = false; }, 0);
    }
    mapDrag = null;
    stage.classList.remove("grabbing");
  });

  stage.addEventListener("touchstart", (event) => {
    if (event.touches.length === 1) {
      const t = event.touches[0];
      mapDrag = { lastPoint: getSvgPoint(t.clientX, t.clientY), moved: 0 };
    } else if (event.touches.length === 2) {
      mapDrag = null;
      const [t1, t2] = event.touches;
      mapPinch = { startDist: Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY), startScale: mapView.scale };
    }
  }, { passive: true });

  stage.addEventListener("touchmove", (event) => {
    if (event.touches.length === 1 && mapDrag) {
      const t = event.touches[0];
      const point = getSvgPoint(t.clientX, t.clientY);
      mapView.tx += point.x - mapDrag.lastPoint.x;
      mapView.ty += point.y - mapDrag.lastPoint.y;
      mapDrag.lastPoint = point;
      mapDrag.moved += 1;
      applyMapTransform();
    } else if (event.touches.length === 2 && mapPinch) {
      const [t1, t2] = event.touches;
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const mid = getSvgPoint((t1.clientX + t2.clientX) / 2, (t1.clientY + t2.clientY) / 2);
      zoomAt(mid.x, mid.y, mapPinch.startScale * (dist / mapPinch.startDist));
    }
  }, { passive: true });

  stage.addEventListener("touchend", () => { mapDrag = null; mapPinch = null; });

  document.getElementById("btnZoomIn").addEventListener("click", () => {
    const data = currentGeo();
    zoomAt(data.viewBoxWidth / 2, data.viewBoxHeight / 2, mapView.scale * 1.4);
  });
  document.getElementById("btnZoomOut").addEventListener("click", () => {
    const data = currentGeo();
    zoomAt(data.viewBoxWidth / 2, data.viewBoxHeight / 2, mapView.scale / 1.4);
  });
  document.getElementById("btnZoomReset").addEventListener("click", resetMapView);
}

// ---------- Live Peru map: build + choropleth + side panel ----------
async function initPeruMap() {
  if (mapInitialized) return;
  const data = state.peruDepartments;
  if (!data) return;

  buildNationalLayer();
  setupMapInteractions();
  renderMapLegend();
  mapInitialized = true;
}

function bindZonePathEvents(onClick, onDblClick) {
  document.querySelectorAll("#peruMapLayer path").forEach((path) => {
    path.addEventListener("click", () => { if (!mapJustDragged) onClick(path.dataset.name); });
    path.addEventListener("dblclick", () => onDblClick(path.dataset.name));
  });
}

function buildNationalLayer() {
  const data = state.peruDepartments;
  const svg = document.getElementById("peruMapLive");
  svg.setAttribute("viewBox", `0 0 ${data.viewBoxWidth} ${data.viewBoxHeight}`);

  const layer = document.getElementById("peruMapLayer");
  layer.innerHTML = data.departments.map((dep) =>
    `<path data-name="${dep.name}" d="${dep.path}" fill-rule="evenodd" style="fill:${alertColor("sin_datos")}"><title>${dep.label}${dep.name === "PUNO" ? " — doble clic para ver provincias" : ""}</title></path>`
  ).join("") + data.departments.map((dep) =>
    `<text class="dept-label" x="${dep.centroid[0]}" y="${dep.centroid[1]}">${dep.label}</text>`
  ).join("");

  bindZonePathEvents(
    (name) => selectZone(name),
    (name) => {
      if (name === "PUNO") { enterPunoView(); return; }
      selectZone(name);
      zoomToBbox(state.deptByName[name].bbox);
    }
  );
}

function buildPunoLayer() {
  const data = state.punoProvinces;
  const svg = document.getElementById("peruMapLive");
  svg.setAttribute("viewBox", `0 0 ${data.viewBoxWidth} ${data.viewBoxHeight}`);

  const layer = document.getElementById("peruMapLayer");
  layer.innerHTML = data.provinces.map((p) =>
    `<path data-name="${p.name}" d="${p.path}" fill-rule="evenodd" style="fill:${alertColor("sin_datos")}"><title>${p.label} (${p.capital})</title></path>`
  ).join("") + data.provinces.map((p) =>
    `<text class="dept-label" x="${p.centroid[0]}" y="${p.centroid[1]}">${p.label}</text>`
  ).join("");

  bindZonePathEvents(
    (name) => selectZone(name),
    (name) => { selectZone(name); zoomToBbox(state.provinceByName[name].bbox); }
  );
}

async function enterPunoView() {
  await loadPunoProvinces();
  state.mapLevel = "puno";
  state.selectedZone = null;
  closeZoneDetail();
  buildPunoLayer();
  resetMapView();
  renderMapLegend();
  await refreshChoropleths();

  document.getElementById("mapTitle").textContent = "Puno — provincias";
  document.getElementById("mapSubtitle").textContent = "Índice de vulnerabilidad en vivo por provincia dentro de Puno, la región con mayor prevalencia de anemia del país.";
  document.getElementById("btnBackToPeru").hidden = false;
  document.getElementById("mapDrillHint").textContent = "";
  document.getElementById("crumbPeru").classList.add("text-blue-600");
  document.getElementById("mapBreadcrumb").insertAdjacentHTML("beforeend", `<span class="text-slate-300">/</span><span class="text-slate-600">Puno</span>`);
}

function exitPunoView() {
  state.mapLevel = "nacional";
  state.selectedZone = null;
  closeZoneDetail();
  buildNationalLayer();
  resetMapView();
  renderMapLegend();
  refreshChoropleths();

  document.getElementById("mapTitle").textContent = "Mapa predictivo";
  document.getElementById("mapSubtitle").textContent = "Índice de vulnerabilidad en vivo por departamento, calculado sobre los pacientes reales registrados.";
  document.getElementById("btnBackToPeru").hidden = true;
  document.getElementById("crumbPeru").classList.remove("text-blue-600");
  const crumb = document.getElementById("mapBreadcrumb");
  crumb.innerHTML = `<span id="crumbPeru" class="cursor-pointer hover:text-blue-600 transition">Perú</span>`;
  document.getElementById("crumbPeru").addEventListener("click", exitPunoView);
}

function renderMapLegend() {
  const levels = [
    { level: "sin_datos", label: "Sin datos" },
    { level: "bajo", label: "Bajo" },
    { level: "moderado", label: "Moderado" },
    { level: "alerta", label: "Alerta" },
    { level: "critico", label: "Crítico" }
  ];
  document.getElementById("mapLegend").innerHTML = levels.map((l) => `
    <span class="inline-flex items-center gap-1.5"><span class="w-3 h-3 rounded" style="background:${alertColor(l.level)}"></span>${l.label}</span>
  `).join("");
}

async function refreshChoropleths() {
  const deptResult = await api("/api/geo/patients-by-department");
  if (deptResult.ok) {
    state.deptStats = {};
    deptResult.data.forEach((row) => { state.deptStats[row.departamento] = row; });
  }

  const provResult = await api("/api/geo/puno-provincias-datos");
  if (provResult.ok) {
    state.provinceStats = {};
    provResult.data.forEach((row) => { state.provinceStats[row.provincia] = row; });
  }

  const statsMap = state.mapLevel === "puno" ? state.provinceStats : state.deptStats;
  document.querySelectorAll("#peruMapLayer path").forEach((path) => {
    const stat = statsMap[path.dataset.name];
    path.style.fill = alertColor(stat ? stat.alertLevel : "sin_datos");
  });

  const totalPatients = Object.values(state.deptStats).reduce((sum, r) => sum + r.total, 0);
  document.getElementById("map_total").textContent = totalPatients;
  document.getElementById("map_deptCount").textContent = Object.values(state.deptStats).filter((r) => r.total > 0).length;

  if (state.selectedZone) renderZoneDetail(state.selectedZone);
}

function selectZone(name) {
  state.selectedZone = name;
  document.querySelectorAll("#peruMapLayer path").forEach((path) => path.classList.toggle("selected", path.dataset.name === name));
  renderZoneDetail(name);
}

function renderZoneDetail(name) {
  const isPuno = state.mapLevel === "puno";
  const zone = isPuno ? state.provinceByName[name] : state.deptByName[name];
  const stat = isPuno ? state.provinceStats[name] : state.deptStats[name];

  document.getElementById("mapSideDefault").classList.add("hidden");
  document.getElementById("mapSideDetail").hidden = false;
  replay(document.getElementById("mapSideDetail"), "animate-pop-in");
  document.getElementById("map_deptName").textContent = zone ? zone.label : name;

  const alertBadge = document.getElementById("map_deptAlert");
  const level = stat ? stat.alertLevel : "sin_datos";
  alertBadge.textContent = alertLabel(level);
  alertBadge.className = `inline-block mt-1.5 text-[0.68rem] font-bold px-2.5 py-0.5 rounded-full ${alertBadgeClasses(level)}`;

  const refBox = document.getElementById("map_deptReference");
  if (isPuno && zone && zone.population2017) {
    refBox.classList.remove("hidden");
    document.getElementById("map_deptPopulation").textContent = `${zone.population2017.toLocaleString("es-PE")} hab. (INEI 2017)`;
    document.getElementById("map_deptCapital").textContent = zone.capital;
  } else {
    refBox.classList.add("hidden");
  }

  const total = stat ? stat.total : 0;
  document.getElementById("map_deptTotal").textContent = total;
  document.getElementById("map_deptHb").textContent = stat && stat.hbPromedio != null ? stat.hbPromedio : "-";
  document.getElementById("map_deptIndex").textContent = stat && stat.vulnerabilityIndex != null ? `${stat.vulnerabilityIndex}/100` : "-";

  const emptyBox = document.getElementById("map_deptEmpty");
  const riskBox = document.getElementById("map_deptRisk");

  if (!stat || total === 0) {
    emptyBox.hidden = false;
    riskBox.innerHTML = "";
  } else {
    emptyBox.hidden = true;
    riskBox.innerHTML =
      riskRow("Alto", stat.alto || 0, total, "#ef4444") +
      riskRow("Medio", stat.medio || 0, total, "#f59e0b") +
      riskRow("Bajo", stat.bajo || 0, total, "#22c55e");
  }

  const drillPrompt = document.getElementById("map_drillPrompt");
  drillPrompt.hidden = !(!isPuno && name === "PUNO");

  const ayudaBox = document.getElementById("map_ayudaBox");
  const showAyuda = state.user.role === "admin" && (level === "critico" || level === "alerta");
  ayudaBox.hidden = !showAyuda;
  document.getElementById("ayudaForm").hidden = true;
  document.getElementById("btnMapAyudaToggle").classList.remove("hidden");

  renderAyudaHistory();
}

function closeZoneDetail() {
  state.selectedZone = null;
  document.querySelectorAll("#peruMapLayer path").forEach((path) => path.classList.remove("selected"));
  document.getElementById("mapSideDefault").classList.remove("hidden");
  document.getElementById("mapSideDetail").hidden = true;
}

// ---------- Ayudas (admin dispatch to critical zones) ----------
async function loadAyudas() {
  const result = await api("/api/ayudas");
  if (result.ok) state.ayudas = result.data;
}

function renderAyudaHistory() {
  const box = document.getElementById("map_ayudaHistory");
  const isPuno = state.mapLevel === "puno";
  const items = state.ayudas.filter((a) => isPuno ? a.provincia === state.selectedZone : (a.departamento === state.selectedZone && !a.provincia));
  if (!items.length) { box.innerHTML = ""; return; }

  box.innerHTML = `
    <p class="text-xs font-semibold text-slate-500 mb-2">Ayudas enviadas a esta zona</p>
    <div class="space-y-2 max-h-40 overflow-y-auto pr-1">
      ${items.map((a) => `
        <div class="text-xs bg-slate-50 rounded-lg px-3 py-2">
          <div class="flex items-center justify-between gap-2">
            <strong class="text-slate-700">${a.tipo}</strong>
            <span class="text-slate-400">${new Date(a.createdAt).toLocaleDateString("es-PE")}</span>
          </div>
          ${a.nota ? `<p class="text-slate-500 mt-0.5">${a.nota}</p>` : ""}
          <p class="text-slate-400 mt-0.5">por ${a.enviadoPor}</p>
        </div>
      `).join("")}
    </div>
  `;
}

async function submitAyuda(event) {
  event.preventDefault();
  if (!state.selectedZone) return;

  const isPuno = state.mapLevel === "puno";
  const tipo = document.getElementById("ayuda_tipo").value;
  const nota = document.getElementById("ayuda_nota").value.trim();

  const payload = isPuno
    ? { departamento: "PUNO", provincia: state.selectedZone, tipo, nota }
    : { departamento: state.selectedZone, tipo, nota };

  const result = await api("/api/ayudas", { method: "POST", body: JSON.stringify(payload) });

  if (!result.ok) {
    toast(result.error || "No se pudo enviar la ayuda", "error");
    return;
  }

  const label = isPuno ? provLabel(state.selectedZone) : deptLabel(state.selectedZone);
  toast(`Ayuda despachada a ${label}`, "success");
  document.getElementById("ayuda_nota").value = "";
  document.getElementById("ayudaForm").hidden = true;
  await loadAyudas();
  renderAyudaHistory();
  await refreshStats();
}

// ---------- Historical analytics (TB_DIGTEL_ANEMIA_ATENDIDOS) ----------
function sequentialBlue(t) {
  const steps = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95"];
  const idx = Math.min(steps.length - 1, Math.floor(t * steps.length));
  return { color: steps[idx], dark: idx >= 3 };
}

function formatDate(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd || "-";
  return `${yyyymmdd.slice(6, 8)}/${yyyymmdd.slice(4, 6)}/${yyyymmdd.slice(0, 4)}`;
}

function rankRow(label, count, pct, max) {
  return `
    <div class="flex items-center gap-3 text-sm">
      <span class="w-28 truncate text-slate-600">${label}</span>
      <div class="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden"><div class="h-full rounded-full bg-blue-500" style="width:${(count / max) * 100}%"></div></div>
      <span class="w-24 text-right text-slate-500 tabular-nums text-xs">${count} (${pct}%)</span>
    </div>
  `;
}

function renderRankList(container, items, idPrefix) {
  const max = items.length ? items[0].count : 1;
  container.innerHTML = items.map((item) => rankRow(`${idPrefix} #${item.id}`, item.count, item.pct, max)).join("");
}

function renderDistribution(container, items) {
  const max = items.length ? Math.max(...items.map((i) => i.count)) : 1;
  container.innerHTML = items.map((item) => rankRow(item.label, item.count, item.pct, max)).join("");
}

function renderTrend(data) {
  const container = document.getElementById("an_trend");
  const max = Math.max(...data.yearTrend.map((y) => y.count), 1);
  container.innerHTML = data.yearTrend.map((y) => `
    <div class="flex flex-col items-center justify-end h-full flex-1">
      <span class="text-xs text-slate-500 mb-1.5 tabular-nums">${y.count.toLocaleString("es-PE")}</span>
      <div class="w-full max-w-[56px] rounded-t-lg bg-gradient-to-t from-blue-700 to-blue-500 transition-all duration-700" style="height:${(y.count / max) * 100}%"></div>
      <span class="text-xs text-slate-400 mt-2">${y.year}</span>
    </div>
  `).join("");

  const coveredYears = data.yearTrend.map((y) => y.year);
  const allYears = [];
  for (let y = Number(data.dateRange.from.slice(0, 4)); y <= Number(data.dateRange.to.slice(0, 4)); y++) allYears.push(String(y));
  const missing = allYears.filter((y) => !coveredYears.includes(y));
  document.getElementById("an_trend_gap").textContent = missing.length ? `Sin atenciones registradas en la base para: ${missing.join(", ")}.` : "";
}

function renderHeatmap(data) {
  const { years, etapas, matrix } = data.heatmap;
  const max = Math.max(...matrix.flat(), 1);
  let html = `<thead><tr><th class="text-xs text-slate-500 font-medium text-left px-1.5">Año</th>${etapas.map((e) => `<th class="text-xs text-slate-500 font-medium px-1.5">${e.label}</th>`).join("")}</tr></thead><tbody>`;
  years.forEach((year, r) => {
    html += `<tr><td class="text-sm font-bold px-1.5">${year}</td>`;
    etapas.forEach((e, c) => {
      const count = matrix[r][c];
      const { color, dark } = sequentialBlue(count / max);
      html += `<td class="text-center rounded-lg px-2 py-2.5 text-xs font-bold tabular-nums" title="${year} · ${e.label}: ${count} casos" style="background:${color};color:${dark ? "#fff" : "#0b1120"}">${count}</td>`;
    });
    html += "</tr>";
  });
  document.getElementById("an_heatmap").innerHTML = html + "</tbody>";
}

function renderDiagnostico(items) {
  document.getElementById("an_diagnostico").innerHTML = items.map((item) => `
    <tr class="border-t border-slate-100">
      <td class="px-3.5 py-2.5 font-mono text-xs font-bold text-blue-700">${item.code}</td>
      <td class="px-3.5 py-2.5">${item.label}<div class="w-full h-1 rounded-full bg-slate-100 overflow-hidden mt-1 max-w-[220px]"><div class="h-full rounded-full bg-blue-500" style="width:${item.pct}%"></div></div></td>
      <td class="px-3.5 py-2.5 tabular-nums">${item.count.toLocaleString("es-PE")}</td>
      <td class="px-3.5 py-2.5 tabular-nums">${item.pct}%</td>
    </tr>
  `).join("");
}

async function refreshAnalytics() {
  const result = await api("/api/analytics/anemia");
  if (!result.ok) return;
  const data = result.data;

  document.getElementById("an_total").textContent = data.total.toLocaleString("es-PE");
  document.getElementById("an_s_total").textContent = data.total.toLocaleString("es-PE");
  document.getElementById("an_s_periodo").textContent = `${formatDate(data.dateRange.from)} - ${formatDate(data.dateRange.to)}`;
  document.getElementById("an_s_zonas").textContent = data.uniqueZonas.toLocaleString("es-PE");
  document.getElementById("an_s_eess").textContent = data.uniqueEstablecimientos.toLocaleString("es-PE");

  renderTrend(data);
  renderHeatmap(data);
  renderDistribution(document.getElementById("an_sexo"), data.sexo);
  renderDistribution(document.getElementById("an_etapa"), data.etapa);
  renderDiagnostico(data.diagnostico);
  renderRankList(document.getElementById("an_zonas"), data.topZonas.slice(0, 15), "Zona");
  renderRankList(document.getElementById("an_eess"), data.topEstablecimientos.slice(0, 15), "EESS");
}

// ---------- Init ----------
function initialize() {
  document.getElementById("loginForm").addEventListener("submit", handleLogin);
  document.getElementById("btnLogout").addEventListener("click", handleLogout);

  document.querySelectorAll(".nav-btn").forEach((btn) => btn.addEventListener("click", () => switchView(btn.dataset.view)));

  document.getElementById("btnRegistrar").addEventListener("click", registerPatient);
  document.getElementById("btnDemo").addEventListener("click", seedDemo);
  document.getElementById("f_departamento").addEventListener("change", handleDepartamentoChange);
  document.getElementById("patientSearch").addEventListener("input", renderPatients);

  document.getElementById("btnMapClose").addEventListener("click", closeZoneDetail);
  document.getElementById("btnMapRegisterHere").addEventListener("click", () => {
    if (state.selectedZone) {
      const dept = state.mapLevel === "puno" ? "PUNO" : state.selectedZone;
      document.getElementById("f_departamento").value = dept;
      handleDepartamentoChange();
      if (state.mapLevel === "puno") document.getElementById("f_provincia").value = state.selectedZone;
    }
    switchView("register");
  });
  document.getElementById("btnMapAyudaToggle").addEventListener("click", () => {
    const form = document.getElementById("ayudaForm");
    form.hidden = !form.hidden;
  });
  document.getElementById("ayudaForm").addEventListener("submit", submitAyuda);
  document.getElementById("map_drillPrompt").addEventListener("click", enterPunoView);
  document.getElementById("btnBackToPeru").addEventListener("click", exitPunoView);
  document.getElementById("crumbPeru").addEventListener("click", exitPunoView);

  checkSession();
}

initialize();

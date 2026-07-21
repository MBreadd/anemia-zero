const fs = require("fs");
const path = require("path");
const readline = require("readline");

const SOURCE_CSV = path.join(__dirname, "..", "TB_DIGTEL_ANEMIA_ATENDIDOS.csv");
const OUTPUT_JSON = path.join(__dirname, "..", "src", "data", "anemia_analytics.json");

const DIAGNOSIS_LABELS = {
  D509: "Anemia por deficiencia de hierro, no especificada",
  D649: "Anemia, no especificada",
  D539: "Anemia nutricional, no especificada",
  D500: "Anemia por deficiencia de hierro secundaria a pérdida de sangre crónica",
  D508: "Otras anemias por deficiencia de hierro",
  D519: "Anemia por deficiencia de vitamina B12, no especificada",
  D638: "Anemia en otras enfermedades crónicas clasificadas en otra parte",
  D648: "Otras anemias especificadas",
  D591: "Otras anemias hemolíticas autoinmunes",
  D619: "Anemia aplásica, no especificada",
  D510: "Anemia por deficiencia de vitamina B12 por deficiencia dietética",
  D590: "Otras anemias hemolíticas adquiridas",
  "D62X": "Anemia posthemorrágica aguda",
  D610: "Anemia aplásica constitucional",
  D529: "Anemia por deficiencia de folato, no especificada"
};

const TIPO_DX_LABELS = {
  D: "Definitivo",
  R: "Repetido / control",
  P: "Presuntivo"
};

const ETAPA_ORDER = ["00a-11a", "12a-17a", "18a-29a", "30a-59a", "60a+"];
const ETAPA_LABELS = {
  "00a-11a": "0 a 11 años",
  "12a-17a": "12 a 17 años",
  "18a-29a": "18 a 29 años",
  "30a-59a": "30 a 59 años",
  "60a+": "60 años a más"
};

function sortDescByValue(obj) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]);
}

async function build() {
  const rl = readline.createInterface({ input: fs.createReadStream(SOURCE_CSV) });

  let header = null;
  let total = 0;
  const byUbigeo = {};
  const byEess = {};
  const byYear = {};
  const byEtapa = {};
  const bySexo = {};
  const byDiagnostico = {};
  const byTipoDx = {};
  const yearEtapaMatrix = {};
  let minDate = null;
  let maxDate = null;

  for await (const line of rl) {
    if (!header) {
      header = line.replace(/^﻿/, "").split(",");
      continue;
    }
    const cols = line.split(",");
    if (cols.length < 10) continue;

    const [idUbigeo, , , , sexo, fecha, etapa, diagnosticoRaw, tipoDxRaw, idEess] = cols;
    const diagnostico = String(diagnosticoRaw || "").toUpperCase();
    const tipoDx = String(tipoDxRaw || "").toUpperCase();
    const year = fecha ? fecha.slice(0, 4) : "desconocido";

    total++;
    byUbigeo[idUbigeo] = (byUbigeo[idUbigeo] || 0) + 1;
    byEess[idEess] = (byEess[idEess] || 0) + 1;
    byYear[year] = (byYear[year] || 0) + 1;
    byEtapa[etapa] = (byEtapa[etapa] || 0) + 1;
    bySexo[sexo] = (bySexo[sexo] || 0) + 1;
    byDiagnostico[diagnostico] = (byDiagnostico[diagnostico] || 0) + 1;
    byTipoDx[tipoDx] = (byTipoDx[tipoDx] || 0) + 1;

    if (!yearEtapaMatrix[year]) yearEtapaMatrix[year] = {};
    yearEtapaMatrix[year][etapa] = (yearEtapaMatrix[year][etapa] || 0) + 1;

    if (!minDate || fecha < minDate) minDate = fecha;
    if (!maxDate || fecha > maxDate) maxDate = fecha;
  }

  const topDiagnosticoEntries = sortDescByValue(byDiagnostico);
  const knownDiagnostico = topDiagnosticoEntries.filter(([code]) => DIAGNOSIS_LABELS[code]);
  const otherDiagnosticoCount = topDiagnosticoEntries
    .filter(([code]) => !DIAGNOSIS_LABELS[code])
    .reduce((sum, [, count]) => sum + count, 0);

  const diagnostico = knownDiagnostico.map(([code, count]) => ({
    code,
    label: DIAGNOSIS_LABELS[code],
    count,
    pct: Number(((count / total) * 100).toFixed(1))
  }));
  if (otherDiagnosticoCount > 0) {
    diagnostico.push({
      code: "OTROS",
      label: "Otros diagnósticos de anemia (baja frecuencia)",
      count: otherDiagnosticoCount,
      pct: Number(((otherDiagnosticoCount / total) * 100).toFixed(1))
    });
  }

  const years = Object.keys(byYear).filter((y) => /^\d{4}$/.test(y)).sort();

  const heatmap = {
    years,
    etapas: ETAPA_ORDER.map((key) => ({ key, label: ETAPA_LABELS[key] || key })),
    matrix: years.map((year) =>
      ETAPA_ORDER.map((etapa) => (yearEtapaMatrix[year] && yearEtapaMatrix[year][etapa]) || 0)
    )
  };

  const topZonas = sortDescByValue(byUbigeo)
    .slice(0, 20)
    .map(([id, count]) => ({ id, count, pct: Number(((count / total) * 100).toFixed(1)) }));

  const topEstablecimientos = sortDescByValue(byEess)
    .slice(0, 20)
    .map(([id, count]) => ({ id, count, pct: Number(((count / total) * 100).toFixed(1)) }));

  const tipoDx = sortDescByValue(byTipoDx).map(([code, count]) => ({
    code,
    label: TIPO_DX_LABELS[code] || code,
    count,
    pct: Number(((count / total) * 100).toFixed(1))
  }));

  const sexo = sortDescByValue(bySexo).map(([code, count]) => ({
    code,
    label: code === "F" ? "Femenino" : code === "M" ? "Masculino" : code,
    count,
    pct: Number(((count / total) * 100).toFixed(1))
  }));

  const etapa = ETAPA_ORDER.map((key) => ({
    key,
    label: ETAPA_LABELS[key] || key,
    count: byEtapa[key] || 0,
    pct: Number((((byEtapa[key] || 0) / total) * 100).toFixed(1))
  }));

  const yearTrend = years.map((year) => ({ year, count: byYear[year] }));

  const output = {
    generatedAt: new Date().toISOString(),
    source: "TB_DIGTEL_ANEMIA_ATENDIDOS.csv",
    total,
    dateRange: { from: minDate, to: maxDate },
    uniqueZonas: Object.keys(byUbigeo).length,
    uniqueEstablecimientos: Object.keys(byEess).length,
    diagnostico,
    tipoDx,
    sexo,
    etapa,
    yearTrend,
    heatmap,
    topZonas,
    topEstablecimientos,
    note: "id_ubigeo e id_eess son códigos internos del dataset original: no incluyen nombres de distrito ni coordenadas, por lo que se muestran como códigos hasta contar con una tabla de referencia real."
  };

  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(output, null, 2));
  console.log(`OK: ${total} filas procesadas -> ${OUTPUT_JSON}`);
}

build().catch((error) => {
  console.error("Fallo generando analytics:", error);
  process.exit(1);
});

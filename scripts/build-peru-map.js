const fs = require("fs");
const path = require("path");

const SOURCE = path.join(__dirname, "peru_departamental_simple.geojson");
const OUTPUT = path.join(__dirname, "..", "src", "data", "peru_departments.json");

const WIDTH = 640;
const ROUND = 2; // decimal places in the output SVG units
const DECIMATE_EVERY = 2; // keep 1 of every N points per ring (first/last always kept)

const DISPLAY_LABELS = {
  AMAZONAS: "Amazonas",
  ANCASH: "Áncash",
  APURIMAC: "Apurímac",
  AREQUIPA: "Arequipa",
  AYACUCHO: "Ayacucho",
  CAJAMARCA: "Cajamarca",
  CALLAO: "Callao",
  CUSCO: "Cusco",
  HUANCAVELICA: "Huancavelica",
  HUANUCO: "Huánuco",
  ICA: "Ica",
  JUNIN: "Junín",
  "LA LIBERTAD": "La Libertad",
  LAMBAYEQUE: "Lambayeque",
  LIMA: "Lima",
  LORETO: "Loreto",
  "MADRE DE DIOS": "Madre de Dios",
  MOQUEGUA: "Moquegua",
  PASCO: "Pasco",
  PIURA: "Piura",
  PUNO: "Puno",
  "SAN MARTIN": "San Martín",
  TACNA: "Tacna",
  TUMBES: "Tumbes",
  UCAYALI: "Ucayali"
};

function decimateRing(ring) {
  if (ring.length <= 40) return ring;
  const kept = ring.filter((_, i) => i % DECIMATE_EVERY === 0 || i === ring.length - 1);
  return kept;
}

function main() {
  const geojson = JSON.parse(fs.readFileSync(SOURCE, "utf8"));

  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const feature of geojson.features) {
    const polys = feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;
    for (const poly of polys) {
      for (const ring of poly) {
        for (const [lon, lat] of ring) {
          if (lon < minLon) minLon = lon;
          if (lon > maxLon) maxLon = lon;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }
      }
    }
  }

  const meanLat = (minLat + maxLat) / 2;
  const cosScale = Math.cos((meanLat * Math.PI) / 180);
  const lonSpan = maxLon - minLon;
  const latSpan = maxLat - minLat;
  const scaleFactor = WIDTH / (lonSpan * cosScale);
  const height = latSpan * scaleFactor;

  function project([lon, lat]) {
    const x = (lon - minLon) * cosScale * scaleFactor;
    const y = (maxLat - lat) * scaleFactor;
    return [Number(x.toFixed(ROUND)), Number(y.toFixed(ROUND))];
  }

  const departments = geojson.features.map((feature) => {
    const polys = feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;

    let d = "";
    let cxSum = 0, cySum = 0, cCount = 0;
    let bxMin = Infinity, byMin = Infinity, bxMax = -Infinity, byMax = -Infinity;

    for (const poly of polys) {
      for (const ring of poly) {
        const decimated = decimateRing(ring);
        const projected = decimated.map(project);
        d += `M${projected.map((p) => p.join(",")).join("L")}Z`;
        projected.forEach(([x, y]) => {
          cxSum += x; cySum += y; cCount++;
          if (x < bxMin) bxMin = x;
          if (x > bxMax) bxMax = x;
          if (y < byMin) byMin = y;
          if (y > byMax) byMax = y;
        });
      }
    }

    const name = feature.properties.NOMBDEP;
    return {
      name,
      label: DISPLAY_LABELS[name] || name,
      path: d,
      centroid: [Number((cxSum / cCount).toFixed(ROUND)), Number((cySum / cCount).toFixed(ROUND))],
      bbox: [bxMin, byMin, bxMax, byMax].map((n) => Number(n.toFixed(ROUND)))
    };
  });

  const output = {
    viewBoxWidth: Number(WIDTH.toFixed(ROUND)),
    viewBoxHeight: Number(height.toFixed(ROUND)),
    source: "juaneladio/peru-geojson (peru_departamental_simple.geojson)",
    departments
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(output));
  console.log(`OK: ${departments.length} departamentos -> ${OUTPUT}`);
  console.log(`viewBox: 0 0 ${output.viewBoxWidth} ${output.viewBoxHeight}`);
  console.log(`tamaño: ${(fs.statSync(OUTPUT).size / 1024).toFixed(1)} KB`);
}

main();

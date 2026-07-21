const fs = require("fs");
const path = require("path");

const SOURCE = path.join(__dirname, "peru_provincial_simple.geojson");
const OUTPUT = path.join(__dirname, "..", "src", "data", "puno_provinces.json");

const WIDTH = 640;
const ROUND = 2;

// Población real, Censo Nacional 2017 (INEI) — última fuente con desagregación provincial completa.
const POPULATION_2017 = {
  "SAN ROMAN": 307417,
  PUNO: 219494,
  AZANGARO: 110392,
  CHUCUITO: 89002,
  CARABAYA: 73322,
  MELGAR: 67138,
  "EL COLLAO": 63878,
  HUANCANE: 57651,
  SANDIA: 50742,
  LAMPA: 40856,
  YUNGUYO: 36939,
  "SAN ANTONIO DE PUTINA": 36113,
  MOHO: 19753
};

const CAPITALS = {
  "SAN ROMAN": "Juliaca",
  PUNO: "Puno",
  AZANGARO: "Azángaro",
  CHUCUITO: "Juli",
  CARABAYA: "Macusani",
  MELGAR: "Ayaviri",
  "EL COLLAO": "Ilave",
  HUANCANE: "Huancané",
  SANDIA: "Sandia",
  LAMPA: "Lampa",
  YUNGUYO: "Yunguyo",
  "SAN ANTONIO DE PUTINA": "Putina",
  MOHO: "Moho"
};

const DISPLAY_LABELS = {
  "SAN ROMAN": "San Román",
  PUNO: "Puno",
  AZANGARO: "Azángaro",
  CHUCUITO: "Chucuito",
  CARABAYA: "Carabaya",
  MELGAR: "Melgar",
  "EL COLLAO": "El Collao",
  HUANCANE: "Huancané",
  SANDIA: "Sandia",
  LAMPA: "Lampa",
  YUNGUYO: "Yunguyo",
  "SAN ANTONIO DE PUTINA": "San Antonio de Putina",
  MOHO: "Moho"
};

function main() {
  const geojson = JSON.parse(fs.readFileSync(SOURCE, "utf8"));
  const features = geojson.features.filter((f) => f.properties.FIRST_NOMB === "PUNO");

  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const feature of features) {
    const polys = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
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

  const provinces = features.map((feature) => {
    const polys = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    let d = "";
    let cxSum = 0, cySum = 0, cCount = 0;
    let bxMin = Infinity, byMin = Infinity, bxMax = -Infinity, byMax = -Infinity;

    for (const poly of polys) {
      for (const ring of poly) {
        const projected = ring.map(project);
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

    const name = feature.properties.NOMBPROV;
    return {
      name,
      label: DISPLAY_LABELS[name] || name,
      capital: CAPITALS[name] || "",
      population2017: POPULATION_2017[name] || null,
      path: d,
      centroid: [Number((cxSum / cCount).toFixed(ROUND)), Number((cySum / cCount).toFixed(ROUND))],
      bbox: [bxMin, byMin, bxMax, byMax].map((n) => Number(n.toFixed(ROUND)))
    };
  });

  const output = {
    viewBoxWidth: Number(WIDTH.toFixed(ROUND)),
    viewBoxHeight: Number(height.toFixed(ROUND)),
    source: "juaneladio/peru-geojson (peru_provincial_simple.geojson); población INEI Censo 2017",
    provinces
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(output));
  console.log(`OK: ${provinces.length} provincias de Puno -> ${OUTPUT}`);
  console.log(`viewBox: 0 0 ${output.viewBoxWidth} ${output.viewBoxHeight}`);
}

main();

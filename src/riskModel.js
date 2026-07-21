function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function calculateRiskScore(input) {
  const omitidas = Number(input.omitidas || 0);
  const distanciaKm = Number(input.km || 0);
  const hemoglobina = Number(input.hb || 0);
  const edadMeses = Number(input.edad || 0);
  const idioma = String(input.idioma || "").trim().toLowerCase();

  let score = 0;
  score += clamp(omitidas, 0, 12) * 5;
  score += clamp(distanciaKm, 0, 20) * 1.8;

  if (hemoglobina < 11) {
    score += (11 - hemoglobina) * 9;
  }

  if (edadMeses < 12) {
    score += 6;
  }

  if (idioma && idioma !== "español" && idioma !== "espanol") {
    score += 8;
  }

  const normalizedScore = Math.round(clamp(score, 0, 100));

  let level = "bajo";
  if (normalizedScore >= 60) {
    level = "alto";
  } else if (normalizedScore >= 35) {
    level = "medio";
  }

  const recommendations = {
    alto: [
      "Llamada prioritaria en menos de 24 horas",
      "Visita domiciliaria coordinada por promotor de salud",
      "Mensajeria diaria en idioma del hogar"
    ],
    medio: [
      "Recordatorio cada 48 horas por el promotor de salud",
      "Resolver dudas sobre efectos secundarios",
      "Reforzar receta local con hierro"
    ],
    bajo: [
      "Seguimiento semanal automatizado",
      "Confirmar proximo control de hemoglobina",
      "Mantener mensajes de refuerzo positivo"
    ]
  };

  return {
    score: normalizedScore,
    level,
    recommendations: recommendations[level]
  };
}

module.exports = {
  calculateRiskScore
};

// Índice predictivo de vulnerabilidad por departamento.
// No es un modelo de machine learning entrenado: es un puntaje compuesto y explicable
// (mismo enfoque que riskModel.js) calculado sobre los pacientes reales registrados en
// la plataforma. Con más historial (ver nota al final del chat) puede evolucionar a un
// modelo de series de tiempo real.

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function computeVulnerability({ total, alto, avgRiskScore }) {
  if (!total) {
    return { vulnerabilityIndex: null, alertLevel: "sin_datos" };
  }

  const highRiskShare = alto / total;
  const rawIndex = avgRiskScore * 0.6 + highRiskShare * 100 * 0.4;
  const vulnerabilityIndex = Math.round(clamp(rawIndex, 0, 100));

  let alertLevel = "bajo";
  if (vulnerabilityIndex >= 70) alertLevel = "critico";
  else if (vulnerabilityIndex >= 50) alertLevel = "alerta";
  else if (vulnerabilityIndex >= 30) alertLevel = "moderado";

  return { vulnerabilityIndex, alertLevel };
}

module.exports = { computeVulnerability };

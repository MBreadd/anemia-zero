const { telegram } = require("../config");

function buildTemplates() {
  return {
    alto: (nombre) =>
      `Hola familia de ${nombre}. Hoy toca una dosis de hierro. Si hay malestar, no suspendan el tratamiento: escriban su duda y un promotor les ayudara. Tip local: mezclar con sangrecita o canihua mejora la aceptacion.`,
    medio: (nombre) =>
      `Buen dia. Recordatorio para ${nombre}: administrar chispitas hoy con comida rica en vitamina C. Evitar mate o leche al mismo tiempo. Responde "OK" cuando se complete.`,
    bajo: (nombre) =>
      `Excelente avance con ${nombre}. Mantengan la rutina diaria y acudan al siguiente control en la posta. Su constancia protege su desarrollo cognitivo.`
  };
}

async function getMe(token) {
  const selectedToken = token || telegram.token;
  if (!selectedToken) {
    return {
      ok: false,
      simulated: true,
      description: "No se configuro TELEGRAM_BOT_TOKEN"
    };
  }

  const response = await fetch(`https://api.telegram.org/bot${selectedToken}/getMe`);
  return response.json();
}

async function setWebhook({ token, webhookBaseUrl }) {
  const selectedToken = token || telegram.token;
  if (!selectedToken) {
    return {
      ok: false,
      simulated: true,
      description: "No se configuro TELEGRAM_BOT_TOKEN"
    };
  }

  const webhookUrl = `${webhookBaseUrl}/api/telegram/webhook?secret=${encodeURIComponent(telegram.webhookSecret)}`;

  const response = await fetch(`https://api.telegram.org/bot${selectedToken}/setWebhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url: webhookUrl
    })
  });

  const data = await response.json();
  return {
    ...data,
    configuredWebhook: webhookUrl
  };
}

async function sendMessage({ token, chatId, text }) {
  const selectedToken = token || telegram.token;

  if (!selectedToken) {
    if (telegram.allowSimulation) {
      return {
        ok: true,
        simulated: true,
        result: {
          message_id: `sim-${Date.now()}`,
          chat: { id: chatId }
        }
      };
    }

    return {
      ok: false,
      simulated: true,
      description: "No se configuro TELEGRAM_BOT_TOKEN"
    };
  }

  const response = await fetch(`https://api.telegram.org/bot${selectedToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: chatId,
      text
    })
  });

  return response.json();
}

module.exports = {
  templates: buildTemplates(),
  getMe,
  setWebhook,
  sendMessage
};

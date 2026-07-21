# HemoPuno MVP

MVP funcional para hackaton: seguimiento predictivo y automatizado de anemia infantil en zonas rurales de Puno.

## Que incluye

- Landing + panel operativo en una sola interfaz web.
- Registro clinico de ninos con almacenamiento en PostgreSQL.
- Motor de riesgo de abandono (score bajo/medio/alto).
- Priorizacion de pacientes para intervencion.
- Integracion con Telegram (BotFather) para seguimiento automatizado.
- Webhook para recibir respuestas simples de cuidadores.
- Contenedores Docker para despliegue rapido.

## Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js + Express
- Base de datos: PostgreSQL
- Mensajeria: Telegram Bot API

## 1) Ejecutar local (sin Docker)

1. Instala Node.js 20+ y PostgreSQL.
2. Duplica `.env.example` como `.env` y completa variables.
3. Instala dependencias:

```bash
npm install
```

4. Inicia el servidor:

```bash
npm start
```

5. Abre `http://localhost:3000`.

## 2) Ejecutar con Docker (recomendado para hackaton)

1. Opcional: crea un archivo `.env` con tu token de Telegram:

```env
TELEGRAM_BOT_TOKEN=123456:AA...
TELEGRAM_WEBHOOK_SECRET=un-secreto-largo
```

2. Levanta todo:

```bash
docker compose up --build
```

3. Abre `http://localhost:3000`.

## 3) Conectar Telegram con BotFather

1. En Telegram, crea bot con @BotFather y copia el token.
2. Pega el token en el campo "Token del bot" de la web.
3. Pulsa "Probar getMe" para validar conexion.
4. Para webhook real, usa una URL publica (ngrok o dominio propio) en "Base URL publica" y pulsa "Configurar webhook".
5. El endpoint configurado sera:

```text
https://tu-url-publica/api/telegram/webhook?secret=TU_SECRETO
```

## 4) Flujo MVP demo

1. Cargar demo o registrar paciente nuevo.
2. Ver score de riesgo y panel priorizado.
3. Enviar seguimiento por Telegram desde la tabla.
4. Revisar estadisticas en tiempo real.

## Endpoints principales

- `GET /api/health`
- `GET /api/patients`
- `POST /api/patients`
- `POST /api/predict`
- `GET /api/stats`
- `POST /api/messages/send`
- `POST /api/telegram/get-me`
- `POST /api/telegram/set-webhook`
- `POST /api/telegram/webhook`

## Modelo de negocio y sostenibilidad

- Inicio B2G: MINSA, DIRESA, gobiernos locales.
- Financiamiento inicial via grants (BID Lab, UNICEF, ProInnovate).
- Escalabilidad SaaS / marca blanca para clinicas y ONGs.

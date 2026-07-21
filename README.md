# anemia_zero

Plataforma de seguimiento predictivo y automatizado de anemia infantil en zonas rurales de Puno.

## Que incluye

- Dashboard por roles (Administración y Promotor de salud) con inicio de sesión.
- Registro clinico de ninos con almacenamiento en PostgreSQL.
- Motor de riesgo de abandono (score bajo/medio/alto).
- Priorizacion de pacientes para intervencion.
- Integracion con Telegram (BotFather) para seguimiento automatizado.
- Webhook para recibir respuestas simples de cuidadores.
- Contenedores Docker para despliegue rapido.

## Stack

- Frontend: HTML, CSS, JavaScript (sin build, servido por Express)
- Backend: Node.js + Express, sesiones por cookie httpOnly
- Base de datos: PostgreSQL (con modo memoria automatico si no hay DB disponible)
- Mensajeria: Telegram Bot API

## Roles y acceso

El dashboard tiene dos roles con vistas distintas en el sidebar:

| Rol | Usuario demo | Contraseña demo | Acceso |
|---|---|---|---|
| Administración | `admin` | `anemia2026` | Todo: resumen, pacientes, registro, configuración de Telegram (token/webhook) |
| Promotor de salud | `promotor` | `anemia2026` | Resumen, pacientes, registro. No ve la configuración de Telegram |

Estas cuentas se crean automáticamente al iniciar el servidor por primera vez (ver `DEFAULT_USERS` en `src/db.js`). **Cambia estas contraseñas antes de usar la app fuera de la demo.**

## 1) Ejecutar local (sin Docker)

1. Instala Node.js 20+ y PostgreSQL (opcional: sin PostgreSQL la app arranca igual en modo memoria).
2. Duplica `.env.example` como `.env` y completa variables (token de Telegram incluido).
3. Instala dependencias:

```bash
npm install
```

4. Inicia el servidor:

```bash
npm start
```

5. Abre `http://localhost:3000` e inicia sesión con una de las cuentas demo.

## 2) Ejecutar con Docker (recomendado para hackaton)

1. Crea un archivo `.env` con tu token de Telegram (ver `.env.example`).
2. Levanta todo:

```bash
docker compose up --build
```

3. Abre `http://localhost:3000`.

## 3) Conectar Telegram con BotFather

1. En Telegram, habla con **@BotFather**, crea un bot (`/newbot`) y copia el token que te entrega.
2. Pega ese token en `TELEGRAM_BOT_TOKEN` dentro de `.env` (o pégalo en el campo "Token del bot" de la vista *Configuración Telegram*, solo visible para el rol Administración).
3. Inicia sesión como `admin` y entra a **Configuración Telegram** → pulsa **"Probar getMe"** para validar la conexión.
4. Para que el bot te responda automáticamente cuando el cuidador escribe "OK", necesitas un webhook con URL pública:
   - En local, expón el puerto 3000 con [ngrok](https://ngrok.com/) (`ngrok http 3000`) u otro túnel.
   - Pon esa URL pública en "Base URL pública para webhook" y pulsa **"Configurar webhook"**.
   - El endpoint que Telegram llamará será:

```text
https://tu-url-publica/api/telegram/webhook?secret=TU_SECRETO
```

5. Antes de poder enviarle mensajes a un cuidador real, esa persona debe escribirle primero al bot (buscarlo por su `@username` y pulsar "Iniciar"/`/start`). Sin ese primer contacto, Telegram no entrega mensajes al chat. El `chat_id` de esa conversación se obtiene llamando a `https://api.telegram.org/bot<token>/getUpdates` después de que el cuidador escriba, y se pega en el campo "Chat ID de Telegram del cuidador" al registrar al paciente.
6. Si no configuras ningún token, el sistema sigue funcionando en **modo simulación** (`TELEGRAM_ALLOW_SIMULATION=true`): los mensajes se marcan como enviados pero no salen de verdad, útil para demo sin bot real.

## 4) Flujo MVP demo

1. Inicia sesión (admin o promotor).
2. Cargar demo o registrar paciente nuevo.
3. Ver score de riesgo y panel priorizado en Resumen.
4. Enviar seguimiento por Telegram desde la tabla de Pacientes.
5. Revisar estadisticas en tiempo real.

## Endpoints principales

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/health`
- `GET /api/patients`
- `POST /api/patients`
- `POST /api/predict`
- `GET /api/stats`
- `POST /api/messages/send`
- `POST /api/telegram/get-me` (solo admin)
- `POST /api/telegram/set-webhook` (solo admin)
- `POST /api/telegram/webhook`

## Modelo de negocio y sostenibilidad

- Inicio B2G: MINSA, DIRESA, gobiernos locales.
- Financiamiento inicial via grants (BID Lab, UNICEF, ProInnovate).
- Escalabilidad SaaS / marca blanca para clinicas y ONGs.

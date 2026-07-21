# anemia_zero

Plataforma predictiva de seguimiento de anemia infantil en el Perú: identifica qué departamentos están más afectados y permite despachar ayuda a las zonas críticas.

## Que incluye

- Dashboard por roles (Administración y Promotor de salud) con inicio de sesión, hecho con Tailwind CSS y animaciones.
- Registro clínico de niños con almacenamiento en PostgreSQL (con modo memoria automático si no hay DB disponible).
- Motor de riesgo por paciente (score bajo/medio/alto) — `src/riskModel.js`.
- **Modelo predictivo de vulnerabilidad por departamento** — `src/predictiveModel.js`: agrega el riesgo real de los pacientes registrados en cada departamento y calcula un índice 0-100 con 4 niveles (bajo / moderado / alerta / crítico).
- **Mapa predictivo interactivo** de los 25 departamentos del Perú (límites geográficos reales), con zoom, arrastre y clic para ver el detalle de cada zona, coloreado por el índice de vulnerabilidad.
- **Despacho de ayuda**: cuando un departamento está en alerta o crítico, el rol Administración puede registrar el envío de ayuda (brigada médica, kits, campañas) directamente desde el mapa.
- Análisis histórico de 405k atenciones (`TB_DIGTEL_ANEMIA_ATENDIDOS.csv`): tablas, mapa de calor por año/edad, diagnósticos más frecuentes.

## Stack

- Frontend: HTML + Tailwind CSS (CDN) + JavaScript vanilla (`app.js`), sin build step
- Backend: Node.js + Express, sesiones por cookie httpOnly
- Base de datos: PostgreSQL (con modo memoria automático si no hay DB disponible)

## Roles y acceso

| Rol | Usuario demo | Contraseña demo | Acceso |
|---|---|---|---|
| Administración | `admin` | `anemia2026` | Todo: resumen, pacientes, registro, mapa predictivo, **despachar ayuda** |
| Promotor de salud | `promotor` | `anemia2026` | Resumen, pacientes, registro, mapa predictivo (sin poder despachar ayuda) |

Estas cuentas se crean automáticamente al iniciar el servidor por primera vez (`DEFAULT_USERS` en `src/db.js`). **Cambia estas contraseñas antes de usar la app fuera de la demo.**

## Ejecutar local

1. Instala Node.js 20+ y PostgreSQL (opcional: sin PostgreSQL la app arranca igual en modo memoria).
2. Duplica `.env.example` como `.env`.
3. Instala dependencias y arranca:

```bash
npm install
npm start
```

4. Abre `http://localhost:3000` e inicia sesión con una cuenta demo.

## Ejecutar con Docker

```bash
docker compose up --build
```

Abre `http://localhost:3000`.

## Desplegar en Vercel

El proyecto ya trae `vercel.json` (corre `src/server.js` como función serverless con `@vercel/node`, e incluye `index.html`/`app.js` para que se sirvan estáticos).

1. Sube el repo a GitHub (o usa `vercel` desde la CLI directo en esta carpeta).
2. En [vercel.com](https://vercel.com), **Add New → Project** e importa el repo. Vercel detecta `vercel.json` automáticamente, no hace falta configurar framework.
3. En **Environment Variables** del proyecto en Vercel agrega, como mínimo:
   - `SESSION_SECRET` — cualquier cadena larga aleatoria.
4. Deploy.

**Importante — modo memoria en serverless:** sin base de datos, la app sigue funcionando (modo memoria), pero Vercel puede reciclar la función entre invocaciones y perder pacientes/sesiones registrados en la demo. Para que quede 100% estable:

1. Crea una base Postgres gratuita en [Neon](https://neon.tech) o [Supabase](https://supabase.com) (o usa Vercel Postgres desde el mismo dashboard del proyecto).
2. Copia su cadena de conexión (`postgres://usuario:password@host/basededatos`).
3. Agrégala como variable de entorno `DATABASE_URL` en Vercel (tiene prioridad sobre `DB_HOST`/`DB_USER`/etc., y ya viene con SSL configurado en `src/config.js`).
4. Redeploy — en el primer request se crean las tablas solas (`initDb()` corre de forma perezosa antes de responder cualquier ruta).

Sin este paso la demo funciona igual para una presentación corta; con él, los datos persisten de verdad entre visitas.

## Cómo funciona el modelo predictivo

Cada paciente registrado ya trae un **departamento real** (elegido al registrarlo) y un **score de riesgo** (`src/riskModel.js`, basado en hemoglobina, edad, distancia a la posta, dosis omitidas e idioma del hogar).

`getPatientsByDepartment()` en `src/db.js` agrupa esos pacientes por departamento y `computeVulnerability()` en `src/predictiveModel.js` calcula:

```
índice = avgRiskScore * 0.6 + (% pacientes en riesgo alto) * 100 * 0.4
```

con 4 niveles: **bajo** (<30), **moderado** (30-49), **alerta** (50-69), **crítico** (≥70). Los departamentos sin pacientes registrados se muestran como "sin datos" — nunca se les asigna un nivel de riesgo inventado.

No es un modelo de machine learning entrenado: es un puntaje compuesto y explicable, igual que el score individual. Con más historial puede evolucionar a un modelo de series de tiempo real (ver sección de datos faltantes más abajo).

## Endpoints principales

- `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me`
- `GET /api/patients` · `POST /api/patients`
- `POST /api/predict`
- `GET /api/stats`
- `GET /api/geo/peru-departments` — límites reales de los 25 departamentos (SVG)
- `GET /api/geo/patients-by-department` — pacientes reales + índice predictivo por departamento
- `GET /api/ayudas` · `POST /api/ayudas` (solo admin)
- `GET /api/analytics/anemia` — análisis del CSV histórico

## Modelo de negocio y sostenibilidad

- Inicio B2G: MINSA, DIRESA, gobiernos locales.
- Financiamiento inicial vía grants (BID Lab, UNICEF, ProInnovate).
- Escalabilidad SaaS / marca blanca para clínicas y ONGs.

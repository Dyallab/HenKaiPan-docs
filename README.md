# @henkaipan/docs

Documentación oficial de HenKaiPan ASPM (Application Security Posture Management).

Este package centraliza toda la documentación de producto, deployment y diseño de HenKaiPan en un solo lugar, eliminando la duplicación entre los repositorios.

## Estructura

```
docs/
├── src/
│   ├── self-hosted/
│   │   ├── quickstart.md      # Guía de inicio rápido
│   │   ├── kubernetes.md      # Deploy en Kubernetes
│   │   ├── production.md      # Deploy en producción (Docker Compose)
│   │   ├── licensing.md       # Licensing y feature gating
│   │   ├── backup.md          # Backup & Restore
│   │   └── operations.md      # Operations guide
│   ├── app/
│   │   ├── user-guide/
│   │   │   ├── 01-introduction.md
│   │   │   ├── 02-dashboard.md
│   │   │   ├── 03-findings.md
│   │   │   ├── 04-scans.md
│   │   │   ├── 05-projects.md
│   │   │   ├── 06-compliance.md
│   │   │   ├── 07-settings.md
│   │   │   ├── 08-knowledge.md
│   │   │   ├── 09-reports.md
│   │   │   └── 10-system.md
│   │   └── architecture/
│   │       └── queue-architecture.md
│   └── landing/
│       └── design.md          # Design system (Scale)
├── index.ts                   # Exports de paths
├── package.json
└── README.md
```

## Instalación

```bash
npm install @henkaipan/docs
```

O desde GitHub:

```bash
npm install github:henkaipan/henkaipan/docs
```

## Uso

### Importar paths a archivos

```ts
import { selfHosted, app, landing } from '@henkaipan/docs';

// Acceder a archivos específicos
const quickstartPath = selfHosted.quickstart;
const kubernetesPath = selfHosted.kubernetes;
const introPath = app.userGuide['01-introduction'];
const queueArchPath = app.architecture.queue;
const designPath = landing.design;
```

### Importar markdown directo (Astro/Next.js)

```ts
// Astro
import quickstart from '@henkaipan/docs/self-hosted/quickstart.md';
import dashboard from '@henkaipan/docs/app/user-guide/02-dashboard.md';

// En componente Astro
<Markdown content={quickstart} />
```

```tsx
// Next.js
import quickstart from '@henkaipan/docs/self-hosted/quickstart.md';

export default function Page() {
  return <Markdown>{quickstart}</Markdown>;
}
```

### Leer contenido raw (Node.js)

```ts
import { readFileSync } from 'fs';
import { selfHosted } from '@henkaipan/docs';

const content = readFileSync(selfHosted.quickstart, 'utf-8');
```

## Contenido

### Self-Hosted (`src/self-hosted/`)

Documentación para deployments self-hosted:

| Archivo | Descripción |
|---------|-------------|
| `quickstart.md` | Inicio rápido con Docker Compose |
| `kubernetes.md` | Deploy en Kubernetes |
| `production.md` | Guía de producción (nginx, TLS, backups) |
| `licensing.md` | Licensing, feature flags, generación de keys |
| `backup.md` | Backup & Restore de la base de datos |
| `operations.md` | Operations: scaling, troubleshooting, maintenance |

### App User Guide (`src/app/user-guide/`)

Guía de usuario de la aplicación:

| Archivo | Descripción |
|---------|-------------|
| `01-introduction.md` | Bienvenida y overview |
| `02-dashboard.md` | Dashboard y métricas |
| `03-findings.md` | Gestión de findings |
| `04-scans.md` | Ejecución de scans |
| `05-projects.md` | Proyectos y repositorios |
| `06-compliance.md` | Compliance frameworks |
| `07-settings.md` | Configuración e integraciones |
| `08-knowledge.md` | Knowledge Base |
| `09-reports.md` | Reportes ejecutivos |
| `10-system.md` | System status y health |

### App Architecture (`src/app/architecture/`)

Documentación técnica de arquitectura:

| Archivo | Descripción |
|---------|-------------|
| `queue-architecture.md` | Redis + Asynq, retry strategies, DLQ |

### Landing (`src/landing/`)

Documentación del design system:

| Archivo | Descripción |
|---------|-------------|
| `design.md` | Scale design system (tokens, typography, colors) |

## Versionamiento

Este package sigue [Semantic Versioning](https://semver.org/):

- **Major**: Cambios breaking en la estructura de docs o URLs
- **Minor**: Nueva documentación agregada
- **Patch**: Correcciones de typos o clarificaciones

## Publicación

```bash
# Build (genera dist/ con types)
npm run build

# Publicar a npm
npm publish --access public
```

## Desarrollo

```bash
# Instalar dependencias
npm install

# Build
npm run build

# Ver estructura
ls -la src/
```

## Migración desde repos originales

Este package reemplaza la documentación duplicada en:

- `HenKaiPan-app/docs/` → migrado a `src/app/`
- `HenKaiPan-self-hosted/docs/` → migrado a `src/self-hosted/`
- `HenKaiPan-Landing/docs/` → migrado a `src/self-hosted/` y `src/landing/`

Los repos originales deben:
1. Eliminar los archivos `.md` duplicados
2. Agregar `@henkaipan/docs` como dependencia
3. Referenciar la documentación desde este package

## License

MIT

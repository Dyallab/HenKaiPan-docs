/**
 * @dyallab/docs
 *
 * Documentación oficial de HenKaiPan
 *
 * @example
 * ```ts
 * // Importar paths a archivos markdown
 * import { selfHosted, app, landing } from '@dyallab/docs';
 *
 * // Acceder a archivos específicos
 * const quickstart = selfHosted.quickstart;
 * const kubernetes = selfHosted.kubernetes;
 * const userGuideIntro = app.userGuide['01-introduction'];
 * ```
 *
 * @example
 * ```ts
 * // En Astro (import directo de markdown)
 * import quickstart from '@dyallab/docs/self-hosted/quickstart.md';
 * ```
 */

export const selfHosted = {
  quickstart: 'self-hosted/quickstart.md',
  kubernetes: 'self-hosted/kubernetes.md',
  backup: 'self-hosted/backup.md',
  production: 'self-hosted/production.md',
  operations: 'self-hosted/operations.md',
} as const;

export const app = {
  userGuide: {
    '01-introduction': 'app/user-guide/01-introduction.md',
    '02-dashboard': 'app/user-guide/02-dashboard.md',
    '03-findings': 'app/user-guide/03-findings.md',
    '04-scans': 'app/user-guide/04-scans.md',
    '05-projects': 'app/user-guide/05-projects.md',
    '06-compliance': 'app/user-guide/06-compliance.md',
    '07-settings': 'app/user-guide/07-settings.md',
    '08-knowledge': 'app/user-guide/08-knowledge.md',
    '09-reports': 'app/user-guide/09-reports.md',
    '10-system': 'app/user-guide/10-system.md',
  },
  architecture: {
    queue: 'app/architecture/queue-architecture.md',
    ciCdIntegration: 'app/architecture/ci-cd-integration.md',
    mcpIntegration: 'app/architecture/mcp-integration.md',
  },
  ciCd: {
    'github-actions': 'app/architecture/ci-cd/github-actions.md',
    'gitlab-ci': 'app/architecture/ci-cd/gitlab-ci.md',
    jenkins: 'app/architecture/ci-cd/jenkins.md',
    'circleci': 'app/architecture/ci-cd/circleci.md',
    docker: 'app/architecture/ci-cd/docker.md',
    quickstart: 'app/architecture/ci-cd/quickstart.md',
  },
} as const;

export const landing = {
  design: 'landing/design.md',
} as const;

export type SelfHostedDoc = keyof typeof selfHosted;
export type AppUserGuideDoc = keyof typeof app.userGuide;
export type AppArchitectureDoc = keyof typeof app.architecture;
export type AppCiCdDoc = keyof typeof app.ciCd;
export type LandingDoc = keyof typeof landing;

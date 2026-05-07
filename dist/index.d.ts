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
export declare const selfHosted: {
    readonly quickstart: "self-hosted/quickstart.md";
    readonly kubernetes: "self-hosted/kubernetes.md";
    readonly licensing: "self-hosted/licensing.md";
    readonly backup: "self-hosted/backup.md";
    readonly production: "self-hosted/production.md";
    readonly operations: "self-hosted/operations.md";
};
export declare const app: {
    readonly userGuide: {
        readonly '01-introduction': "app/user-guide/01-introduction.md";
        readonly '02-dashboard': "app/user-guide/02-dashboard.md";
        readonly '03-findings': "app/user-guide/03-findings.md";
        readonly '04-scans': "app/user-guide/04-scans.md";
        readonly '05-projects': "app/user-guide/05-projects.md";
        readonly '06-compliance': "app/user-guide/06-compliance.md";
        readonly '07-settings': "app/user-guide/07-settings.md";
        readonly '08-knowledge': "app/user-guide/08-knowledge.md";
        readonly '09-reports': "app/user-guide/09-reports.md";
        readonly '10-system': "app/user-guide/10-system.md";
    };
    readonly architecture: {
        readonly queue: "app/architecture/queue-architecture.md";
    };
};
export declare const landing: {
    readonly design: "landing/design.md";
};
export type SelfHostedDoc = keyof typeof selfHosted;
export type AppUserGuideDoc = keyof typeof app.userGuide;
export type AppArchitectureDoc = keyof typeof app.architecture;
export type LandingDoc = keyof typeof landing;

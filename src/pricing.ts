/**
 * @dyallab/docs — Shared business pricing constants.
 *
 * Single source of truth for HenKaiPan pricing, consumed by the
 * legal pages (ToS) and, in future, the landing pricing card.
 * Keep in sync with https://henkaipan.dyallab.com.ar pricing section.
 */
export const pricing = {
  // Cloud (managed SaaS) monthly base fee, in USD.
  cloudBaseMonthlyUsd: 100,
  // Cloud monthly availability commitment (percent).
  cloudSla: 99,
  // Enterprise monthly availability commitment (percent).
  enterpriseSla: 99.99,
  // Overage pricing, in USD per unit per month.
  overage: {
    perUserUsd: 5,
    perProjectUsd: 0.5,
    perAiScanUsd: 1,
  },
  // Service credits (% of monthly base fee) at availability thresholds.
  // Ordered high-to-low availability; first matching row applies.
  credits: [
    { minAvailability: 99.9, cloud: 0, enterprise: 5 },
    { minAvailability: 99.5, cloud: 5, enterprise: 10 },
    { minAvailability: 99.0, cloud: 10, enterprise: 20 },
    { minAvailability: 0, cloud: 20, enterprise: 30 },
  ] as const,
  // Retention of operational logs, in months.
  retentionMonths: {
    auditLogs: 12,
    webhookDeliveryLogs: 12,
  } as const,
} as const;
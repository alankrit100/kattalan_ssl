export const PLAN_LIMITS = {
  free: {
    maxSites: 10,
  },
} as const

export const ALERT_THRESHOLDS = {
  ssl: [30, 14, 7],
  domain: [30, 14, 7],
} as const
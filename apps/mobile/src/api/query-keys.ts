export const queryKeys = {
  annualCosts: ['annualCosts'] as const,
  attachments: ['attachments'] as const,
  calendar: ['calendar'] as const,
  cleaning: ['cleaning'] as const,
  dataEntries: ['dataEntries'] as const,
  encryption: ['encryption'] as const,
  finances: ['finances'] as const,
  household: ['household'] as const,
  meal: ['meal'] as const,
  notes: ['notes'] as const,
  permissions: ['permissions'] as const,
  shopping: ['shopping'] as const,
  start: ['start'] as const,
  startDashboard: ['start', 'dashboard'] as const,
  todo: ['todo'] as const
};

export type AppQueryKey = (typeof queryKeys)[keyof typeof queryKeys];

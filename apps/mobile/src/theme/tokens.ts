export const colors = {
  background: '#F7F8FA',
  border: '#737E8A',
  calendar: '#2856B6',
  card: '#FFFFFF',
  danger: '#B42318',
  dangerSoft: '#FDEDEC',
  finance: '#087A46',
  food: '#8A5700',
  info: '#2E5CB8',
  infoSoft: '#E7EEFC',
  primary: '#2E5CB8',
  primaryDark: '#294F9E',
  primaryDarker: '#224071',
  primaryLight: '#476FC3',
  primarySoft: '#E7EEFC',
  shopping: '#3B6D23',
  shoppingSoft: '#E7F0E2',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF1F4',
  successSoft: '#E4F4EB',
  text: '#18212B',
  textMuted: '#45515E',
  textSubtle: '#5B6672',
  warning: '#8A5500',
  warningSoft: '#FFF1D6'
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
} as const;

export const radii = {
  card: 8,
  control: 8
} as const;

export const shadows = {
  card: {
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 20
  },
  control: {
    elevation: 1,
    shadowColor: '#0F172A',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 10
  }
} as const;

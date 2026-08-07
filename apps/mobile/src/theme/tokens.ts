export const colors = {
  background: '#F6F7F8',
  border: '#D8DEE5',
  calendar: '#3366FF',
  card: '#FFFFFF',
  danger: '#B42318',
  dangerSoft: '#FFF1F0',
  finance: '#00AB55',
  food: '#FFAB00',
  info: '#2065D1',
  infoSoft: '#EAF2FF',
  primary: '#4F7DF3',
  primaryDark: '#315BCB',
  primaryDarker: '#243F8F',
  primaryLight: '#7FA2FF',
  primarySoft: '#E8EEFF',
  shopping: '#4F8D2C',
  shoppingSoft: '#EEF7E8',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F3F5',
  successSoft: '#D8FBDE',
  text: '#17212B',
  textMuted: '#5E6A77',
  textSubtle: '#7D8996',
  warning: '#B76E00',
  warningSoft: '#FFF4DE'
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

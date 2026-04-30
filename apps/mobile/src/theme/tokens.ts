export const colors = {
  background: '#F9FAFB',
  border: '#DFE3E8',
  calendar: '#3366FF',
  card: '#FFFFFF',
  danger: '#B42318',
  dangerSoft: '#FFF1F0',
  finance: '#00AB55',
  food: '#FFAB00',
  info: '#2065D1',
  infoSoft: '#EAF2FF',
  primary: '#00AB55',
  primaryDark: '#007B55',
  primaryDarker: '#005249',
  primaryLight: '#5BE584',
  primarySoft: '#C8FACD',
  shopping: '#8E33FF',
  shoppingSoft: '#F4F0FF',
  surface: '#FFFFFF',
  surfaceMuted: '#F4F6F8',
  successSoft: '#D8FBDE',
  text: '#1C252E',
  textMuted: '#637381',
  textSubtle: '#919EAB',
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
    shadowColor: '#919EAB',
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 24
  },
  control: {
    elevation: 1,
    shadowColor: '#919EAB',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 10
  }
} as const;

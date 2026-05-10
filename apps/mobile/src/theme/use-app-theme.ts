import { useColorScheme } from 'react-native';
import { colors, radii, shadows, spacing } from './tokens';

type Palette = { [Key in keyof typeof colors]: string } & {
  backdrop: string;
  cardMuted: string;
  field: string;
  inverseText: string;
  line: string;
  overlay: string;
  softBlue: string;
  softGreen: string;
  softOrange: string;
  softPurple: string;
};

const lightPalette: Palette = {
  ...colors,
  background: '#F7F8FA',
  backdrop: 'rgba(28, 37, 46, 0.42)',
  card: '#FFFFFF',
  cardMuted: '#F4F6F8',
  field: '#FFFFFF',
  inverseText: '#FFFFFF',
  line: 'rgba(145, 158, 171, 0.24)',
  overlay: '#FFFFFF',
  softBlue: '#EAF2FF',
  softGreen: '#E9FCD4',
  softOrange: '#FFF4DE',
  softPurple: '#F4F0FF',
  text: '#1C252E',
  textMuted: '#637381',
  textSubtle: '#919EAB'
};

const darkPalette: typeof lightPalette = {
  ...colors,
  background: '#0B1220',
  backdrop: 'rgba(0, 0, 0, 0.62)',
  border: 'rgba(148, 163, 184, 0.28)',
  card: '#121A2B',
  cardMuted: '#182235',
  danger: '#F97066',
  dangerSoft: 'rgba(240, 68, 56, 0.18)',
  field: '#0F172A',
  finance: '#5BE584',
  food: '#FFC857',
  info: '#70A7FF',
  infoSoft: 'rgba(51, 102, 255, 0.18)',
  inverseText: '#07111F',
  line: 'rgba(148, 163, 184, 0.22)',
  overlay: '#121A2B',
  primary: '#36D17C',
  primaryDark: '#7EE2A8',
  primaryDarker: '#B7F7CA',
  primaryLight: '#8AF0B2',
  primarySoft: 'rgba(54, 209, 124, 0.18)',
  shopping: '#C084FC',
  shoppingSoft: 'rgba(192, 132, 252, 0.18)',
  softBlue: 'rgba(51, 102, 255, 0.18)',
  softGreen: 'rgba(54, 209, 124, 0.16)',
  softOrange: 'rgba(255, 171, 0, 0.18)',
  softPurple: 'rgba(192, 132, 252, 0.18)',
  successSoft: 'rgba(54, 209, 124, 0.2)',
  surface: '#121A2B',
  surfaceMuted: '#182235',
  text: '#F8FAFC',
  textMuted: '#CBD5E1',
  textSubtle: '#94A3B8',
  warning: '#FDB022',
  warningSoft: 'rgba(253, 176, 34, 0.18)'
};

export type AppPalette = typeof lightPalette;

export function useAppTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  return {
    colors: isDark ? darkPalette : lightPalette,
    isDark,
    radii,
    shadows,
    spacing
  };
}

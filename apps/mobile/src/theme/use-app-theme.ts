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
  background: '#11100E',
  backdrop: 'rgba(0, 0, 0, 0.62)',
  border: 'rgba(226, 218, 205, 0.16)',
  calendar: '#8FAEFF',
  card: '#1A1815',
  cardMuted: '#22201C',
  danger: '#FF8A7A',
  dangerSoft: 'rgba(255, 138, 122, 0.14)',
  field: '#171511',
  finance: '#7FD9A8',
  food: '#F0C36A',
  info: '#8FAEFF',
  infoSoft: 'rgba(143, 174, 255, 0.14)',
  inverseText: '#0B0F0C',
  line: 'rgba(226, 218, 205, 0.11)',
  overlay: '#1A1815',
  primary: '#8FAEFF',
  primaryDark: '#C5D4FF',
  primaryDarker: '#E2E9FF',
  primaryLight: '#AFC4FF',
  primarySoft: 'rgba(143, 174, 255, 0.16)',
  shopping: '#C9A1FF',
  shoppingSoft: 'rgba(201, 161, 255, 0.14)',
  softBlue: 'rgba(143, 174, 255, 0.14)',
  softGreen: 'rgba(111, 211, 155, 0.13)',
  softOrange: 'rgba(240, 195, 106, 0.15)',
  softPurple: 'rgba(201, 161, 255, 0.14)',
  successSoft: 'rgba(111, 211, 155, 0.17)',
  surface: '#1A1815',
  surfaceMuted: '#22201C',
  text: '#F4EFE6',
  textMuted: '#C8BEAF',
  textSubtle: '#978C7A',
  warning: '#E7B65F',
  warningSoft: 'rgba(231, 182, 95, 0.15)'
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

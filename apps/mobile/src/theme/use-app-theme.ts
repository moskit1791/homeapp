import { useColorScheme } from 'react-native';
import { colors, radii, shadows, spacing } from './tokens';

const lightPalette = {
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

const darkPalette = {
  ...colors,
  background: '#0F1720',
  backdrop: 'rgba(0, 0, 0, 0.64)',
  border: 'rgba(145, 158, 171, 0.24)',
  card: '#161C24',
  cardMuted: '#212B36',
  dangerSoft: 'rgba(255, 86, 48, 0.16)',
  field: '#111820',
  infoSoft: 'rgba(32, 101, 209, 0.18)',
  inverseText: '#FFFFFF',
  line: 'rgba(145, 158, 171, 0.24)',
  overlay: '#1C252E',
  primaryDark: '#5BE584',
  primarySoft: 'rgba(0, 171, 85, 0.18)',
  shoppingSoft: 'rgba(142, 51, 255, 0.2)',
  softBlue: 'rgba(51, 102, 255, 0.18)',
  softGreen: 'rgba(34, 197, 94, 0.18)',
  softOrange: 'rgba(255, 171, 0, 0.18)',
  softPurple: 'rgba(142, 51, 255, 0.18)',
  successSoft: 'rgba(54, 179, 126, 0.18)',
  surface: '#161C24',
  surfaceMuted: '#212B36',
  text: '#F9FAFB',
  textMuted: '#C4CDD5',
  textSubtle: '#919EAB',
  warningSoft: 'rgba(255, 171, 0, 0.18)'
};

export type AppPalette = Record<keyof typeof lightPalette, string>;

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

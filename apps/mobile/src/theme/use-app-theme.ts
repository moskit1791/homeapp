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

export type AppPalette = Record<keyof typeof lightPalette, string>;

export function useAppTheme() {
  return {
    colors: lightPalette,
    isDark: false,
    radii,
    shadows,
    spacing
  };
}

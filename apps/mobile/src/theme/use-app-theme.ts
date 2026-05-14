import { createContext, createElement, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { loadStoredJson, saveStoredJson } from '../session/secure-session-store';
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

export type DarkAccentKey = 'violet' | 'cyan' | 'pink' | 'amber';

type DarkAccentOption = {
  color: string;
  label: string;
  value: DarkAccentKey;
};

type StoredThemePreferences = {
  darkAccent?: DarkAccentKey;
};

type ThemePreferencesContextValue = {
  darkAccent: DarkAccentKey;
  setDarkAccent: (accent: DarkAccentKey) => void;
};

const themePreferencesKey = 'homeapp.theme-preferences.v1';
const defaultDarkAccent: DarkAccentKey = 'violet';

export const darkAccentOptions: DarkAccentOption[] = [
  { color: '#B56CFF', label: 'Fiolet', value: 'violet' },
  { color: '#20E7FF', label: 'Cyjan', value: 'cyan' },
  { color: '#FF4FD8', label: 'Róż', value: 'pink' },
  { color: '#FFB020', label: 'Amber', value: 'amber' }
];

const darkAccentPalettes: Record<
  DarkAccentKey,
  {
    primary: string;
    primaryDark: string;
    primaryDarker: string;
    primaryLight: string;
    primarySoft: string;
  }
> = {
  amber: {
    primary: '#FFB020',
    primaryDark: '#FFD166',
    primaryDarker: '#FFE2A3',
    primaryLight: '#FFC857',
    primarySoft: 'rgba(255, 176, 32, 0.18)'
  },
  cyan: {
    primary: '#20E7FF',
    primaryDark: '#9AF6FF',
    primaryDarker: '#D6FBFF',
    primaryLight: '#6EF0FF',
    primarySoft: 'rgba(32, 231, 255, 0.17)'
  },
  pink: {
    primary: '#FF4FD8',
    primaryDark: '#FF9BE9',
    primaryDarker: '#FFD5F5',
    primaryLight: '#FF7DE2',
    primarySoft: 'rgba(255, 79, 216, 0.17)'
  },
  violet: {
    primary: '#B56CFF',
    primaryDark: '#D7B2FF',
    primaryDarker: '#EBDCFF',
    primaryLight: '#CC96FF',
    primarySoft: 'rgba(181, 108, 255, 0.18)'
  }
};

const ThemePreferencesContext = createContext<ThemePreferencesContextValue>({
  darkAccent: defaultDarkAccent,
  setDarkAccent: () => undefined
});

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

const darkPaletteBase: typeof lightPalette = {
  ...colors,
  background: '#181A22',
  backdrop: 'rgba(7, 9, 16, 0.58)',
  border: 'rgba(231, 236, 248, 0.18)',
  calendar: '#B56CFF',
  card: '#232733',
  cardMuted: '#2B3140',
  danger: '#FF7A90',
  dangerSoft: 'rgba(255, 122, 144, 0.18)',
  field: '#272C38',
  finance: '#66E3FF',
  food: '#FFC766',
  info: '#B56CFF',
  infoSoft: 'rgba(181, 108, 255, 0.18)',
  inverseText: '#050711',
  line: 'rgba(231, 236, 248, 0.12)',
  overlay: '#232733',
  primary: '#B56CFF',
  primaryDark: '#D7B2FF',
  primaryDarker: '#EBDCFF',
  primaryLight: '#CC96FF',
  primarySoft: 'rgba(181, 108, 255, 0.18)',
  shopping: '#FF75DE',
  shoppingSoft: 'rgba(255, 117, 222, 0.16)',
  softBlue: 'rgba(181, 108, 255, 0.18)',
  softGreen: 'rgba(102, 227, 255, 0.15)',
  softOrange: 'rgba(255, 199, 102, 0.17)',
  softPurple: 'rgba(255, 117, 222, 0.16)',
  successSoft: 'rgba(102, 227, 255, 0.17)',
  surface: '#232733',
  surfaceMuted: '#2B3140',
  text: '#FFFFFF',
  textMuted: '#DDE3F0',
  textSubtle: '#B9C3D6',
  warning: '#FFD977',
  warningSoft: 'rgba(255, 217, 119, 0.17)'
};

export type AppPalette = typeof lightPalette;

export function AppThemeProvider({ children }: PropsWithChildren) {
  const [darkAccent, setDarkAccentState] = useState<DarkAccentKey>(defaultDarkAccent);

  useEffect(() => {
    loadStoredJson<StoredThemePreferences>(themePreferencesKey)
      .then((stored) => {
        if (stored?.darkAccent && isDarkAccentKey(stored.darkAccent)) {
          setDarkAccentState(stored.darkAccent);
        }
      })
      .catch(() => undefined);
  }, []);

  const value = useMemo<ThemePreferencesContextValue>(
    () => ({
      darkAccent,
      setDarkAccent: (accent) => {
        setDarkAccentState(accent);
        saveStoredJson<StoredThemePreferences>(themePreferencesKey, { darkAccent: accent }).catch(
          () => undefined
        );
      }
    }),
    [darkAccent]
  );

  return createElement(ThemePreferencesContext.Provider, { value }, children);
}

export function useThemePreferences() {
  return useContext(ThemePreferencesContext);
}

export function useAppTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const { darkAccent } = useThemePreferences();
  const palette = useMemo(
    () => (isDark ? buildDarkPalette(darkAccent) : lightPalette),
    [darkAccent, isDark]
  );

  return {
    colors: palette,
    darkAccent,
    isDark,
    radii,
    shadows,
    spacing
  };
}

function buildDarkPalette(accentKey: DarkAccentKey): typeof lightPalette {
  const accent = darkAccentPalettes[accentKey];

  return {
    ...darkPaletteBase,
    calendar: accent.primary,
    info: accent.primary,
    infoSoft: accent.primarySoft,
    primary: accent.primary,
    primaryDark: accent.primaryDark,
    primaryDarker: accent.primaryDarker,
    primaryLight: accent.primaryLight,
    primarySoft: accent.primarySoft,
    softBlue: accent.primarySoft
  };
}

function isDarkAccentKey(value: string): value is DarkAccentKey {
  return value === 'violet' || value === 'cyan' || value === 'pink' || value === 'amber';
}

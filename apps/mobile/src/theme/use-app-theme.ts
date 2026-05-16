import { createContext, createElement, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, type ColorSchemeName } from 'react-native';
import { loadStoredJson, saveStoredJson } from '../session/secure-session-store';
import { colors, radii, shadows, spacing } from './tokens';

type Palette = { [Key in keyof typeof colors]: string } & {
  backdrop: string;
  backgroundBottom: string;
  backgroundTop: string;
  cardMuted: string;
  field: string;
  inverseText: string;
  line: string;
  modalSurface: string;
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
  accent?: DarkAccentKey;
  darkAccent?: DarkAccentKey;
};

type ThemePreferencesContextValue = {
  accent: DarkAccentKey;
  darkAccent: DarkAccentKey;
  systemScheme: ColorSchemeName;
  setAccent: (accent: DarkAccentKey) => void;
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

const lightAccentPalettes: typeof darkAccentPalettes = {
  amber: {
    primary: '#B45309',
    primaryDark: '#92400E',
    primaryDarker: '#78350F',
    primaryLight: '#D97706',
    primarySoft: 'rgba(180, 83, 9, 0.13)'
  },
  cyan: {
    primary: '#0E7490',
    primaryDark: '#155E75',
    primaryDarker: '#164E63',
    primaryLight: '#06B6D4',
    primarySoft: 'rgba(14, 116, 144, 0.13)'
  },
  pink: {
    primary: '#C026D3',
    primaryDark: '#A21CAF',
    primaryDarker: '#701A75',
    primaryLight: '#E879F9',
    primarySoft: 'rgba(192, 38, 211, 0.13)'
  },
  violet: {
    primary: '#7C3AED',
    primaryDark: '#6D28D9',
    primaryDarker: '#4C1D95',
    primaryLight: '#A78BFA',
    primarySoft: 'rgba(124, 58, 237, 0.12)'
  }
};

const ThemePreferencesContext = createContext<ThemePreferencesContextValue>({
  accent: defaultDarkAccent,
  darkAccent: defaultDarkAccent,
  systemScheme: Appearance.getColorScheme(),
  setAccent: () => undefined,
  setDarkAccent: () => undefined
});

const lightPalette: Palette = {
  ...colors,
  background: '#F7F8FA',
  backgroundBottom: '#F2F5F8',
  backgroundTop: '#FFFFFF',
  backdrop: 'rgba(28, 37, 46, 0.42)',
  card: '#FFFFFF',
  cardMuted: '#F4F6F8',
  field: '#FFFFFF',
  inverseText: '#FFFFFF',
  line: 'rgba(145, 158, 171, 0.24)',
  modalSurface: 'rgba(246, 247, 249, 0.95)',
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
  background: '#0C1220',
  backgroundBottom: '#080D18',
  backgroundTop: '#1B2032',
  backdrop: 'rgba(6, 9, 18, 0.68)',
  border: 'rgba(238, 244, 255, 0.2)',
  calendar: '#B56CFF',
  card: 'rgba(38, 45, 67, 0.68)',
  cardMuted: 'rgba(48, 56, 78, 0.62)',
  danger: '#FF7A90',
  dangerSoft: 'rgba(255, 122, 144, 0.18)',
  field: 'rgba(30, 36, 54, 0.78)',
  finance: '#66E3FF',
  food: '#FFC766',
  info: '#B56CFF',
  infoSoft: 'rgba(181, 108, 255, 0.18)',
  inverseText: '#050711',
  line: 'rgba(238, 244, 255, 0.14)',
  modalSurface: 'rgba(18, 22, 34, 0.95)',
  overlay: 'rgba(32, 39, 59, 0.72)',
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
  surface: 'rgba(38, 45, 67, 0.68)',
  surfaceMuted: 'rgba(48, 56, 78, 0.62)',
  text: '#FFFFFF',
  textMuted: '#E2E7F3',
  textSubtle: '#B8C2D8',
  warning: '#FFD977',
  warningSoft: 'rgba(255, 217, 119, 0.17)'
};

export type AppPalette = typeof lightPalette;

export function AppThemeProvider({ children }: PropsWithChildren) {
  const [darkAccent, setDarkAccentState] = useState<DarkAccentKey>(defaultDarkAccent);
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(() => Appearance.getColorScheme());

  useEffect(() => {
    loadStoredJson<StoredThemePreferences>(themePreferencesKey)
      .then((stored) => {
        const storedAccent = stored?.accent ?? stored?.darkAccent;

        if (storedAccent && isDarkAccentKey(storedAccent)) {
          setDarkAccentState(storedAccent);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });

    return () => subscription.remove();
  }, []);

  const value = useMemo<ThemePreferencesContextValue>(
    () => ({
      accent: darkAccent,
      darkAccent,
      systemScheme,
      setAccent: (accent) => {
        setDarkAccentState(accent);
        saveStoredJson<StoredThemePreferences>(themePreferencesKey, {
          accent,
          darkAccent: accent
        }).catch(() => undefined);
      },
      setDarkAccent: (accent) => {
        setDarkAccentState(accent);
        saveStoredJson<StoredThemePreferences>(themePreferencesKey, {
          accent,
          darkAccent: accent
        }).catch(() => undefined);
      }
    }),
    [darkAccent, systemScheme]
  );

  return createElement(ThemePreferencesContext.Provider, { value }, children);
}

export function useThemePreferences() {
  return useContext(ThemePreferencesContext);
}

export function useAppTheme() {
  const { darkAccent, systemScheme } = useThemePreferences();
  const isDark = systemScheme === 'dark';
  const palette = useMemo(
    () => (isDark ? buildDarkPalette(darkAccent) : buildLightPalette(darkAccent)),
    [darkAccent, isDark]
  );

  return {
    accent: darkAccent,
    colors: palette,
    darkAccent,
    isDark,
    radii,
    shadows,
    spacing
  };
}

function buildLightPalette(accentKey: DarkAccentKey): typeof lightPalette {
  const accent = lightAccentPalettes[accentKey];

  return {
    ...lightPalette,
    backgroundTop: mixLightTop(accent.primary),
    calendar: accent.primary,
    info: accent.primary,
    infoSoft: accent.primarySoft,
    primary: accent.primary,
    primaryDark: accent.primaryDark,
    primaryDarker: accent.primaryDarker,
    primaryLight: accent.primaryLight,
    primarySoft: accent.primarySoft,
    shopping: accent.primary,
    shoppingSoft: accent.primarySoft,
    softBlue: accent.primarySoft,
    softPurple: accent.primarySoft
  };
}

function buildDarkPalette(accentKey: DarkAccentKey): typeof lightPalette {
  const accent = darkAccentPalettes[accentKey];

  return {
    ...darkPaletteBase,
    calendar: accent.primary,
    backgroundTop: mixDarkTop(accent.primary),
    info: accent.primary,
    infoSoft: accent.primarySoft,
    primary: accent.primary,
    primaryDark: accent.primaryDark,
    primaryDarker: accent.primaryDarker,
    primaryLight: accent.primaryLight,
    primarySoft: accent.primarySoft,
    shopping: accent.primary,
    shoppingSoft: accent.primarySoft,
    softBlue: accent.primarySoft,
    softPurple: accent.primarySoft
  };
}

function mixLightTop(accent: string): string {
  const rgb = hexToRgb(accent);

  if (!rgb) {
    return lightPalette.backgroundTop;
  }

  return `rgba(${rgb.red}, ${rgb.green}, ${rgb.blue}, 0.08)`;
}

function mixDarkTop(accent: string): string {
  const base = hexToRgb(darkPaletteBase.backgroundTop);
  const rgb = hexToRgb(accent);

  if (!base || !rgb) {
    return darkPaletteBase.backgroundTop;
  }

  return rgbToHex({
    blue: Math.round(base.blue * 0.82 + rgb.blue * 0.18),
    green: Math.round(base.green * 0.82 + rgb.green * 0.18),
    red: Math.round(base.red * 0.82 + rgb.red * 0.18)
  });
}

function rgbToHex(value: { blue: number; green: number; red: number }): string {
  const toHex = (part: number) => Math.max(0, Math.min(255, part))
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();

  return `#${toHex(value.red)}${toHex(value.green)}${toHex(value.blue)}`;
}

function hexToRgb(value: string): { blue: number; green: number; red: number } | null {
  if (!value.startsWith('#') || value.length !== 7) {
    return null;
  }

  const red = Number.parseInt(value.slice(1, 3), 16);
  const green = Number.parseInt(value.slice(3, 5), 16);
  const blue = Number.parseInt(value.slice(5, 7), 16);

  if ([red, green, blue].some((part) => Number.isNaN(part))) {
    return null;
  }

  return { blue, green, red };
}

function isDarkAccentKey(value: string): value is DarkAccentKey {
  return value === 'violet' || value === 'cyan' || value === 'pink' || value === 'amber';
}

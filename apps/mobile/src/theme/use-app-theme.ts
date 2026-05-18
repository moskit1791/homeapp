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

export type DarkAccentKey = string;

type DarkAccentOption = {
  color: string;
  label: string;
  value: DarkAccentKey;
};

type AccentPalette = {
  primary: string;
  primaryDark: string;
  primaryDarker: string;
  primaryLight: string;
  primarySoft: string;
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
const defaultDarkAccent: DarkAccentKey = '#B56CFF';

export const darkAccentOptions: DarkAccentOption[] = [
  { color: '#B56CFF', label: 'Fiolet', value: 'violet' },
  { color: '#20E7FF', label: 'Cyjan', value: 'cyan' },
  { color: '#FF4FD8', label: 'Róż', value: 'pink' },
  { color: '#FFB020', label: 'Amber', value: 'amber' },
  { color: '#36D399', label: 'Szmaragd', value: 'emerald' },
  { color: '#FF6B6B', label: 'Koral', value: 'sunset' }
];

export const accentColorOptions: DarkAccentOption[] = [
  { color: '#F87171', label: 'Red 1', value: '#F87171' },
  { color: '#EF4444', label: 'Red 2', value: '#EF4444' },
  { color: '#DC2626', label: 'Red 3', value: '#DC2626' },
  { color: '#FB7185', label: 'Rose 1', value: '#FB7185' },
  { color: '#F43F5E', label: 'Rose 2', value: '#F43F5E' },
  { color: '#E11D48', label: 'Rose 3', value: '#E11D48' },
  { color: '#F472B6', label: 'Pink 1', value: '#F472B6' },
  { color: '#FF4FD8', label: 'Pink 2', value: '#FF4FD8' },
  { color: '#DB2777', label: 'Pink 3', value: '#DB2777' },
  { color: '#E879F9', label: 'Fuchsia 1', value: '#E879F9' },
  { color: '#D946EF', label: 'Fuchsia 2', value: '#D946EF' },
  { color: '#C026D3', label: 'Fuchsia 3', value: '#C026D3' },
  { color: '#C084FC', label: 'Purple 1', value: '#C084FC' },
  { color: '#A855F7', label: 'Purple 2', value: '#A855F7' },
  { color: '#9333EA', label: 'Purple 3', value: '#9333EA' },
  { color: '#B56CFF', label: 'Violet 1', value: '#B56CFF' },
  { color: '#8B5CF6', label: 'Violet 2', value: '#8B5CF6' },
  { color: '#7C3AED', label: 'Violet 3', value: '#7C3AED' },
  { color: '#818CF8', label: 'Indigo 1', value: '#818CF8' },
  { color: '#6366F1', label: 'Indigo 2', value: '#6366F1' },
  { color: '#4F46E5', label: 'Indigo 3', value: '#4F46E5' },
  { color: '#60A5FA', label: 'Blue 1', value: '#60A5FA' },
  { color: '#3B82F6', label: 'Blue 2', value: '#3B82F6' },
  { color: '#2563EB', label: 'Blue 3', value: '#2563EB' },
  { color: '#38BDF8', label: 'Sky 1', value: '#38BDF8' },
  { color: '#0EA5E9', label: 'Sky 2', value: '#0EA5E9' },
  { color: '#0284C7', label: 'Sky 3', value: '#0284C7' },
  { color: '#22D3EE', label: 'Cyan 1', value: '#22D3EE' },
  { color: '#20E7FF', label: 'Cyan 2', value: '#20E7FF' },
  { color: '#0891B2', label: 'Cyan 3', value: '#0891B2' },
  { color: '#2DD4BF', label: 'Teal 1', value: '#2DD4BF' },
  { color: '#14B8A6', label: 'Teal 2', value: '#14B8A6' },
  { color: '#0D9488', label: 'Teal 3', value: '#0D9488' },
  { color: '#34D399', label: 'Emerald 1', value: '#34D399' },
  { color: '#36D399', label: 'Emerald 2', value: '#36D399' },
  { color: '#059669', label: 'Emerald 3', value: '#059669' },
  { color: '#4ADE80', label: 'Green 1', value: '#4ADE80' },
  { color: '#22C55E', label: 'Green 2', value: '#22C55E' },
  { color: '#16A34A', label: 'Green 3', value: '#16A34A' },
  { color: '#A3E635', label: 'Lime 1', value: '#A3E635' },
  { color: '#84CC16', label: 'Lime 2', value: '#84CC16' },
  { color: '#65A30D', label: 'Lime 3', value: '#65A30D' },
  { color: '#FDE047', label: 'Yellow 1', value: '#FDE047' },
  { color: '#EAB308', label: 'Yellow 2', value: '#EAB308' },
  { color: '#CA8A04', label: 'Yellow 3', value: '#CA8A04' },
  { color: '#FBBF24', label: 'Amber 1', value: '#FBBF24' },
  { color: '#FFB020', label: 'Amber 2', value: '#FFB020' },
  { color: '#D97706', label: 'Amber 3', value: '#D97706' },
  { color: '#FB923C', label: 'Orange 1', value: '#FB923C' },
  { color: '#F97316', label: 'Orange 2', value: '#F97316' },
  { color: '#EA580C', label: 'Orange 3', value: '#EA580C' },
  { color: '#FF8A8A', label: 'Coral 1', value: '#FF8A8A' },
  { color: '#FF6B6B', label: 'Coral 2', value: '#FF6B6B' },
  { color: '#F9736B', label: 'Coral 3', value: '#F9736B' },
  { color: '#A16207', label: 'Brown 1', value: '#A16207' },
  { color: '#92400E', label: 'Brown 2', value: '#92400E' },
  { color: '#7C2D12', label: 'Brown 3', value: '#7C2D12' },
  { color: '#F8FAFC', label: 'White', value: '#F8FAFC' },
  { color: '#E5E7EB', label: 'Gray 1', value: '#E5E7EB' },
  { color: '#94A3B8', label: 'Gray 2', value: '#94A3B8' },
  { color: '#475569', label: 'Graphite', value: '#475569' },
  { color: '#111827', label: 'Black', value: '#111827' }
];

const darkAccentPalettes: Partial<Record<DarkAccentKey, AccentPalette>> = {
  amber: {
    primary: '#FFB020',
    primaryDark: '#FFD166',
    primaryDarker: '#FFE2A3',
    primaryLight: '#FFC857',
    primarySoft: 'rgba(255, 176, 32, 0.18)'
  },
  emerald: {
    primary: '#36D399',
    primaryDark: '#8BF0C7',
    primaryDarker: '#C9FBE6',
    primaryLight: '#63E6B5',
    primarySoft: 'rgba(54, 211, 153, 0.17)'
  },
  sunset: {
    primary: '#FF6B6B',
    primaryDark: '#FFA3A3',
    primaryDarker: '#FFD6D6',
    primaryLight: '#FF8A8A',
    primarySoft: 'rgba(255, 107, 107, 0.17)'
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

const lightAccentPalettes: Partial<Record<DarkAccentKey, AccentPalette>> = {
  amber: {
    primary: '#B45309',
    primaryDark: '#7C2D12',
    primaryDarker: '#431407',
    primaryLight: '#F59E0B',
    primarySoft: 'rgba(180, 83, 9, 0.16)'
  },
  emerald: {
    primary: '#15803D',
    primaryDark: '#166534',
    primaryDarker: '#14532D',
    primaryLight: '#22C55E',
    primarySoft: 'rgba(21, 128, 61, 0.15)'
  },
  sunset: {
    primary: '#BE123C',
    primaryDark: '#9F1239',
    primaryDarker: '#4C0519',
    primaryLight: '#F43F5E',
    primarySoft: 'rgba(190, 18, 60, 0.14)'
  },
  cyan: {
    primary: '#0369A1',
    primaryDark: '#075985',
    primaryDarker: '#0C4A6E',
    primaryLight: '#0EA5E9',
    primarySoft: 'rgba(3, 105, 161, 0.14)'
  },
  pink: {
    primary: '#BE185D',
    primaryDark: '#9D174D',
    primaryDarker: '#500724',
    primaryLight: '#EC4899',
    primarySoft: 'rgba(190, 24, 93, 0.14)'
  },
  violet: {
    primary: '#6D28D9',
    primaryDark: '#5B21B6',
    primaryDarker: '#2E1065',
    primaryLight: '#8B5CF6',
    primarySoft: 'rgba(109, 40, 217, 0.14)'
  }
};

const legacyAccentValues: Record<string, string> = {
  amber: '#FFB020',
  cyan: '#20E7FF',
  emerald: '#36D399',
  pink: '#FF4FD8',
  sunset: '#FF6B6B',
  violet: '#B56CFF'
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
  backgroundBottom: '#10182A',
  backgroundTop: '#1B2032',
  backdrop: 'rgba(6, 9, 18, 0.68)',
  border: 'rgba(238, 244, 255, 0.2)',
  calendar: '#38BDF8',
  card: 'rgba(38, 45, 67, 0.68)',
  cardMuted: 'rgba(48, 56, 78, 0.62)',
  danger: '#FF7A90',
  dangerSoft: 'rgba(255, 122, 144, 0.18)',
  field: 'rgba(30, 36, 54, 0.78)',
  finance: '#34D399',
  food: '#FBBF24',
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
  shopping: '#A78BFA',
  shoppingSoft: 'rgba(167, 139, 250, 0.16)',
  softBlue: 'rgba(56, 189, 248, 0.16)',
  softGreen: 'rgba(52, 211, 153, 0.16)',
  softOrange: 'rgba(255, 199, 102, 0.17)',
  softPurple: 'rgba(167, 139, 250, 0.16)',
  successSoft: 'rgba(52, 211, 153, 0.17)',
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

        const normalizedAccent = normalizeAccentValue(storedAccent);

        if (normalizedAccent) {
          setDarkAccentState(normalizedAccent);
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
        const normalizedAccent = normalizeAccentValue(accent) ?? defaultDarkAccent;

        setDarkAccentState(normalizedAccent);
        saveStoredJson<StoredThemePreferences>(themePreferencesKey, {
          accent: normalizedAccent,
          darkAccent: normalizedAccent
        }).catch(() => undefined);
      },
      setDarkAccent: (accent) => {
        const normalizedAccent = normalizeAccentValue(accent) ?? defaultDarkAccent;

        setDarkAccentState(normalizedAccent);
        saveStoredJson<StoredThemePreferences>(themePreferencesKey, {
          accent: normalizedAccent,
          darkAccent: normalizedAccent
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
  const accent = resolveLightAccentPalette(accentKey);

  return {
    ...lightPalette,
    backgroundBottom: mixLightBottom(accent.primary),
    info: accent.primary,
    infoSoft: accent.primarySoft,
    primary: accent.primary,
    primaryDark: accent.primaryDark,
    primaryDarker: accent.primaryDarker,
    primaryLight: accent.primaryLight,
    primarySoft: accent.primarySoft
  };
}

function buildDarkPalette(accentKey: DarkAccentKey): typeof lightPalette {
  const accent = resolveDarkAccentPalette(accentKey);

  return {
    ...darkPaletteBase,
    backgroundBottom: mixDarkBottom(accent.primary),
    info: accent.primary,
    infoSoft: accent.primarySoft,
    primary: accent.primary,
    primaryDark: accent.primaryDark,
    primaryDarker: accent.primaryDarker,
    primaryLight: accent.primaryLight,
    primarySoft: accent.primarySoft
  };
}

function resolveLightAccentPalette(accentKey: DarkAccentKey): AccentPalette {
  return lightAccentPalettes[accentKey] ?? createLightAccentPalette(accentKey);
}

function resolveDarkAccentPalette(accentKey: DarkAccentKey): AccentPalette {
  return darkAccentPalettes[accentKey] ?? createDarkAccentPalette(accentKey);
}

function createLightAccentPalette(accentValue: string): AccentPalette {
  const color = normalizeAccentValue(accentValue) ?? defaultDarkAccent;
  const rgb = hexToRgb(color);
  const primary = !rgb ? lightAccentPalettes.violet?.primary ?? '#6D28D9' :
    getRelativeLuminance(rgb) > 0.32 ? mixHex(color, '#1C252E', 0.48) : color;

  return {
    primary,
    primaryDark: mixHex(primary, '#111827', 0.22),
    primaryDarker: mixHex(primary, '#111827', 0.55),
    primaryLight: mixHex(primary, '#FFFFFF', 0.24),
    primarySoft: toRgba(primary, 0.14)
  };
}

function createDarkAccentPalette(accentValue: string): AccentPalette {
  const color = normalizeAccentValue(accentValue) ?? defaultDarkAccent;
  const rgb = hexToRgb(color);
  const primary = !rgb ? darkAccentPalettes.violet?.primary ?? '#B56CFF' :
    getRelativeLuminance(rgb) < 0.4 ? mixHex(color, '#FFFFFF', 0.34) : color;

  return {
    primary,
    primaryDark: mixHex(primary, '#FFFFFF', 0.34),
    primaryDarker: mixHex(primary, '#FFFFFF', 0.58),
    primaryLight: mixHex(primary, '#FFFFFF', 0.18),
    primarySoft: toRgba(primary, 0.17)
  };
}

function mixLightBottom(accent: string): string {
  const rgb = hexToRgb(accent);

  if (!rgb) {
    return lightPalette.backgroundBottom;
  }

  return `rgba(${rgb.red}, ${rgb.green}, ${rgb.blue}, 0.04)`;
}

function mixDarkBottom(accent: string): string {
  const base = hexToRgb(darkPaletteBase.backgroundBottom);
  const rgb = hexToRgb(accent);

  if (!base || !rgb) {
    return darkPaletteBase.backgroundBottom;
  }

  return rgbToHex({
    blue: Math.round(base.blue * 0.9 + rgb.blue * 0.1),
    green: Math.round(base.green * 0.9 + rgb.green * 0.1),
    red: Math.round(base.red * 0.9 + rgb.red * 0.1)
  });
}

function normalizeAccentValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const legacyValue = legacyAccentValues[trimmed.toLowerCase()];

  if (legacyValue) {
    return legacyValue;
  }

  const normalizedHex = trimmed.startsWith('#') ? trimmed.toUpperCase() : `#${trimmed.toUpperCase()}`;

  return hexToRgb(normalizedHex) ? normalizedHex : null;
}

function mixHex(left: string, right: string, amount: number): string {
  const leftRgb = hexToRgb(left);
  const rightRgb = hexToRgb(right);

  if (!leftRgb || !rightRgb) {
    return left;
  }

  return rgbToHex({
    blue: Math.round(leftRgb.blue * (1 - amount) + rightRgb.blue * amount),
    green: Math.round(leftRgb.green * (1 - amount) + rightRgb.green * amount),
    red: Math.round(leftRgb.red * (1 - amount) + rightRgb.red * amount)
  });
}

function toRgba(value: string, alpha: number): string {
  const rgb = hexToRgb(value);

  if (!rgb) {
    return value;
  }

  return `rgba(${rgb.red}, ${rgb.green}, ${rgb.blue}, ${alpha})`;
}

function getRelativeLuminance(value: { blue: number; green: number; red: number }): number {
  const channel = (part: number) => {
    const normalized = part / 255;

    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  return channel(value.red) * 0.2126 + channel(value.green) * 0.7152 + channel(value.blue) * 0.0722;
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

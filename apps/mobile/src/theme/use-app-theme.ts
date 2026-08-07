import {
  createContext,
  createElement,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance, StyleSheet, type ColorSchemeName } from "react-native";
import {
  loadStoredJson,
  saveStoredJson,
} from "../session/secure-session-store";
import { colors, radii, shadows, spacing } from "./tokens";

type Palette = { [Key in keyof typeof colors]: string } & {
  backdrop: string;
  backgroundBottom: string;
  backgroundTop: string;
  cardMuted: string;
  field: string;
  inverseText: string;
  isDark: boolean;
  line: string;
  modalSurface: string;
  overlay: string;
  softBlue: string;
  softGreen: string;
  softOrange: string;
  softPurple: string;
};

export type DarkAccentKey = string;
export type ThemeMode = "system" | "light" | "dark";

type AccentPalette = {
  primary: string;
  primaryDark: string;
  primaryDarker: string;
  primaryLight: string;
  primarySoft: string;
};

type StoredThemePreferences = {
  fontScale?: number;
  themeMode?: ThemeMode;
};

type ThemePreferencesContextValue = {
  fontScale: number;
  systemScheme: ColorSchemeName;
  themeMode: ThemeMode;
  setFontScale: (scale: number) => void;
  setThemeMode: (mode: ThemeMode) => void;
};

const themePreferencesKey = "homeapp.theme-preferences.v1";
const homeAccent: DarkAccentKey = "#4F8D2C";
const darkAccent: DarkAccentKey = "#7C9FF2";
const defaultFontScale = 1;
const defaultThemeMode: ThemeMode = "system";
const fontScaleMin = 0.9;
const fontScaleMax = 1.3;
const darkCard = "#181F28";
const darkCardMuted = "#222B36";
const darkField = "#111821";
const darkModalSurface = "#141B24";
const darkOverlay = "#181F28";

const darkShadows = {
  card: {
    elevation: 2,
    shadowColor: "#000000",
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  control: {
    elevation: 1,
    shadowColor: "#000000",
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
  },
} as const;

type StyleSheetCreate = typeof StyleSheet.create;

const baseStyleSheetCreate = StyleSheet.create.bind(
  StyleSheet,
) as StyleSheetCreate;
let runtimeFontScale = defaultFontScale;
let fontScaleStyleSheetInstalled = false;

installFontScaleStyleSheet();

const ThemePreferencesContext = createContext<ThemePreferencesContextValue>({
  fontScale: defaultFontScale,
  systemScheme: Appearance.getColorScheme(),
  themeMode: defaultThemeMode,
  setFontScale: () => undefined,
  setThemeMode: () => undefined,
});

const lightPalette: Palette = {
  ...colors,
  background: "#F6F7F8",
  backgroundBottom: "#EFF2F4",
  backgroundTop: "#FAFBFC",
  backdrop: "rgba(28, 37, 46, 0.42)",
  card: "#FFFFFF",
  cardMuted: "#F1F3F5",
  field: "#FFFFFF",
  inverseText: "#FFFFFF",
  isDark: false,
  line: "#E3E7EB",
  modalSurface: "#F4F6F8",
  overlay: "#FFFFFF",
  softBlue: "#EAF2FF",
  softGreen: "#E9FCD4",
  softOrange: "#FFF4DE",
  shopping: "#4F8D2C",
  shoppingSoft: "#EEF7E8",
  softPurple: "#EEF7E8",
  text: "#17212B",
  textMuted: "#5E6A77",
  textSubtle: "#7D8996",
};

const darkPaletteBase: typeof lightPalette = {
  ...colors,
  background: "#090D12",
  backgroundBottom: "#080C11",
  backgroundTop: "#111720",
  backdrop: "rgba(2, 5, 9, 0.74)",
  border: "#3A4552",
  calendar: "#76B9E6",
  card: darkCard,
  cardMuted: darkCardMuted,
  danger: "#F08E96",
  dangerSoft: solidDarkSoft("#F08E96"),
  field: darkField,
  finance: "#67C89B",
  food: "#E6B762",
  info: "#7C9FF2",
  infoSoft: solidDarkSoft("#7C9FF2"),
  inverseText: "#09101F",
  isDark: true,
  line: "#303A46",
  modalSurface: darkModalSurface,
  overlay: darkOverlay,
  primary: "#7C9FF2",
  primaryDark: "#9BB6F6",
  primaryDarker: "#C0D0FA",
  primaryLight: "#89A8F3",
  primarySoft: solidDarkSoft("#7C9FF2"),
  shopping: "#7C9FF2",
  shoppingSoft: solidDarkSoft("#7C9FF2"),
  softBlue: solidDarkSoft("#76B9E6"),
  softGreen: solidDarkSoft("#67C89B"),
  softOrange: solidDarkSoft("#E6B762"),
  softPurple: solidDarkSoft("#A99DE0"),
  successSoft: solidDarkSoft("#67C89B"),
  surface: darkCard,
  surfaceMuted: darkCardMuted,
  text: "#F4F6F8",
  textMuted: "#C4CBD4",
  textSubtle: "#9DA7B4",
  warning: "#E5BA64",
  warningSoft: solidDarkSoft("#E5BA64"),
};

export type AppPalette = typeof lightPalette;

export function AppThemeProvider({ children }: PropsWithChildren) {
  const [fontScale, setFontScaleState] = useState(defaultFontScale);
  const [themeMode, setThemeModeState] = useState<ThemeMode>(defaultThemeMode);
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(() =>
    Appearance.getColorScheme(),
  );

  useEffect(() => {
    loadStoredJson<StoredThemePreferences>(themePreferencesKey)
      .then((stored) => {
        if (stored?.fontScale) {
          const normalizedFontScale = normalizeFontScale(stored.fontScale);

          runtimeFontScale = normalizedFontScale;
          setFontScaleState(normalizedFontScale);
        }

        if (stored?.themeMode) {
          setThemeModeState(normalizeThemeMode(stored.themeMode));
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
      fontScale,
      systemScheme,
      themeMode,
      setFontScale: (scale) => {
        const normalizedFontScale = normalizeFontScale(scale);

        runtimeFontScale = normalizedFontScale;
        setFontScaleState(normalizedFontScale);
        saveStoredJson<StoredThemePreferences>(themePreferencesKey, {
          fontScale: normalizedFontScale,
          themeMode,
        }).catch(() => undefined);
      },
      setThemeMode: (mode) => {
        const normalizedThemeMode = normalizeThemeMode(mode);

        setThemeModeState(normalizedThemeMode);
        saveStoredJson<StoredThemePreferences>(themePreferencesKey, {
          fontScale,
          themeMode: normalizedThemeMode,
        }).catch(() => undefined);
      },
    }),
    [fontScale, systemScheme, themeMode],
  );

  return createElement(ThemePreferencesContext.Provider, { value }, children);
}

export function useThemePreferences() {
  return useContext(ThemePreferencesContext);
}

export function useAppTheme() {
  const { fontScale, systemScheme, themeMode } = useThemePreferences();
  const effectiveScheme = themeMode === "system" ? systemScheme : themeMode;
  const isDark = effectiveScheme === "dark";
  const palette = useMemo(
    () => getAppPalette(isDark ? "dark" : "light"),
    [isDark],
  );

  return {
    colors: palette,
    effectiveScheme,
    fontScale,
    isDark,
    radii,
    shadows: isDark ? darkShadows : shadows,
    spacing,
    themeMode,
  };
}

export function normalizeFontScale(value: number): number {
  if (!Number.isFinite(value)) {
    return defaultFontScale;
  }

  return Math.min(
    fontScaleMax,
    Math.max(fontScaleMin, Math.round(value * 20) / 20),
  );
}

export function getAppPalette(scheme: "dark" | "light"): AppPalette {
  return scheme === "dark" ? buildDarkPalette() : buildLightPalette();
}

function normalizeThemeMode(value: string | null | undefined): ThemeMode {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : defaultThemeMode;
}

function installFontScaleStyleSheet() {
  if (fontScaleStyleSheetInstalled) {
    return;
  }

  fontScaleStyleSheetInstalled = true;
  const createStyleSheet = baseStyleSheetCreate as unknown as (
    styles: unknown,
  ) => unknown;

  (StyleSheet as unknown as { create: StyleSheetCreate }).create = ((
    styles: Parameters<StyleSheetCreate>[0],
  ) => createStyleSheet(scaleStyleSheetFonts(styles))) as StyleSheetCreate;
}

function scaleStyleSheetFonts<T>(styles: T): T {
  if (
    runtimeFontScale === defaultFontScale ||
    !styles ||
    typeof styles !== "object"
  ) {
    return styles;
  }

  if (Array.isArray(styles)) {
    return styles.map((style) => scaleStyleSheetFonts(style)) as T;
  }

  const scaled: Record<string, unknown> = {};

  Object.entries(styles as Record<string, unknown>).forEach(([key, value]) => {
    if (
      (key === "fontSize" || key === "lineHeight") &&
      typeof value === "number"
    ) {
      scaled[key] = Math.round(value * runtimeFontScale * 10) / 10;
      return;
    }

    scaled[key] =
      value && typeof value === "object" ? scaleStyleSheetFonts(value) : value;
  });

  return scaled as T;
}

function buildLightPalette(): typeof lightPalette {
  const accent = createLightAccentPalette(homeAccent);

  return {
    ...lightPalette,
    backgroundBottom: mixLightBottom(accent.primary),
    info: accent.primary,
    infoSoft: accent.primarySoft,
    primary: accent.primary,
    primaryDark: accent.primaryDark,
    primaryDarker: accent.primaryDarker,
    primaryLight: accent.primaryLight,
    primarySoft: accent.primarySoft,
  };
}

function buildDarkPalette(): typeof lightPalette {
  const accent = createDarkAccentPalette(darkAccent);

  return {
    ...darkPaletteBase,
    backgroundBottom: mixDarkBottom(accent.primary),
    info: accent.primary,
    infoSoft: accent.primarySoft,
    primary: accent.primary,
    primaryDark: accent.primaryDark,
    primaryDarker: accent.primaryDarker,
    primaryLight: accent.primaryLight,
    primarySoft: accent.primarySoft,
  };
}

function createLightAccentPalette(accentValue: string): AccentPalette {
  const color = normalizeAccentValue(accentValue) ?? homeAccent;
  const rgb = hexToRgb(color);
  const primary = !rgb
    ? "#6D28D9"
    : getRelativeLuminance(rgb) > 0.32
      ? mixHex(color, "#1C252E", 0.48)
      : color;

  return {
    primary,
    primaryDark: mixHex(primary, "#111827", 0.22),
    primaryDarker: mixHex(primary, "#111827", 0.55),
    primaryLight: mixHex(primary, "#FFFFFF", 0.24),
    primarySoft: toRgba(primary, 0.14),
  };
}

function createDarkAccentPalette(accentValue: string): AccentPalette {
  const color = normalizeAccentValue(accentValue) ?? homeAccent;
  const rgb = hexToRgb(color);
  const primary = !rgb
    ? "#7C9FF2"
    : getRelativeLuminance(rgb) < 0.36
      ? mixHex(color, "#FFFFFF", 0.28)
      : color;

  return {
    primary,
    primaryDark: mixHex(primary, "#FFFFFF", 0.18),
    primaryDarker: mixHex(primary, "#FFFFFF", 0.38),
    primaryLight: mixHex(primary, "#FFFFFF", 0.08),
    primarySoft: solidDarkSoft(primary),
  };
}

function solidDarkSoft(color: string): string {
  return mixHex(color, darkCard, 0.82);
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
    blue: Math.round(base.blue * 0.97 + rgb.blue * 0.03),
    green: Math.round(base.green * 0.97 + rgb.green * 0.03),
    red: Math.round(base.red * 0.97 + rgb.red * 0.03),
  });
}

function normalizeAccentValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const normalizedHex = trimmed.startsWith("#")
    ? trimmed.toUpperCase()
    : `#${trimmed.toUpperCase()}`;

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
    red: Math.round(leftRgb.red * (1 - amount) + rightRgb.red * amount),
  });
}

function toRgba(value: string, alpha: number): string {
  const rgb = hexToRgb(value);

  if (!rgb) {
    return value;
  }

  return `rgba(${rgb.red}, ${rgb.green}, ${rgb.blue}, ${alpha})`;
}

function getRelativeLuminance(value: {
  blue: number;
  green: number;
  red: number;
}): number {
  const channel = (part: number) => {
    const normalized = part / 255;

    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  return (
    channel(value.red) * 0.2126 +
    channel(value.green) * 0.7152 +
    channel(value.blue) * 0.0722
  );
}

function rgbToHex(value: { blue: number; green: number; red: number }): string {
  const toHex = (part: number) =>
    Math.max(0, Math.min(255, part))
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();

  return `#${toHex(value.red)}${toHex(value.green)}${toHex(value.blue)}`;
}

function hexToRgb(
  value: string,
): { blue: number; green: number; red: number } | null {
  if (!value.startsWith("#") || value.length !== 7) {
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

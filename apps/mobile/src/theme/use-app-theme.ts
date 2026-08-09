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
const homeAccent: DarkAccentKey = "#2E5CB8";
const darkAccent: DarkAccentKey = "#8CAEFF";
const defaultFontScale = 1;
const defaultThemeMode: ThemeMode = "system";
const fontScaleMin = 0.9;
const fontScaleMax = 1.3;
const darkCard = "#151C25";
const darkCardMuted = "#202A35";
const darkField = "#0D141D";
const darkModalSurface = "#111923";
const darkOverlay = "#151C25";

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
  background: "#F7F8FA",
  backgroundBottom: "#F0F3F6",
  backgroundTop: "#FAFBFC",
  backdrop: "rgba(28, 37, 46, 0.42)",
  card: "#FFFFFF",
  cardMuted: "#EEF1F4",
  field: "#FFFFFF",
  inverseText: "#FFFFFF",
  isDark: false,
  line: "#7F8994",
  modalSurface: "#F4F6F8",
  overlay: "#FFFFFF",
  softBlue: "#E7EEFC",
  softGreen: "#E4F4EB",
  softOrange: "#FFF1D6",
  shopping: "#3B6D23",
  shoppingSoft: "#E7F0E2",
  softPurple: "#EEEAF8",
  text: "#18212B",
  textMuted: "#45515E",
  textSubtle: "#5B6672",
};

const darkPaletteBase: typeof lightPalette = {
  ...colors,
  background: "#080C12",
  backgroundBottom: "#070B11",
  backgroundTop: "#101721",
  backdrop: "rgba(2, 5, 9, 0.74)",
  border: "#768394",
  calendar: "#82C7F2",
  card: darkCard,
  cardMuted: darkCardMuted,
  danger: "#FF9AA2",
  dangerSoft: solidDarkSoft("#FF9AA2"),
  field: darkField,
  finance: "#72D6A7",
  food: "#F1C36C",
  info: "#8CAEFF",
  infoSoft: solidDarkSoft("#8CAEFF"),
  inverseText: "#07101F",
  isDark: true,
  line: "#667382",
  modalSurface: darkModalSurface,
  overlay: darkOverlay,
  primary: "#8CAEFF",
  primaryDark: "#AAC2FF",
  primaryDarker: "#CAD7FF",
  primaryLight: "#99B6FF",
  primarySoft: solidDarkSoft("#8CAEFF"),
  shopping: "#8CAEFF",
  shoppingSoft: solidDarkSoft("#8CAEFF"),
  softBlue: solidDarkSoft("#82C7F2"),
  softGreen: solidDarkSoft("#72D6A7"),
  softOrange: solidDarkSoft("#F1C36C"),
  softPurple: solidDarkSoft("#B7A9F2"),
  successSoft: solidDarkSoft("#72D6A7"),
  surface: darkCard,
  surfaceMuted: darkCardMuted,
  text: "#F5F7FA",
  textMuted: "#D0D6DE",
  textSubtle: "#AEB7C2",
  warning: "#F1C36C",
  warningSoft: solidDarkSoft("#F1C36C"),
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
  if (!styles || typeof styles !== "object") {
    return styles;
  }

  if (Array.isArray(styles)) {
    return styles.map((style) => scaleStyleSheetFonts(style)) as T;
  }

  const scaled: Record<string, unknown> = {};

  Object.entries(styles as Record<string, unknown>).forEach(([key, value]) => {
    if (key === "fontSize" && typeof value === "number") {
      scaled[key] = scaleTypographyMetric(improveBaseFontSize(value));
      return;
    }

    if (key === "lineHeight" && typeof value === "number") {
      scaled[key] = scaleTypographyMetric(improveBaseLineHeight(value));
      return;
    }

    if (key === "fontWeight" && typeof value === "string") {
      scaled[key] = normalizeFontWeight(value);
      return;
    }

    scaled[key] =
      value && typeof value === "object" ? scaleStyleSheetFonts(value) : value;
  });

  return scaled as T;
}

function improveBaseFontSize(value: number): number {
  if (value <= 11) {
    return value + 2;
  }

  if (value <= 17) {
    return value + 1;
  }

  return value;
}

function improveBaseLineHeight(value: number): number {
  if (value <= 18) {
    return value + 2;
  }

  if (value <= 24) {
    return value + 1;
  }

  return value;
}

function normalizeFontWeight(value: string): string {
  if (value === "900") {
    return "800";
  }

  if (value === "800") {
    return "700";
  }

  return value;
}

function scaleTypographyMetric(value: number): number {
  return Math.round(value * runtimeFontScale * 10) / 10;
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
    primaryLight: mixHex(primary, "#FFFFFF", 0.12),
    primarySoft: mixHex(primary, "#FFFFFF", 0.88),
  };
}

function createDarkAccentPalette(accentValue: string): AccentPalette {
  const color = normalizeAccentValue(accentValue) ?? homeAccent;
  const rgb = hexToRgb(color);
  const primary = !rgb
    ? "#8CAEFF"
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

jest.mock("react-native", () => ({
  Appearance: {
    addChangeListener: () => ({ remove: () => undefined }),
    getColorScheme: () => "light",
  },
  StyleSheet: {
    create: <T>(styles: T) => styles,
  },
}));

jest.mock("../session/secure-session-store", () => ({
  loadStoredJson: async () => null,
  saveStoredJson: async () => undefined,
}));

import { StyleSheet } from "react-native";
import { getAppPalette } from "./use-app-theme";

describe("application color palettes", () => {
  it.each(["light", "dark"] as const)(
    "meets WCAG 2.1 AA text contrast in %s mode",
    (scheme) => {
      const colors = getAppPalette(scheme);
      const surfaces = [
        colors.background,
        colors.backgroundTop,
        colors.card,
        colors.cardMuted,
        colors.field,
        colors.modalSurface,
        colors.overlay,
        colors.surface,
        colors.surfaceMuted,
      ];
      const textColors = [
        colors.text,
        colors.textMuted,
        colors.textSubtle,
        colors.primary,
        colors.primaryDark,
        colors.primaryDarker,
        colors.calendar,
        colors.finance,
        colors.food,
        colors.shopping,
        colors.danger,
        colors.warning,
      ];

      surfaces.forEach((surface) => {
        textColors.forEach((textColor) => {
          expect(contrastRatio(textColor, surface)).toBeGreaterThanOrEqual(4.5);
        });
      });
    },
  );

  it.each(["light", "dark"] as const)(
    "meets WCAG 2.1 non-text contrast for controls in %s mode",
    (scheme) => {
      const colors = getAppPalette(scheme);
      const controlSurfaces = [
        colors.background,
        colors.card,
        colors.cardMuted,
        colors.field,
        colors.modalSurface,
        colors.overlay,
        colors.surface,
        colors.surfaceMuted,
      ];

      controlSurfaces.forEach((surface) => {
        expect(contrastRatio(colors.border, surface)).toBeGreaterThanOrEqual(3);
        expect(contrastRatio(colors.line, surface)).toBeGreaterThanOrEqual(3);
        expect(contrastRatio(colors.primaryLight, surface)).toBeGreaterThanOrEqual(3);
      });
    },
  );

  it.each(["light", "dark"] as const)(
    "keeps filled actions and semantic soft surfaces readable in %s mode",
    (scheme) => {
      const colors = getAppPalette(scheme);
      const filledActions = [
        colors.primary,
        colors.primaryDark,
        colors.finance,
        colors.food,
        colors.shopping,
        colors.danger,
        colors.warning,
      ];
      const semanticPairs = [
        [colors.primary, colors.primarySoft],
        [colors.calendar, colors.softBlue],
        [colors.finance, colors.successSoft],
        [colors.food, colors.softOrange],
        [colors.shopping, colors.shoppingSoft],
        [colors.danger, colors.dangerSoft],
        [colors.warning, colors.warningSoft],
      ] as const;

      filledActions.forEach((background) => {
        expect(contrastRatio(colors.inverseText, background)).toBeGreaterThanOrEqual(4.5);
      });
      semanticPairs.forEach(([foreground, background]) => {
        expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
      });
    },
  );

  it("avoids pure white for dark-mode body text", () => {
    const colors = getAppPalette("dark");

    expect(colors.isDark).toBe(true);
    expect(colors.text).not.toBe("#FFFFFF");
  });

  it("improves small text and softens excessive font weights globally", () => {
    const styles = StyleSheet.create({
      body: { fontSize: 14, fontWeight: "800", lineHeight: 20 },
      compact: { fontSize: 9, fontWeight: "900", lineHeight: 12 },
      title: { fontSize: 24, fontWeight: "700", lineHeight: 30 },
    });

    expect(styles.compact).toEqual({
      fontSize: 11,
      fontWeight: "800",
      lineHeight: 14,
    });
    expect(styles.body).toEqual({
      fontSize: 15,
      fontWeight: "700",
      lineHeight: 21,
    });
    expect(styles.title).toEqual({
      fontSize: 24,
      fontWeight: "700",
      lineHeight: 30,
    });
  });
});

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(value: string): number {
  const channels = [1, 3, 5].map((index) =>
    Number.parseInt(value.slice(index, index + 2), 16) / 255,
  );
  const [red = 0, green = 0, blue = 0] = channels.map((channel) =>
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4,
  );

  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

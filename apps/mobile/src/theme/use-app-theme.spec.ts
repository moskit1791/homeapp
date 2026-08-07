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

import { getAppPalette } from "./use-app-theme";

describe("application color palettes", () => {
  it("keeps dark mode readable without pure-white body text", () => {
    const colors = getAppPalette("dark");

    expect(colors.isDark).toBe(true);
    expect(colors.text).not.toBe("#FFFFFF");
    expect(contrastRatio(colors.text, colors.background)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(colors.text, colors.card)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(colors.textMuted, colors.card)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.textSubtle, colors.card)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.inverseText, colors.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.danger, colors.card)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.warning, colors.card)).toBeGreaterThanOrEqual(4.5);
  });

  it("separates dark surfaces without bright borders", () => {
    const colors = getAppPalette("dark");

    expect(contrastRatio(colors.card, colors.background)).toBeGreaterThan(1.08);
    expect(contrastRatio(colors.border, colors.card)).toBeGreaterThan(1.3);
    expect(contrastRatio(colors.border, colors.card)).toBeLessThan(2.5);
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

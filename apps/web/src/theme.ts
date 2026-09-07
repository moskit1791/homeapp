import { alpha, createTheme } from "@mui/material/styles";

export function createAppTheme(mode: "light" | "dark") {
  const dark = mode === "dark";

  return createTheme({
    palette: {
      mode,
      primary: { main: "#00A76F", dark: "#007867", light: "#5BE49B" },
      secondary: { main: "#8E33FF" },
      info: { main: "#00B8D9" },
      warning: { main: "#FFAB00" },
      error: { main: "#FF5630" },
      background: {
        default: dark ? "#141A21" : "#F4F6F8",
        paper: dark ? "#1C252E" : "#FFFFFF",
      },
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: '"Public Sans Variable", "Public Sans", Arial, sans-serif',
      h1: { fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.03em" },
      h2: { fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.02em" },
      h3: { fontSize: "1.125rem", fontWeight: 700 },
      button: { fontWeight: 700, textTransform: "none" },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { borderRadius: 8, minHeight: 40 } },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            boxShadow: dark
              ? "0 0 2px 0 rgba(0,0,0,.24), 0 16px 32px -4px rgba(0,0,0,.24)"
              : "0 0 2px 0 rgba(145,158,171,.2), 0 12px 24px -4px rgba(145,158,171,.12)",
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: alpha(
              dark ? "#919EAB" : "#FFFFFF",
              dark ? 0.08 : 0.72,
            ),
          },
        },
      },
    },
  });
}

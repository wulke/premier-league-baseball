// MUI option — the theme is a JS object via createTheme, applied by ThemeProvider.
// Token swap = rebuild the theme with a new palette.primary.main (the club color).
// This is MUI's native theming primitive; the whole component library follows.
import { createTheme } from "@mui/material/styles";

export const makeTheme = (accent: string) =>
  createTheme({
    palette: {
      mode: "dark",
      primary: { main: accent },
      background: { default: "#15171C", paper: "#1F2229" },
      text: { primary: "#E8EAED", secondary: "#A0A6B0" },
      divider: "#2C313A",
    },
    shape: { borderRadius: 8 },
    typography: {
      fontFamily:
        'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    },
    components: {
      MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
      MuiDataGrid: {
        styleOverrides: {
          root: { border: "none", "--DataGrid-rowBorderColor": "#2C313A" },
        },
      },
    },
  });

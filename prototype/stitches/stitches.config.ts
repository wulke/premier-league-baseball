// Stitches option — your chosen stack. Tokens live in createStitches(); the
// token swap uses createTheme() which returns a className to apply to a wrapper
// (the idiomatic Stitches theming mechanism).
import { createStitches } from "@stitches/react";

export const {
  styled,
  css,
  theme,
  createTheme,
  globalCss,
  keyframes,
} = createStitches({
  theme: {
    colors: {
      bg: "#15171C",
      surface: "#1F2229",
      raised: "#272B34",
      hover: "#2E333D",
      borderSubtle: "#2C313A",
      borderStrong: "#3A4150",
      inkPrimary: "#E8EAED",
      inkSecondary: "#A0A6B0",
      inkMuted: "#6B7280",
      accent: "#4F8DF7", // swapped per club via createTheme()
      accentOn: "#FFFFFF",
    },
    radii: { sm: "6px", md: "10px", lg: "14px" },
    space: { 1: "4px", 2: "8px", 3: "12px", 4: "16px" },
    fontSizes: { xs: "11px", sm: "12px", md: "14px", lg: "16px", xl: "24px" },
  },
});

export const globalStyles = globalCss({
  "html, body": {
    background: "$bg",
    color: "$inkPrimary",
    margin: 0,
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
});

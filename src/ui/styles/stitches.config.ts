import { createStitches } from '@stitches/react';

const { styled, css, globalCss, keyframes, getCssText, theme, createTheme, config } = createStitches({
  theme: {
    colors: {
      text: '#222',
      textMuted: '#555',
      textFaint: '#888',
      textSubtle: '#666',
      borderDefault: '#ccc',
      borderLight: '#eee',
      borderMedium: '#ddd',
      borderSubtle: '#e0e0e0',
      black: '#000',
      white: '#fff',
      danger: '#c00',
      dangerStrong: '#b00020',
      dangerBorder: '#8b0000',
      neutralDark: '#333',
      neutralMid: '#aaa',
      surfaceSubtle: '#fafafa',
      surfaceMuted: '#f8f8f8',
      dangerSurface: '#fdecec',
      dangerBorderSoft: '#f0b4b4',
      devSurface: '#fff8e1',
      devBorder: '#b8860b',
      devText: '#7a4d00',
    },
    space: {
      xs: '4px',
      sm: '8px',
      md: '12px',
      lg: '16px',
      xl: '24px',
      xxl: '32px',
      page: '48px',
    },
    radii: {
      sm: '3px',
      md: '4px',
      lg: '6px',
      pill: '999px',
    },
    fontSizes: {
      xs: '0.7rem',
      sm: '0.8rem',
      base: '0.85rem',
      md: '0.9rem',
      lg: '1rem',
      xl: '1.2rem',
      xxl: '1.6rem',
    },
    letterSpacings: {
      wide: '0.04em',
      wider: '0.07em',
    },
    shadows: {
      modal: '0 18px 40px rgba(0, 0, 0, 0.18)',
    },
  },
});

export { styled, css, globalCss, keyframes, getCssText, theme, createTheme, config };

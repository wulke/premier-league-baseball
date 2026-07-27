const path = require("path");
module.exports = {
  content: [
    path.join(__dirname, "**/*.{html,tsx,ts}"),
    path.join(__dirname, "../../shared/**/*.ts"),
  ],
  theme: {
    extend: {
      colors: {
        // dark inversion of the savant palette. Same token *names* so the
        // shared component code is unchanged — only the values flip.
        panel: { 0: "#13151B", 1: "#181B22", 2: "#1E222B", hover: "#242932", zebra: "#161920" },
        rule: { soft: "#2A2F3A", hard: "#3A4150" },
        ink: { hi: "#E8EAED", md: "#A0A6B0", lo: "#6B7280" },
        mlb: { navy: "#0A2A6B", blue: "#5B9BFF", link: "#5B9BFF", red: "#FF6B6B" },
        club: "var(--club)",
      },
      fontFamily: {
        sans: ['"Inter"', "system-ui", "sans-serif"],
        num: ['"Barlow Semi Condensed"', '"Inter"', "sans-serif"],
      },
    },
  },
  plugins: [],
};

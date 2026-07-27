const path = require("path");
module.exports = {
  content: [
    path.join(__dirname, "**/*.{html,tsx,ts}"),
    path.join(__dirname, "../../shared/**/*.ts"),
  ],
  theme: {
    extend: {
      colors: {
        panel: { 0: "#FFFFFF", 1: "#F5F7F9", 2: "#EEF1F4", hover: "#F0F4F8", zebra: "#FAFBFC" },
        rule: { soft: "#E2E6EB", hard: "#C9D0D8" },
        ink: { hi: "#14213D", md: "#46506B", lo: "#7A8499" },
        mlb: { navy: "#002D72", blue: "#0469A5", link: "#0469A5", red: "#C8102E" },
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

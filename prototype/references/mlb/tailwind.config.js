const path = require("path");
module.exports = {
  content: [
    path.join(__dirname, "**/*.{html,tsx,ts}"),
    path.join(__dirname, "../../shared/**/*.ts"),
  ],
  theme: {
    extend: {
      colors: {
        field: { 0: "#0B0B0D", 1: "#141418", 2: "#1C1C22", hover: "#22222A" },
        line: { soft: "#26262E", hard: "#3A3A46" },
        ink: { hi: "#F0F0F2", md: "#9A9AA2", lo: "#5C5C66" },
        club: "var(--club)",
      },
      fontFamily: { condensed: ['"Roboto Condensed"', '"Arial Narrow"', "sans-serif"] },
    },
  },
  plugins: [],
};

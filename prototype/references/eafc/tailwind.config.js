const path = require("path");
module.exports = {
  content: [
    path.join(__dirname, "**/*.{html,tsx,ts}"),
    path.join(__dirname, "../../shared/**/*.ts"),
  ],
  theme: {
    extend: {
      colors: {
        void: { 0: "#07070A", 1: "#0F0F15", 2: "#16161E", hover: "#1E1E28" },
        line: { soft: "#26262E", hard: "#3A3A46" },
        ink: { hi: "#FFFFFF", md: "#A0A4B0", lo: "#6B6F7D" },
        electric: "#00E5FF", gold: "#FFC857",
        club: "var(--club)",
      },
      fontFamily: {
        display: ['"Archivo Black"', "system-ui", "sans-serif"],
        condensed: ['"Oswald"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

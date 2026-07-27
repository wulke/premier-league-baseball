const path = require("path");
module.exports = {
  content: [
    path.join(__dirname, "**/*.{html,tsx,ts}"),
    path.join(__dirname, "../../shared/**/*.ts"),
  ],
  theme: {
    extend: {
      colors: {
        pitch: { 0: "#171A24", 1: "#232636", 2: "#2C3042", hover: "#333849" },
        line: { soft: "#333849", hard: "#454B61" },
        ink: { hi: "#F4F5F8", md: "#B7BCC8", lo: "#7A8090" },
        plum: "#53108F", plumSoft: "#7C3AED",
        good: "#00FF87", goodDeep: "#16C172",
        bad: "#FF5A5F", warn: "#FFB23F",
        club: "var(--club)",
      },
      borderRadius: { pill: "999px" },
    },
  },
  plugins: [],
};

const path = require("path");
module.exports = {
  // Resolve content from the config file's location so it doesn't depend on
  // Parcel's cwd (which doesn't auto-discover this file).
  content: [
    path.join(__dirname, "**/*.{html,tsx,ts}"),
    path.join(__dirname, "../shared/**/*.ts"),
  ],
  theme: {
    extend: {
      colors: {
        app: { bg: "#15171C", surface: "#1F2229", raised: "#272B34", hover: "#2E333D" },
        edge: { subtle: "#2C313A", strong: "#3A4150" },
        ink: { primary: "#E8EAED", secondary: "#A0A6B0", muted: "#6B7280" },
        accent: "var(--accent)",
        "accent-on": "var(--accent-on)",
      },
      borderRadius: { sm: "6px", md: "10px", lg: "14px" },
    },
  },
  plugins: [],
};

// Parcel doesn't auto-discover tailwind.config.js from this dir, so point the
// plugin at it explicitly. (autoprefixer omitted — Parcel prefixes by default.)
module.exports = {
  plugins: {
    tailwindcss: { config: require("./tailwind.config.js") },
  },
};

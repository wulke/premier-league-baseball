// Shared design tokens — the dark "modern sports app" chrome from wayfinder #8.
// Every option imports THIS so the comparison is about the styling *approach*,
// not about different palettes. Each option then maps these into its native
// token mechanism (tw config / CSS vars / MUI theme / Stitches theme).

export type TeamIdentity = {
  teamId: number;
  name: string;
  short: string;
  primary: string;   // saturated-but-controlled identity color
  onPrimary: string; // text color legible on `primary`
};

export const chrome = {
  bg: { app: "#15171C", surface: "#1F2229", raised: "#272B34", hover: "#2E333D" },
  border: { subtle: "#2C313A", strong: "#3A4150" },
  text: { primary: "#E8EAED", secondary: "#A0A6B0", muted: "#6B7280" },
  accent: "#4F8DF7", // neutral brand accent before any club is selected
  radius: { sm: "6px", md: "10px", lg: "14px" },
} as const;

// Two divisions of five teams, each with an identity color.
export const teams: TeamIdentity[] = [
  // Atlantic
  { teamId: 1, name: "Crimson Hose",    short: "CRM", primary: "#E53935", onPrimary: "#FFFFFF" },
  { teamId: 2, name: "Harbor Blues",    short: "HRB", primary: "#2196F3", onPrimary: "#FFFFFF" },
  { teamId: 3, name: "Emerald City",    short: "EMC", primary: "#2E9E5B", onPrimary: "#FFFFFF" },
  { teamId: 4, name: "Gold Sox",        short: "GLD", primary: "#F5B301", onPrimary: "#1A1D24" },
  { teamId: 5, name: "Midnight Cards",  short: "MID", primary: "#8E44AD", onPrimary: "#FFFFFF" },
  // Coastal
  { teamId: 6, name: "Tidewater Teal",  short: "TDW", primary: "#12B5A5", onPrimary: "#0A1B19" },
  { teamId: 7, name: "Sunset Orange",   short: "SUN", primary: "#F3682B", onPrimary: "#1A1D24" },
  { teamId: 8, name: "Royal Violets",   short: "ROY", primary: "#7C5CFF", onPrimary: "#FFFFFF" },
  { teamId: 9, name: "Steel Grey",      short: "STL", primary: "#8A94A6", onPrimary: "#1A1D24" },
  { teamId: 10, name: "Barn Reds",      short: "BRN", primary: "#C0392B", onPrimary: "#FFFFFF" },
];

export const clubTeamId = 1; // the user's club — the persistent anchor (#8 club-first)

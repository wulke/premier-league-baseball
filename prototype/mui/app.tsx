import * as React from "react";
import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ThemeProvider,
  CssBaseline,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Select,
  MenuItem,
  Stack,
} from "@mui/material";
import { DataGrid, type GridColDef, GridToolbar } from "@mui/x-data-grid";
import { divisions, league, clubTeamId, type TeamStanding } from "../shared/mock-data";
import { teams, type TeamIdentity } from "../shared/tokens";
import { makeTheme } from "./theme";

const identity = (teamId: number): TeamIdentity => teams.find((t) => t.teamId === teamId)!;

const TeamCell = ({ teamId, isClub }: { teamId: number; isClub: boolean }) => {
  const id = identity(teamId);
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Box sx={{ width: 10, height: 10, borderRadius: "50%", background: id.primary }} />
      <Typography sx={{ fontWeight: isClub ? 700 : 600, color: isClub ? "text.primary" : "text.secondary" }} variant="inherit">
        {id.name}
      </Typography>
      {isClub && (
        <Box component="span" sx={{
          bgcolor: "primary.main", color: "primary.contrastText",
          px: 0.5, py: 0.1, borderRadius: 0.5, fontSize: 9, fontWeight: 700, textTransform: "uppercase",
        }}>
          your club
        </Box>
      )}
    </Stack>
  );
};

const FormCell = ({ form }: { form: ("W" | "D" | "L")[] }) => (
  <Stack direction="row" spacing={0.5}>
    {form.map((r, i) => (
      <Box key={i} sx={{
        width: 16, height: 16, borderRadius: 0.5, fontSize: 10, fontWeight: 700,
        display: "flex", alignItems: "center", justifyContent: "center",
        bgcolor: r === "W" ? "rgba(46,158,91,0.2)" : r === "D" ? "divider" : "rgba(229,57,53,0.2)",
        color: r === "W" ? "#6EE7A8" : r === "D" ? "text.secondary" : "#FCA5A5",
      }}>{r}</Box>
    ))}
  </Stack>
);

const columns = (clubId: number): GridColDef[] => [
  { field: "pos", headerName: "#", width: 40, headerAlign: "center", align: "center" },
  {
    field: "team", headerName: "Team", flex: 1, minWidth: 200,
    renderCell: (p) => <TeamCell teamId={p.row.teamId} isClub={p.row.teamId === clubId} />,
    renderHeader: () => <span style={{ textAlign: "left" }}>Team</span>,
  },
  { field: "played", headerName: "P", width: 44, headerAlign: "center", align: "center" },
  { field: "won", headerName: "W", width: 44, headerAlign: "center", align: "center" },
  { field: "drawn", headerName: "D", width: 44, headerAlign: "center", align: "center" },
  { field: "lost", headerName: "L", width: 44, headerAlign: "center", align: "center" },
  { field: "runsFor", headerName: "RF", width: 48, headerAlign: "center", align: "center" },
  { field: "runsAgainst", headerName: "RA", width: 48, headerAlign: "center", align: "center" },
  {
    field: "runDifference", headerName: "RD", width: 52, headerAlign: "center", align: "center",
    valueFormatter: (v: number) => (v > 0 ? `+${v}` : `${v}`),
  },
  { field: "points", headerName: "Pts", width: 52, headerAlign: "center", align: "center", cellClassName: "font-bold" },
  {
    field: "form", headerName: "Form", width: 110, sortable: false,
    renderCell: (p) => <FormCell form={p.row.form} />,
  },
];

const Division = ({ name, rows, clubId }: { name: string; rows: TeamStanding[]; clubId: number }) => {
  const dgRows = rows.map((r, i) => ({ id: r.teamId, pos: i + 1, ...r }));
  return (
    <Accordion disableGutters defaultExpanded sx={{ bgcolor: "background.paper", boxShadow: "none", border: "1px solid", borderColor: "divider", borderRadius: "10px !important", overflow: "hidden" }}>
      <AccordionSummary sx={{ bgcolor: "#272B34" }}>
        <Stack direction="row" spacing={1} alignItems="baseline">
          <Typography fontWeight={700}>{name}</Typography>
          <Typography variant="caption" color="text.disabled">{rows.length} teams</Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        {/* DataGrid ships sorting, the density toggle (compact/standard/comfortable),
            column visibility, filtering and CSV export for free — MUI's whole pitch. */}
        <DataGrid
          rows={dgRows}
          columns={columns(clubId)}
          density="compact"
          slots={{ toolbar: GridToolbar }}
          slotProps={{ toolbar: { showQuickFilter: true } }}
          disableRowSelectionOnClick
          hideFooter
          autoHeight
          sx={{
            "& .font-bold .MuiDataGrid-cellContent": { fontWeight: 700 },
            "& .MuiDataGrid-columnHeaders": { borderBottom: "2px solid", borderColor: "divider" },
          }}
        />
      </AccordionDetails>
    </Accordion>
  );
};

const App = () => {
  const [club, setClub] = useState<number>(clubTeamId);
  const accent = identity(club).primary;
  const theme = useMemo(() => makeTheme(accent), [accent]); // ← the token swap
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box maxWidth={900} mx="auto" px={3} pb={6}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ borderBottom: "2px solid", borderColor: "divider", py: 1.75, mb: 4 }}>
          <Typography variant="body2" color="text.secondary">← Game World</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" color="text.disabled">switch club</Typography>
            <Select size="small" value={club} onChange={(e) => setClub(Number(e.target.value))} sx={{ ".MuiSelect-select": { py: 0.5, px: 1 } }}>
              {teams.map((t) => (
                <MenuItem key={t.teamId} value={t.teamId}>{t.name}</MenuItem>
              ))}
            </Select>
          </Stack>
        </Stack>

        <Box mb={4}>
          <Stack direction="row" spacing={1.5} alignItems="baseline">
            <Typography variant="h5" fontWeight={700}>{league.name}</Typography>
            <Box component="span" sx={{ border: "1px solid", borderColor: "divider", borderRadius: 5, px: 1.25, py: 0.25, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "text.secondary" }}>
              {league.type}
            </Box>
          </Stack>
          <Typography variant="body2" color="text.disabled" mt={0.5}>
            {league.divisionCount} divisions · Season in progress
          </Typography>
        </Box>

        <Stack spacing={1.5}>
          <Typography variant="caption" color="text.disabled" sx={{ textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>Standings</Typography>
          {divisions.map((d) => (
            <Division key={d.divisionId} name={d.divisionName} rows={d.standings} clubId={club} />
          ))}
        </Stack>
      </Box>
    </ThemeProvider>
  );
};

createRoot(document.getElementById("app")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

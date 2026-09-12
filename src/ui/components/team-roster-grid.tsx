import React from 'react';
import { Button } from './ui';
import { TeamCrest } from './team-crest';

// @spec BADGEUI-007
const TeamRosterGrid = ({ teams, onTeamClick }: { teams: any[]; onTeamClick: (teamId: number) => void }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px', padding: '4px 0' }}>
    {teams.map((team) => (
      <Button
        key={team.id}
        intent="secondary"
        aria-label={team.config?.name ?? `Team ${team.id}`}
        onClick={() => onTeamClick(team.id)}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', borderColor: '#e0e0e0', padding: '8px 12px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 500 }}
      >
        {/* @spec BADGEUI-007 */}
        <TeamCrest name={team.config?.name ?? `Team ${team.id}`} badge={team.config?.badge} size={22} testId={`team-grid-badge-${team.id}`} />
        <span style={{ flex: 1 }}>{team.config?.name ?? `Team ${team.id}`}</span>
        <span style={{ color: '#aaa', fontSize: '0.75rem' }}>→</span>
      </Button>
    ))}
  </div>
);

export { TeamRosterGrid };

import React from 'react';
import { NavLink, Outlet, useParams } from 'react-router';

// @spec ROSTUI-006,ROSTUI-007
const TeamHub = () => {
  const { gwId, teamId } = useParams();
  const basePath = `/${gwId}/team/${teamId}`;

  return (
    <>
      <nav
        aria-label="Team sections"
        style={{ maxWidth: '960px', margin: '0 auto', padding: '20px 24px 0', display: 'flex', gap: '18px', borderBottom: '1px solid #e5e5e5' }}
      >
        {(['calendar', 'roster'] as const).map((tab) => (
          <NavLink
            key={tab}
            to={`${basePath}/${tab}`}
            style={({ isActive }) => ({
              color: '#222',
              textDecoration: 'none',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '0 0 10px',
              borderBottom: `2px solid ${isActive ? '#222' : 'transparent'}`,
            })}
          >
            {tab === 'calendar' ? 'Calendar' : 'Roster'}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </>
  );
};

export { TeamHub };

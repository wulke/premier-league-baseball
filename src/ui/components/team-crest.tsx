import React, { useState } from 'react';

// @spec BADGEUI-004 — relocated verbatim from game-world.tsx's teamBadgeText (TODAYUI-007);
// the computation is unchanged so existing initials-text assertions keep passing.
const teamBadgeText = (name: string): string => {
  const initials = name.trim().split(/\s+/).filter(Boolean).map((word) => word[0]).join('');
  return initials || '?';
};

// @spec BADGEUI-001,BADGEUI-002,BADGEUI-003
const TeamCrest = ({
  name,
  badge,
  size = 26,
  testId,
}: {
  name: string;
  badge?: string | null;
  size?: number;
  testId?: string;
}) => {
  const [failed, setFailed] = useState(false);

  // BADGEUI-002 — no badge: render the initials fallback directly, no <img> attempted.
  // BADGEUI-001 — badge present but failed to load: swap to the same fallback on error.
  if (!badge || failed) {
    return (
      <span
        data-testid={testId}
        aria-hidden="true"
        style={{
          display: 'inline-grid',
          placeItems: 'center',
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '4px',
          background: '#edf1eb',
          color: '#344634',
          fontSize: '0.68rem',
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {teamBadgeText(name)}
      </span>
    );
  }

  return (
    <img
      data-testid={testId}
      src={badge}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      style={{ borderRadius: '4px', objectFit: 'contain', flexShrink: 0 }}
      onError={() => setFailed(true)}
    />
  );
};

export { TeamCrest, teamBadgeText };

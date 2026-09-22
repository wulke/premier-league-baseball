// @spec TEAMLINK-001,TEAMLINK-002
import React from 'react';
import { Link } from 'react-router';

const TeamLink = ({
  gwId,
  teamId,
  children,
  testId,
  style,
}: {
  gwId: string | number | undefined;
  teamId: number | null | undefined;
  children: React.ReactNode;
  testId?: string;
  style?: React.CSSProperties;
}) => {
  if (teamId == null || gwId == null) {
    return <span data-testid={testId}>{children}</span>;
  }

  return (
    <Link
      to={`/${gwId}/team/${teamId}`}
      data-testid={testId}
      style={{ color: 'inherit', textDecoration: 'underline', textDecorationColor: '#ccc', textUnderlineOffset: '2px', ...style }}
    >
      {children}
    </Link>
  );
};

export { TeamLink };

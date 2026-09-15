import React from 'react';
import { useNavigate } from 'react-router';
import { Badge, Card, SectionLabel } from './ui';

// Registering a new action-item producer (e.g. "contract expiring in <30 days"):
//   1. In the domain/feature that owns the underlying condition, compute ActionItem[]
//      from its own data (e.g. a future `useExpiringContracts()` hook, or a field
//      already present on `gw`/a fetched resource) — ActionItemsPanel has no opinion
//      on where an item comes from and does no fetching of its own.
//   2. Pass that array into `<ActionItemsPanel items={...} />`'s `items` prop from
//      game-world.tsx. With a single producer, pass its array directly; once a second
//      producer exists, concatenate the producers' arrays before passing (e.g.
//      `items={[...expiringContractItems, ...injuryItems]}`) — a dedicated merge hook
//      is unnecessary abstraction until a second producer actually exists.
//   3. Give each item a producer-namespaced `id` (e.g. `contract-expiring-${playerId}`)
//      so ids from different producers can never collide once concatenated.
export type ActionItemSeverity = 'info' | 'warning' | 'critical';

export interface ActionItem {
  id: string;
  label: string;
  severity: ActionItemSeverity;
  href?: string;
  ctaLabel?: string;
}

interface ActionItemsPanelProps {
  items: ActionItem[];
}

const SEVERITY_RANK: Record<ActionItemSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

// @spec ACTUI-003 — stable sort: ties keep the caller's original relative order.
const sortBySeverity = (items: ActionItem[]): ActionItem[] =>
  items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => SEVERITY_RANK[a.item.severity] - SEVERITY_RANK[b.item.severity] || a.index - b.index)
    .map(({ item }) => item);

// @spec ACTUI-001,ACTUI-002,ACTUI-003,ACTUI-004
const ActionItemsPanel = ({ items }: ActionItemsPanelProps) => {
  const navigate = useNavigate();

  return (
    <section data-testid="action-items-section" style={{ marginBottom: '40px' }}>
      <SectionLabel style={{ marginBottom: '12px' }}>
        Action Items
      </SectionLabel>

      {items.length === 0 ? (
        <Card dashed data-testid="action-items-empty" style={{ padding: '24px' }}>
          Ready to surface things that need your attention — this space is waiting for its first item.
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {sortBySeverity(items).map((item) => (
            <Card
              key={item.id}
              data-testid={`action-item-${item.id}`}
              data-clickable={item.href != null}
              interactive={item.href != null}
              onClick={item.href ? () => navigate(item.href!) : undefined}
              style={{
                padding: '14px 18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Badge data-testid={`action-item-severity-${item.id}`}>{item.severity}</Badge>
                <span data-testid={`action-item-label-${item.id}`} style={{ fontSize: '0.9rem' }}>
                  {item.label}
                </span>
              </div>
              {item.href && (
                <span data-testid={`action-item-cta-${item.id}`} style={{ fontSize: '0.85rem', color: '#555' }}>
                  {item.ctaLabel ?? 'View'}
                </span>
              )}
            </Card>
          ))}
        </div>
      )}
    </section>
  );
};

export { ActionItemsPanel };

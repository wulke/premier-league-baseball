import React from 'react';
import { Button, Card, ErrorText } from './ui';

type ConfirmDeleteModalProps = {
  title: string;
  message: string;
  status: 'confirming' | 'submitting' | 'error';
  errorMessage?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

// @spec GWDUI-003,GWDUI-006,GWDUI-007
const ConfirmDeleteModal = ({ title, message, status, errorMessage, onConfirm, onCancel }: ConfirmDeleteModalProps) => {
  const isSubmitting = status === 'submitting';
  const confirmLabel = status === 'error' ? 'Retry' : 'Delete';

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        zIndex: 1000,
      }}
    >
      <Card style={{ width: '100%', maxWidth: '420px', background: '#fff', padding: '24px', boxShadow: '0 18px 40px rgba(0, 0, 0, 0.18)' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: '1.15rem', fontWeight: 700 }}>
          {title}
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: '0.9rem', color: '#444', lineHeight: 1.5 }}>
          {message}
        </p>

        {status === 'error' && errorMessage && (
          <ErrorText role="alert" style={{ display: 'block', marginBottom: '16px' }}>
            {errorMessage}
          </ErrorText>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <Button type="button" intent="secondary" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="button" intent="danger" onClick={onConfirm} disabled={isSubmitting}>
            {confirmLabel}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export { ConfirmDeleteModal };
export type { ConfirmDeleteModalProps };

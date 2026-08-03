import React from 'react';

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
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: '#fff',
          border: '1px solid #ccc',
          borderRadius: '6px',
          padding: '24px',
          boxShadow: '0 18px 40px rgba(0, 0, 0, 0.18)',
        }}
      >
        <h2 style={{ margin: '0 0 12px', fontSize: '1.15rem', fontWeight: 700 }}>
          {title}
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: '0.9rem', color: '#444', lineHeight: 1.5 }}>
          {message}
        </p>

        {status === 'error' && errorMessage && (
          <p role="alert" style={{ margin: '0 0 16px', color: '#c00', fontSize: '0.9rem' }}>
            {errorMessage}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            style={{
              padding: '8px 16px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              background: '#fff',
              cursor: isSubmitting ? 'default' : 'pointer',
              fontSize: '0.85rem',
              opacity: isSubmitting ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            style={{
              padding: '8px 18px',
              border: '1px solid #8b0000',
              borderRadius: '4px',
              background: '#b00020',
              color: '#fff',
              cursor: isSubmitting ? 'default' : 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
              opacity: isSubmitting ? 0.6 : 1,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export { ConfirmDeleteModal };
export type { ConfirmDeleteModalProps };

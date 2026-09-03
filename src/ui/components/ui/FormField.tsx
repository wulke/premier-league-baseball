import React from 'react';
import { styled } from '../../styles/stitches.config';

const Label = styled('label', {
  display: 'block',
  fontSize: '$sm',
  fontWeight: 600,
  marginBottom: '$xs',
});

const Input = styled('input', {
  width: '100%',
  padding: '8px 10px',
  borderStyle: 'solid',
  borderWidth: '1px',
  borderColor: '$borderDefault',
  borderRadius: '$md',
  fontSize: '$md',
  boxSizing: 'border-box',
});

const Select = styled('select', {
  width: '100%',
  padding: '8px 10px',
  borderStyle: 'solid',
  borderWidth: '1px',
  borderColor: '$borderDefault',
  borderRadius: '$md',
  fontSize: '$md',
  boxSizing: 'border-box',
  background: '$white',
});

const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: '16px' }}>
    <Label>{label}</Label>
    {children}
  </div>
);

export { FormField, Label, Input, Select };

import { styled } from '../../styles/stitches.config';

const Table = styled('table', {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '$base',
});

const Th = styled('th', {
  padding: '6px 8px',
  fontWeight: 600,
  fontSize: '$xs',
  textTransform: 'uppercase',
  letterSpacing: '$wide',
  color: '$textMuted',
});

const Td = styled('td', {
  padding: '8px',
  textAlign: 'center',

  variants: {
    align: {
      left: { textAlign: 'left' },
      right: { textAlign: 'right' },
      center: { textAlign: 'center' },
    },
  },
});

const Tr = styled('tr', {
  borderBottom: '1px solid $borderLight',
});

export { Table, Th, Td, Tr };

import { styled } from '../../styles/stitches.config';

const IconButton = styled('button', {
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: '$md',
  padding: 0,
  lineHeight: 1,

  variants: {
    tone: {
      danger: { color: '$dangerStrong' },
      neutral: { color: '$textMuted' },
    },
  },

  defaultVariants: {
    tone: 'neutral',
  },
});

export { IconButton };

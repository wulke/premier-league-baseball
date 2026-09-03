import { styled } from '../../styles/stitches.config';

const Button = styled('button', {
  borderStyle: 'solid',
  borderWidth: '1px',
  borderColor: 'transparent',
  borderRadius: '$md',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '$base',
  padding: '8px 18px',

  '&:disabled': {
    cursor: 'default',
    opacity: 0.6,
  },

  variants: {
    intent: {
      primary: {
        background: '$black',
        color: '$white',
        borderColor: '$black',
      },
      secondary: {
        background: '$white',
        color: '$text',
        borderColor: '$borderDefault',
      },
      danger: {
        background: '$dangerStrong',
        color: '$white',
        borderColor: '$dangerBorder',
      },
      ghost: {
        background: 'none',
        borderStyle: 'none',
        padding: 0,
        color: '$textMuted',
      },
      dev: {
        background: '$devSurface',
        color: '$devText',
        borderStyle: 'dashed',
        borderWidth: '1px',
        borderColor: '$devBorder',
      },
    },
    size: {
      sm: {
        padding: '6px 14px',
        fontSize: '$sm',
      },
      md: {},
    },
  },

  defaultVariants: {
    intent: 'secondary',
    size: 'md',
  },
});

export { Button };

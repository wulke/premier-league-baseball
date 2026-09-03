import { styled } from '../../styles/stitches.config';

const Card = styled('div', {
  borderStyle: 'solid',
  borderWidth: '1px',
  borderColor: '$borderDefault',
  borderRadius: '$lg',

  variants: {
    interactive: {
      true: {
        cursor: 'pointer',
      },
    },
    dashed: {
      true: {
        borderStyle: 'dashed',
        textAlign: 'center',
        color: '$textFaint',
      },
    },
  },
});

export { Card };

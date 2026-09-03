import { styled } from '../../styles/stitches.config';

const Badge = styled('span', {
  fontSize: '$sm',
  fontWeight: 600,
  color: '$textSubtle',
  borderStyle: 'solid',
  borderWidth: '1px',
  borderColor: '$borderDefault',
  borderRadius: '$pill',
  padding: '2px 10px',
  textTransform: 'uppercase',
  letterSpacing: '$wide',
});

export { Badge };

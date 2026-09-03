import { styled } from '../../styles/stitches.config';

const ErrorBanner = styled('div', {
  padding: '10px 12px',
  borderStyle: 'solid',
  borderWidth: '1px',
  borderColor: '$dangerBorderSoft',
  background: '$dangerSurface',
  borderRadius: '$md',
  color: '$dangerStrong',
  fontSize: '$sm',
});

const ErrorText = styled('span', {
  color: '$danger',
  fontSize: '$sm',
});

export { ErrorBanner, ErrorText };

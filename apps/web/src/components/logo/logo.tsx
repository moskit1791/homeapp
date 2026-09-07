import type { LinkProps } from '@mui/material/Link';

import { mergeClasses } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import { styled } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

import { RouterLink } from 'src/routes/components';

import { logoClasses } from './classes';

export type LogoProps = LinkProps & {
  isSingle?: boolean;
  disabled?: boolean;
};

export function Logo({
  sx,
  disabled,
  className,
  href = '/',
  isSingle = false,
  ...other
}: LogoProps) {
  return (
    <LogoRoot
      component={RouterLink}
      href={href}
      aria-label="HomeApp"
      underline="none"
      className={mergeClasses([logoClasses.root, className])}
      sx={[{ ...(disabled && { pointerEvents: 'none' }) }, ...(Array.isArray(sx) ? sx : [sx])]}
      {...other}
    >
      <Box
        component="img"
        src="/homeapp-icon.png"
        alt=""
        sx={{ width: 40, height: 40, borderRadius: 1.5, flexShrink: 0 }}
      />
      {!isSingle && (
        <Typography variant="h5" color="text.primary" sx={{ letterSpacing: -0.5 }}>
          HomeApp
        </Typography>
      )}
    </LogoRoot>
  );
}

const LogoRoot = styled(Link)(() => ({
  gap: 10,
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  verticalAlign: 'middle',
}));

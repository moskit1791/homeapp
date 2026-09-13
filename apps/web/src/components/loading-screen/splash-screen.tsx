import type { Theme, SxProps } from '@mui/material/styles';
import type { AnimateLogoProps } from '../animate';

import Portal from '@mui/material/Portal';
import { styled } from '@mui/material/styles';

import { AnimateLogoZoom } from '../animate';

// ----------------------------------------------------------------------

export type SplashScreenProps = React.ComponentProps<'div'> & {
  portal?: boolean;
  sx?: SxProps<Theme>;
  slots?: {
    logo?: React.ReactNode;
  };
  slotProps?: {
    wrapper?: React.ComponentProps<typeof LoadingWrapper>;
    logo?: AnimateLogoProps;
  };
};

export function SplashScreen({ portal = true, slots, slotProps, sx, ...other }: SplashScreenProps) {
  const animateLogoProps = slotProps?.logo;
  const logoProps = animateLogoProps?.slotProps?.logo;

  const renderContent = (
    <LoadingWrapper {...slotProps?.wrapper}>
      <LoadingContent sx={sx} {...other}>
        {slots?.logo ?? (
          <AnimateLogoZoom
            {...animateLogoProps}
            slotProps={{
              ...animateLogoProps?.slotProps,
              logo: {
                isSingle: true,
                ...logoProps,
                sx: [
                  { justifyContent: 'center', '& img': { width: 52, height: 52 } },
                  ...(Array.isArray(logoProps?.sx) ? logoProps.sx : [logoProps?.sx]),
                ],
              },
            }}
          />
        )}
      </LoadingContent>
    </LoadingWrapper>
  );

  if (portal) {
    return <Portal>{renderContent}</Portal>;
  }

  return renderContent;
}

// ----------------------------------------------------------------------

const LoadingWrapper = styled('div')({
  flexGrow: 1,
  display: 'flex',
  flexDirection: 'column',
});

const LoadingContent = styled('div')(({ theme }) => ({
  right: 0,
  bottom: 0,
  zIndex: 9998,
  flexGrow: 1,
  width: '100%',
  height: '100%',
  display: 'flex',
  position: 'fixed',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: theme.vars.palette.background.default,
}));

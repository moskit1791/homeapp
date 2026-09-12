import type { Breakpoint } from '@mui/material/styles';
import type { NavItemProps, NavSectionProps } from 'src/components/nav-section';
import type { MainSectionProps, HeaderSectionProps, LayoutSectionProps } from '../core';

import { merge } from 'es-toolkit';
import { Icon } from '@iconify/react';
import { useQuery } from '@tanstack/react-query';
import { useBoolean } from 'minimal-shared/hooks';
import { Link as RouterLink } from 'react-router';

import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AvatarGroup from '@mui/material/AvatarGroup';
import { useTheme, useColorScheme } from '@mui/material/styles';
import IconButton, { iconButtonClasses } from '@mui/material/IconButton';

import { usePathname } from 'src/routes/hooks';

import { useSession } from 'src/homeapp/auth/session-context';
import { getMyHousehold, listHouseholdMembers } from 'src/homeapp/api';
import { WebPushButton } from 'src/homeapp/components/web-push-button';
import { NotificationsDrawer } from 'src/homeapp/components/notifications-drawer';

import { Logo } from 'src/components/logo';
import { useSettingsContext } from 'src/components/settings';

import { NavMobile } from './nav-mobile';
import { VerticalDivider } from './content';
import { NavVertical } from './nav-vertical';
import { NavHorizontal } from './nav-horizontal';
import { Searchbar } from '../components/searchbar';
import { MenuButton } from '../components/menu-button';
import { navData as dashboardNavData } from '../nav-config-dashboard';
import { dashboardLayoutVars, dashboardNavColorVars } from './css-vars';
import { MainSection, layoutClasses, HeaderSection, LayoutSection } from '../core';

type LayoutBaseProps = Pick<LayoutSectionProps, 'sx' | 'children' | 'cssVars'>;

export type DashboardLayoutProps = LayoutBaseProps & {
  layoutQuery?: Breakpoint;
  slotProps?: {
    header?: HeaderSectionProps;
    nav?: { data?: NavSectionProps['data'] };
    main?: MainSectionProps;
  };
};

export function DashboardLayout({
  sx,
  cssVars,
  children,
  slotProps,
  layoutQuery = 'lg',
}: DashboardLayoutProps) {
  const theme = useTheme();
  const settings = useSettingsContext();
  const pathname = usePathname();
  const { colorScheme, setMode } = useColorScheme();
  const { accessToken, logout } = useSession();
  const household = useQuery({
    queryKey: ['household'],
    queryFn: () => getMyHousehold({ accessToken }),
  });
  const members = useQuery({
    queryKey: ['household', 'members'],
    queryFn: () => listHouseholdMembers({ accessToken }),
  });
  const navVars = dashboardNavColorVars(theme, settings.state.navColor, settings.state.navLayout);
  const { value: open, onFalse: onClose, onTrue: onOpen } = useBoolean();
  const navData = slotProps?.nav?.data ?? dashboardNavData;
  const isNavMini = settings.state.navLayout === 'mini';
  const isNavHorizontal = settings.state.navLayout === 'horizontal';
  const isNavVertical = isNavMini || settings.state.navLayout === 'vertical';
  const canDisplayItemByRole = (_allowedRoles: NavItemProps['allowedRoles']) => true;
  const currentLabel =
    [
      ['kalendarz', 'Kalendarz'],
      ['finanse', 'Finanse'],
      ['zakupy', 'Zakupy'],
      ['spizarnia', 'Spiżarnia'],
      ['posilki', 'Plan posiłków'],
      ['zadania', 'Zadania'],
      ['domownicy', 'Ustawienia'],
      ['dom', 'Dom'],
    ].find(([path]) => pathname.startsWith(`/${path}`))?.[1] ?? 'Dzisiaj';
  const isDark = colorScheme === 'dark';

  const toggleMode = () => {
    const nextMode = isDark ? 'light' : 'dark';
    setMode(nextMode);
    settings.setState({ mode: nextMode });
  };

  const renderHeader = () => {
    const headerSlotProps: HeaderSectionProps['slotProps'] = {
      container: {
        maxWidth: false,
        sx: {
          ...(isNavVertical && { px: { [layoutQuery]: 5 } }),
          ...(isNavHorizontal && {
            bgcolor: 'var(--layout-nav-bg)',
            height: { [layoutQuery]: 'var(--layout-nav-horizontal-height)' },
            [`& .${iconButtonClasses.root}`]: { color: 'var(--layout-nav-text-secondary-color)' },
          }),
        },
      },
    };

    const headerSlots: HeaderSectionProps['slots'] = {
      bottomArea: isNavHorizontal ? (
        <NavHorizontal
          data={navData}
          layoutQuery={layoutQuery}
          cssVars={navVars.section}
          checkPermissions={canDisplayItemByRole}
        />
      ) : null,
      leftArea: (
        <>
          <MenuButton
            onClick={onOpen}
            sx={{ mr: 1, ml: -1, [theme.breakpoints.up(layoutQuery)]: { display: 'none' } }}
          />
          <NavMobile
            data={navData}
            open={open}
            onClose={onClose}
            cssVars={navVars.section}
            checkPermissions={canDisplayItemByRole}
            slots={{ bottomArea: false }}
          />
          {isNavHorizontal && (
            <Logo
              sx={{
                display: 'none',
                [theme.breakpoints.up(layoutQuery)]: { display: 'inline-flex' },
              }}
            />
          )}
          {isNavHorizontal && <VerticalDivider />}
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ display: { xs: 'none', sm: 'block' } }}
          >
            HomeApp&nbsp;&nbsp;/&nbsp;&nbsp;
            <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>
              {currentLabel}
            </Box>
          </Typography>
        </>
      ),
      rightArea: (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.25, sm: 0.75 } }}>
          <Searchbar data={navData} />
          <NotificationsDrawer accessToken={accessToken} />
          <WebPushButton accessToken={accessToken} variant="hidden" />
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 1.25 }} />
          <Tooltip title={isDark ? 'Włącz tryb jasny' : 'Włącz tryb ciemny'}>
            <IconButton
              aria-label={isDark ? 'Włącz tryb jasny' : 'Włącz tryb ciemny'}
              onClick={toggleMode}
            >
              <Icon icon={isDark ? 'solar:sun-2-bold-duotone' : 'solar:moon-bold-duotone'} />
            </IconButton>
          </Tooltip>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 1.25 }} />
          <Avatar src="/homeapp-icon.png" alt="HomeApp" sx={{ width: 36, height: 36 }} />
          <Tooltip title="Wyloguj się">
            <IconButton aria-label="Wyloguj się" onClick={() => void logout()}>
              <Icon icon="solar:logout-2-bold-duotone" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    };

    return (
      <HeaderSection
        layoutQuery={layoutQuery}
        disableElevation={isNavVertical}
        {...slotProps?.header}
        slots={{ ...headerSlots, ...slotProps?.header?.slots }}
        slotProps={merge(headerSlotProps, slotProps?.header?.slotProps ?? {})}
        sx={slotProps?.header?.sx}
      />
    );
  };

  const renderNavTop = () =>
    isNavMini ? (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2.5 }}>
        <Logo isSingle />
      </Box>
    ) : (
      <Box sx={{ px: 3, pt: 3, pb: 2 }}>
        <Logo />
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 0.25, ml: 6.25 }}
        >
          Twój dom w jednym miejscu
        </Typography>
      </Box>
    );

  const renderNavBottom = () => (
    <Box sx={{ px: isNavMini ? 1 : 2.5, pb: 2.5 }}>
      <Divider sx={{ mb: 2 }} />
      {!isNavMini && (
        <Box
          component={RouterLink}
          to="/domownicy"
          sx={(currentTheme) => ({
            p: 1.25,
            mb: 1.5,
            gap: 1.25,
            display: 'flex',
            color: 'text.primary',
            alignItems: 'center',
            borderRadius: 2,
            textDecoration: 'none',
            transition: currentTheme.transitions.create('background-color'),
            '&:hover': { bgcolor: 'action.hover' },
          })}
        >
          <Box
            sx={{
              width: 38,
              height: 38,
              display: 'grid',
              flexShrink: 0,
              borderRadius: 1.5,
              placeItems: 'center',
              color: 'success.main',
              bgcolor: 'rgba(34,197,94,.12)',
            }}
          >
            <Icon icon="solar:wallet-2-bold-duotone" width={22} />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle2" noWrap>
              {household.data?.name ?? 'Twój dom'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {members.data?.filter((member) => member.isActive).length ?? 0} domowników
            </Typography>
          </Box>
          <AvatarGroup
            max={3}
            sx={{ '& .MuiAvatar-root': { width: 27, height: 27, fontSize: 11, borderWidth: 1 } }}
          >
            {members.data
              ?.filter((member) => member.isActive)
              .map((member, index) => (
                <Avatar
                  key={member.id}
                  alt={member.displayName}
                  sx={{ bgcolor: index % 2 ? 'secondary.main' : 'primary.main' }}
                >
                  {member.displayName.slice(0, 1).toUpperCase()}
                </Avatar>
              ))}
          </AvatarGroup>
        </Box>
      )}
    </Box>
  );

  const renderSidebar = () => (
    <NavVertical
      data={navData}
      isNavMini={isNavMini}
      layoutQuery={layoutQuery}
      cssVars={navVars.section}
      checkPermissions={canDisplayItemByRole}
      slots={{ topArea: renderNavTop(), bottomArea: renderNavBottom() }}
      sx={(currentTheme) => ({
        background: 'linear-gradient(180deg, #FFFFFF 0%, #F7F9FC 100%)',
        ...currentTheme.applyStyles('dark', {
          background: 'linear-gradient(180deg, #0B1728 0%, #08111E 100%)',
        }),
      })}
      onToggleNav={() =>
        settings.setField(
          'navLayout',
          settings.state.navLayout === 'vertical' ? 'mini' : 'vertical'
        )
      }
    />
  );

  return (
    <LayoutSection
      headerSection={renderHeader()}
      sidebarSection={isNavHorizontal ? null : renderSidebar()}
      footerSection={null}
      cssVars={{ ...dashboardLayoutVars(theme), ...navVars.layout, ...cssVars }}
      sx={[
        (currentTheme) => ({
          bgcolor: '#F7F9FC',
          ...currentTheme.applyStyles('dark', { bgcolor: '#07111F' }),
          [`& .${layoutClasses.sidebarContainer}`]: {
            [theme.breakpoints.up(layoutQuery)]: {
              pl: isNavMini ? 'var(--layout-nav-mini-width)' : 'var(--layout-nav-vertical-width)',
              transition: theme.transitions.create(['padding-left'], {
                easing: 'var(--layout-transition-easing)',
                duration: 'var(--layout-transition-duration)',
              }),
            },
          },
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <MainSection
        {...slotProps?.main}
        sx={[
          (currentTheme) => ({
            bgcolor: '#F7F9FC',
            ...currentTheme.applyStyles('dark', { bgcolor: '#07111F' }),
          }),
          ...(Array.isArray(slotProps?.main?.sx) ? slotProps.main.sx : [slotProps?.main?.sx]),
        ]}
      >
        {children}
      </MainSection>
    </LayoutSection>
  );
}

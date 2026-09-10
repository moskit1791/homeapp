import type { ReactNode } from 'react';

import { Icon } from '@iconify/react';
import { useLocation, Link as RouterLink } from 'react-router';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';

import { PageHeader } from './ui';

const sections = [
  { icon: 'solar:cart-large-2-bold-duotone', label: 'Zakupy', path: '/zakupy' },
  { icon: 'solar:chef-hat-heart-bold-duotone', label: 'Posiłki', path: '/posilki' },
  { icon: 'solar:box-bold-duotone', label: 'Spiżarnia', path: '/spizarnia' },
] as const;

export function FoodNavigation({
  actions,
  description,
}: {
  actions?: ReactNode;
  description: string;
}) {
  const { pathname } = useLocation();

  return (
    <>
      <PageHeader title="Jedzenie" description={description} action={actions} />
      <Box
        sx={(theme) => ({
          p: 0.75,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          border: '1px solid rgba(62,82,112,.18)',
          borderRadius: 2.25,
          bgcolor: 'rgba(255,255,255,.86)',
          boxShadow: '0 8px 28px rgba(34,51,84,.045)',
          ...theme.applyStyles('dark', {
            borderColor: 'rgba(139,166,206,.25)',
            bgcolor: 'rgba(14,28,46,.78)',
            boxShadow: '0 12px 34px rgba(0,0,0,.18)',
          }),
        })}
      >
        {sections.map((section) => {
          const active = pathname === section.path;
          return (
            <Button
              key={section.path}
              component={RouterLink}
              to={section.path}
              color={active ? 'primary' : 'inherit'}
              aria-current={active ? 'page' : undefined}
              sx={(theme) => ({
                py: 1.25,
                px: { xs: 0.75, sm: 2 },
                minWidth: 0,
                borderRadius: 1.6,
                bgcolor: active ? 'rgba(61,110,246,.10)' : 'transparent',
                border: '1px solid',
                borderColor: active ? 'rgba(61,110,246,.24)' : 'transparent',
                '&:hover': { bgcolor: active ? 'rgba(61,110,246,.14)' : 'action.hover' },
                ...theme.applyStyles('dark', {
                  bgcolor: active ? 'rgba(100,145,255,.14)' : 'transparent',
                  borderColor: active ? 'rgba(125,161,255,.38)' : 'transparent',
                }),
              })}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={{ xs: 0.35, sm: 1 }}
                sx={{ alignItems: 'center', minWidth: 0 }}
              >
                <Icon icon={section.icon} width={23} />
                <Box
                  component="span"
                  sx={{ fontSize: { xs: 12, sm: 15 }, fontWeight: 750, whiteSpace: 'nowrap' }}
                >
                  {section.label}
                </Box>
              </Stack>
            </Button>
          );
        })}
      </Box>
    </>
  );
}

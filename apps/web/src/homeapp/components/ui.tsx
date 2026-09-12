import type { ReactNode, PropsWithChildren } from 'react';

import { Icon } from '@iconify/react';

import {
  Box,
  Card,
  Alert,
  Stack,
  Button,
  Dialog,
  IconButton,
  Typography,
  CardContent,
  DialogTitle,
  DialogActions,
  DialogContent,
  type CardProps,
  CircularProgress,
  type ButtonProps,
  type DialogProps,
} from '@mui/material';

import { DashboardContent } from 'src/layouts/dashboard';

export function Page({ children }: PropsWithChildren) {
  return (
    <DashboardContent maxWidth="xl">
      <Stack spacing={{ xs: 2, md: 2.5 }}>{children}</Stack>
    </DashboardContent>
  );
}

export function PageHeader({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      sx={{ alignItems: { sm: 'flex-start' }, justifyContent: 'space-between' }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="h2"
          sx={{ fontSize: { xs: 32, md: 38 }, lineHeight: 1.12, letterSpacing: '-0.025em' }}
        >
          {title}
        </Typography>
        {description && (
          <Typography color="text.secondary" sx={{ mt: 0.55 }}>
            {description}
          </Typography>
        )}
      </Box>
      {action && (
        <Box
          sx={{
            flexShrink: 0,
            width: { xs: '100%', sm: 'auto' },
            '& > *': { maxWidth: '100%' },
          }}
        >
          {action}
        </Box>
      )}
    </Stack>
  );
}

export function SectionCard({
  children,
  title,
  ...props
}: PropsWithChildren<{ title?: string } & CardProps>) {
  return (
    <Card
      {...props}
      sx={[
        (theme) => ({
          border: '1px solid rgba(55,75,105,.24)',
          borderRadius: 2.5,
          bgcolor: 'rgba(255,255,255,.92)',
          boxShadow: '0 10px 34px rgba(34,51,84,.055)',
          ...theme.applyStyles('dark', {
            borderColor: 'rgba(255,255,255,.18)',
            bgcolor: 'rgba(14,28,46,.84)',
            boxShadow: '0 14px 42px rgba(0,0,0,.22)',
          }),
        }),
        ...(Array.isArray(props.sx) ? props.sx : [props.sx]),
      ]}
    >
      <CardContent sx={{ p: { xs: 2, sm: 3 }, '&:last-child': { pb: { xs: 2, sm: 3 } } }}>
        {title && (
          <Typography variant="h5" sx={{ mb: 2, letterSpacing: '-0.015em' }}>
            {title}
          </Typography>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

export function MetricCard({
  icon,
  label,
  value,
  color = 'primary.main',
}: {
  icon: string;
  label: string;
  value: ReactNode;
  color?: string;
}) {
  return (
    <Card
      sx={(theme) => ({
        height: '100%',
        border: '1px solid rgba(55,75,105,.22)',
        borderRadius: 2.25,
        bgcolor: 'rgba(255,255,255,.92)',
        boxShadow: '0 8px 28px rgba(34,51,84,.05)',
        ...theme.applyStyles('dark', {
          borderColor: 'rgba(255,255,255,.16)',
          bgcolor: 'rgba(14,28,46,.82)',
          boxShadow: '0 12px 34px rgba(0,0,0,.2)',
        }),
      })}
    >
      <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 } }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Box
            sx={{
              display: 'grid',
              placeItems: 'center',
              width: 44,
              height: 44,
              flexShrink: 0,
              borderRadius: 1.5,
              color,
              bgcolor: `color-mix(in srgb, ${color} 12%, transparent)`,
            }}
          >
            <Icon icon={icon} width={26} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="h2"
              sx={{ fontSize: { xs: '1.75rem', lg: '1.5rem', xl: '2rem' }, lineHeight: 1.15 }}
            >
              {value}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {label}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function LoadingView() {
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 240 }}>
      <CircularProgress />
    </Box>
  );
}

export function ErrorView({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <Alert
      severity="error"
      action={
        retry && (
          <Button color="inherit" onClick={retry}>
            Spróbuj ponownie
          </Button>
        )
      }
    >
      {errorMessage(error)}
    </Alert>
  );
}

export function EmptyState({
  icon = 'solar:inbox-line-bold-duotone',
  text,
}: {
  icon?: string;
  text: string;
}) {
  return (
    <Stack
      spacing={1.5}
      sx={{ py: 5, color: 'text.secondary', textAlign: 'center', alignItems: 'center' }}
    >
      <Icon icon={icon} width={52} />
      <Typography>{text}</Typography>
    </Stack>
  );
}

export function PrimaryButton({
  icon = 'solar:add-circle-bold',
  children,
  ...props
}: ButtonProps & { icon?: string }) {
  return (
    <Button variant="contained" startIcon={<Icon icon={icon} />} {...props}>
      {children}
    </Button>
  );
}

export function FormDialog({
  cancelLabel = 'Anuluj',
  children,
  hideSubmit = false,
  icon = 'solar:document-add-bold-duotone',
  loading,
  onClose,
  onSubmit,
  open,
  subtitle,
  submitColor = 'primary',
  submitLabel = 'Zapisz',
  submitDisabled,
  title,
  ...props
}: PropsWithChildren<
  {
    cancelLabel?: string;
    hideSubmit?: boolean;
    icon?: string;
    loading?: boolean;
    onClose: () => void;
    onSubmit: () => void;
    open: boolean;
    subtitle?: string;
    submitColor?: ButtonProps['color'];
    submitLabel?: string;
    submitDisabled?: boolean;
    title: string;
  } & Omit<DialogProps, 'onClose' | 'open'>
>) {
  return (
    <Dialog
      {...props}
      open={open}
      onClose={loading ? undefined : onClose}
      fullWidth
      maxWidth={props.maxWidth ?? 'sm'}
      sx={{
        '& .MuiDialog-paper': {
          m: { xs: 0, sm: 2 },
          width: { xs: '100%', sm: 'calc(100% - 32px)' },
          maxHeight: { xs: '100%', sm: 'calc(100% - 48px)' },
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: { xs: 0, sm: 2.75 },
          backgroundImage: 'none',
          overflow: 'hidden',
        },
      }}
    >
      <DialogTitle
        sx={{
          px: { xs: 2, sm: 3 },
          py: 2.25,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              display: 'grid',
              flexShrink: 0,
              placeItems: 'center',
              color: 'primary.main',
              bgcolor: 'primary.lighter',
              borderRadius: 1.5,
            }}
          >
            <Icon icon={icon} width={25} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h5">{title}</Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          <IconButton aria-label="Zamknij" onClick={onClose} disabled={loading}>
            <Icon icon="mingcute:close-line" />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent
        sx={{
          px: { xs: 2, sm: 3 },
          py: '24px !important',
          bgcolor: 'background.default',
        }}
      >
        <Stack spacing={2.25}>{children}</Stack>
      </DialogContent>
      <DialogActions
        sx={{
          px: { xs: 2, sm: 3 },
          py: 2,
          gap: 1,
          flexDirection: { xs: 'column-reverse', sm: 'row' },
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          '& > :not(style) ~ :not(style)': { ml: 0 },
          '& .MuiButton-root': { width: { xs: '100%', sm: 'auto' } },
        }}
      >
        <Button variant="outlined" onClick={onClose} disabled={loading} sx={{ minWidth: 112 }}>
          {cancelLabel}
        </Button>
        {!hideSubmit && (
          <Button
            color={submitColor}
            variant="contained"
            onClick={onSubmit}
            disabled={loading || submitDisabled}
            sx={{ minWidth: 132 }}
          >
            {loading ? 'Zapisywanie…' : submitLabel}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Wystąpił nieoczekiwany błąd.';
}

export function confirmDelete(label: string): boolean {
  return window.confirm(`Czy na pewno usunąć: ${label}?`);
}

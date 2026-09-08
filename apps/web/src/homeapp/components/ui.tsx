import type { ReactNode, PropsWithChildren } from 'react';

import { Icon } from '@iconify/react';

import {
  Box,
  Card,
  Alert,
  Stack,
  Button,
  Dialog,
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

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

export function Page({ children }: PropsWithChildren) {
  return (
    <DashboardContent maxWidth="xl">
      <Stack spacing={3}>{children}</Stack>
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
    <Stack spacing={0.75}>
      <CustomBreadcrumbs heading={title} action={action} />
      {description && <Typography color="text.secondary">{description}</Typography>}
    </Stack>
  );
}

export function SectionCard({
  children,
  title,
  ...props
}: PropsWithChildren<{ title?: string } & CardProps>) {
  return (
    <Card {...props}>
      <CardContent sx={{ p: { xs: 2, sm: 3 }, '&:last-child': { pb: { xs: 2, sm: 3 } } }}>
        {title && (
          <Typography variant="h3" sx={{ mb: 2 }}>
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
    <Card>
      <CardContent>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Box
            sx={{
              display: 'grid',
              placeItems: 'center',
              width: 44,
              height: 44,
              flexShrink: 0,
              borderRadius: '50%',
              color,
              bgcolor: 'action.hover',
            }}
          >
            <Icon icon={icon} width={26} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h2" sx={{ fontSize: { xs: '1.75rem', lg: '1.5rem', xl: '2rem' }, lineHeight: 1.15 }}>
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
  children,
  loading,
  onClose,
  onSubmit,
  open,
  submitLabel = 'Zapisz',
  submitDisabled,
  title,
  ...props
}: PropsWithChildren<
  {
    loading?: boolean;
    onClose: () => void;
    onSubmit: () => void;
    open: boolean;
    submitLabel?: string;
    submitDisabled?: boolean;
    title: string;
  } & Omit<DialogProps, 'onClose' | 'open'>
>) {
  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="sm" {...props}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {children}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Anuluj
        </Button>
        <Button variant="contained" onClick={onSubmit} disabled={loading || submitDisabled}>
          {loading ? 'Zapisywanie…' : submitLabel}
        </Button>
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

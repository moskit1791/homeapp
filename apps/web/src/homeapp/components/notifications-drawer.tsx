import type { NotificationInboxItem } from '../api';

import { useState } from 'react';
import { Icon } from '@iconify/react';
import { Link as RouterLink } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Badge from '@mui/material/Badge';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemButton from '@mui/material/ListItemButton';

import { WebPushButton } from './web-push-button';
import {
  listNotificationInbox,
  markNotificationInboxItemRead,
  markAllNotificationInboxItemsRead,
} from '../api';

interface NotificationsDrawerProps {
  accessToken: string | null;
}

export function NotificationsDrawer({ accessToken }: NotificationsDrawerProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const inbox = useQuery({
    queryKey: ['notifications', 'inbox'],
    queryFn: () => listNotificationInbox({ accessToken }),
    enabled: Boolean(accessToken),
    refetchInterval: 30_000,
  });
  const unreadCount = inbox.data?.filter((notification) => !notification.readAt).length ?? 0;
  const markRead = useMutation({
    mutationFn: (notificationId: string) =>
      markNotificationInboxItemRead(notificationId, { accessToken }),
    onSuccess: (updated) => {
      queryClient.setQueryData<NotificationInboxItem[]>(['notifications', 'inbox'], (current) =>
        current?.map((notification) => (notification.id === updated.id ? updated : notification))
      );
    },
  });
  const markAllRead = useMutation({
    mutationFn: () => markAllNotificationInboxItemsRead({ accessToken }),
    onSuccess: () => {
      const readAt = new Date().toISOString();
      queryClient.setQueryData<NotificationInboxItem[]>(['notifications', 'inbox'], (current) =>
        current?.map((notification) => ({
          ...notification,
          readAt: notification.readAt ?? readAt,
        }))
      );
    },
  });

  const show = () => {
    setOpen(true);
    void inbox.refetch();
  };

  const openNotification = (notification: NotificationInboxItem) => {
    if (!notification.readAt) markRead.mutate(notification.id);
    setOpen(false);
  };

  return (
    <>
      <Tooltip title="Powiadomienia">
        <IconButton aria-label="Otwórz powiadomienia" onClick={show}>
          <Badge color="error" badgeContent={unreadCount} max={99} invisible={unreadCount === 0}>
            <Icon icon="solar:bell-bing-bold-duotone" />
          </Badge>
        </IconButton>
      </Tooltip>
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{ root: { keepMounted: true } }}
      >
        <Box
          sx={{
            width: { xs: 330, sm: 410 },
            maxWidth: '100vw',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6">Powiadomienia</Typography>
              <Typography variant="body2" color="text.secondary">
                Historia wiadomości wysłanych jako push
              </Typography>
            </Box>
            {unreadCount > 0 && (
              <Button
                size="small"
                disabled={markAllRead.isPending}
                onClick={() => markAllRead.mutate()}
              >
                Przeczytaj wszystkie
              </Button>
            )}
            <IconButton aria-label="Zamknij powiadomienia" onClick={() => setOpen(false)}>
              <Icon icon="mingcute:close-line" />
            </IconButton>
          </Box>
          <Divider />

          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {inbox.error && (
              <Alert severity="error" sx={{ m: 2 }}>
                Nie udało się pobrać powiadomień.
              </Alert>
            )}
            {!inbox.isLoading && !inbox.error && inbox.data?.length === 0 && (
              <Box sx={{ px: 3, py: 7, textAlign: 'center' }}>
                <Icon icon="solar:bell-off-bold-duotone" width={42} />
                <Typography variant="subtitle1" sx={{ mt: 1 }}>
                  Brak powiadomień
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Tutaj pojawią się wiadomości wysłane do Ciebie jako push.
                </Typography>
              </Box>
            )}
            {inbox.data?.map((notification) => {
              const unread = !notification.readAt;

              return (
                <ListItemButton
                  key={notification.id}
                  component={RouterLink}
                  to={notificationPath(notification)}
                  onClick={() => openNotification(notification)}
                  sx={{
                    px: 2.5,
                    py: 1.5,
                    alignItems: 'flex-start',
                    bgcolor: unread ? 'action.selected' : 'transparent',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 44, mt: 0.25, color: 'primary.main' }}>
                    <Icon icon={notificationIcon(notification)} width={24} />
                  </ListItemIcon>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                      <Typography
                        variant="subtitle2"
                        sx={{ flex: 1, fontWeight: unread ? 800 : 600 }}
                      >
                        {notification.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                        {notificationDate(notification.createdAt)}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {notification.body}
                    </Typography>
                  </Box>
                  {unread && (
                    <Box
                      aria-label="Nieprzeczytane"
                      sx={{
                        width: 8,
                        height: 8,
                        mt: 0.75,
                        ml: 1,
                        borderRadius: '50%',
                        bgcolor: 'error.main',
                      }}
                    />
                  )}
                </ListItemButton>
              );
            })}
          </Box>

          <Divider />
          <WebPushButton accessToken={accessToken} variant="list-item" />
          <ListItemButton component={RouterLink} to="/domownicy" onClick={() => setOpen(false)}>
            <ListItemIcon sx={{ minWidth: 42 }}>
              <Icon icon="solar:settings-bold-duotone" width={22} />
            </ListItemIcon>
            <ListItemText primary="Ustawienia powiadomień" />
          </ListItemButton>
        </Box>
      </Drawer>
    </>
  );
}

function notificationPath(notification: NotificationInboxItem): string {
  const path = notification.data.url;
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') ? path : '/';
}

function notificationIcon(notification: NotificationInboxItem): string {
  const eventType =
    typeof notification.data.eventType === 'string' ? notification.data.eventType : '';
  const kind = typeof notification.data.kind === 'string' ? notification.data.kind : '';

  if (kind === 'calendar-reminder' || eventType === 'calendar.changed') {
    return 'solar:calendar-mark-bold-duotone';
  }
  if (eventType.startsWith('finance.')) return 'solar:wallet-money-bold-duotone';
  if (eventType === 'shopping.changed') return 'solar:cart-3-bold-duotone';
  if (eventType === 'meal.changed') return 'solar:chef-hat-bold-duotone';
  if (eventType === 'todo.changed') return 'solar:checklist-minimalistic-bold-duotone';
  if (eventType === 'cleaning.changed') return 'solar:refresh-circle-bold-duotone';
  if (eventType === 'annual_cost.changed') return 'solar:calendar-dollar-bold-duotone';
  if (eventType === 'attachment.changed') return 'solar:paperclip-bold-duotone';
  if (eventType === 'household.changed' || eventType === 'permissions.changed') {
    return 'solar:home-smile-bold-duotone';
  }
  return 'solar:bell-bold-duotone';
}

function notificationDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(date);
}

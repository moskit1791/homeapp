import type { StartDashboard } from '../api';

import { useState } from 'react';
import { Icon } from '@iconify/react';
import { Link as RouterLink } from 'react-router';

import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';
import Drawer from '@mui/material/Drawer';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemButton from '@mui/material/ListItemButton';

import { shortDate } from '../utils/format';
import { WebPushButton } from './web-push-button';

interface NotificationsDrawerProps {
  accessToken: string | null;
  dashboard?: StartDashboard;
  onOpen?: () => void;
}

export function NotificationsDrawer({ accessToken, dashboard, onOpen }: NotificationsDrawerProps) {
  const [open, setOpen] = useState(false);
  const events = dashboard?.upcomingEvents ?? [];
  const todos = dashboard?.todoPreview ?? [];
  const notificationCount = events.length + (dashboard?.todoCount ?? 0);

  const show = () => {
    setOpen(true);
    onOpen?.();
  };

  return (
    <>
      <Tooltip title="Powiadomienia">
        <IconButton aria-label="Otwórz powiadomienia" onClick={show}>
          <Badge color="primary" badgeContent={notificationCount} max={9}>
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
        <Box sx={{ width: { xs: 320, sm: 390 }, maxWidth: '100vw' }}>
          <Box sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6">Powiadomienia</Typography>
              <Typography variant="body2" color="text.secondary">
                Nadchodzące terminy i zadania
              </Typography>
            </Box>
            <IconButton aria-label="Zamknij powiadomienia" onClick={() => setOpen(false)}>
              <Icon icon="mingcute:close-line" />
            </IconButton>
          </Box>
          <Divider />

          {notificationCount === 0 ? (
            <Box sx={{ px: 3, py: 7, textAlign: 'center' }}>
              <Icon icon="solar:bell-off-bold-duotone" width={42} />
              <Typography variant="subtitle1" sx={{ mt: 1 }}>
                Wszystko załatwione
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Nie masz teraz nadchodzących terminów ani otwartych zadań.
              </Typography>
            </Box>
          ) : (
            <>
              {events.length > 0 && (
                <Box sx={{ py: 1 }}>
                  <Typography variant="overline" color="text.secondary" sx={{ px: 2.5 }}>
                    Kalendarz
                  </Typography>
                  {events.map((event) => (
                    <ListItemButton
                      key={event.id}
                      component={RouterLink}
                      to="/kalendarz"
                      onClick={() => setOpen(false)}
                    >
                      <ListItemIcon sx={{ minWidth: 42, color: 'primary.main' }}>
                        <Icon icon="solar:calendar-mark-bold-duotone" width={24} />
                      </ListItemIcon>
                      <ListItemText
                        primary={event.title}
                        secondary={`${shortDate(event.eventDate)}${event.eventTime ? `, ${event.eventTime.slice(0, 5)}` : ''}`}
                      />
                    </ListItemButton>
                  ))}
                </Box>
              )}
              {events.length > 0 && (dashboard?.todoCount ?? 0) > 0 && <Divider />}
              {(dashboard?.todoCount ?? 0) > 0 && (
                <Box sx={{ py: 1 }}>
                  <Typography variant="overline" color="text.secondary" sx={{ px: 2.5 }}>
                    Do zrobienia
                  </Typography>
                  {todos.map((todo) => (
                    <ListItemButton
                      key={todo.id}
                      component={RouterLink}
                      to="/zadania"
                      onClick={() => setOpen(false)}
                    >
                      <ListItemIcon sx={{ minWidth: 42, color: 'warning.main' }}>
                        <Icon icon="solar:checklist-minimalistic-bold-duotone" width={24} />
                      </ListItemIcon>
                      <ListItemText primary={todo.title} secondary="Otwarte zadanie" />
                    </ListItemButton>
                  ))}
                  {(dashboard?.todoCount ?? 0) > todos.length && (
                    <ListItemButton
                      component={RouterLink}
                      to="/zadania"
                      onClick={() => setOpen(false)}
                    >
                      <ListItemText
                        inset
                        primary={`Zobacz pozostałe ${(dashboard?.todoCount ?? 0) - todos.length}`}
                      />
                    </ListItemButton>
                  )}
                </Box>
              )}
            </>
          )}

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

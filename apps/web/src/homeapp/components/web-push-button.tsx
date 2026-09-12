import { Icon } from '@iconify/react';
import { useRef, useState, useEffect } from 'react';

import Alert from '@mui/material/Alert';
import Badge from '@mui/material/Badge';
import Tooltip from '@mui/material/Tooltip';
import Snackbar from '@mui/material/Snackbar';
import IconButton from '@mui/material/IconButton';

import { registerWebPushSubscription } from '../api';

const vapidPublicKey = import.meta.env.VITE_WEB_PUSH_VAPID_PUBLIC_KEY ?? '';

type PushState = NotificationPermission | 'unsupported';

export function WebPushButton({ accessToken }: { accessToken: string | null }) {
  const [state, setState] = useState<PushState>(() => readPushState());
  const [message, setMessage] = useState<string | null>(null);
  const registrationRef = useRef<Promise<void> | null>(null);

  const register = async (): Promise<void> => {
    if (!accessToken || state === 'unsupported') return;
    if (registrationRef.current) {
      await registrationRef.current;
      return;
    }

    const pending = registerBrowserForPush(accessToken)
      .then(() => setState('granted'))
      .finally(() => {
        registrationRef.current = null;
    });
    registrationRef.current = pending;
    await pending;
  };

  useEffect(() => {
    if (state === 'granted' && accessToken) {
      void register().catch(() => setMessage('Nie udało się odświeżyć powiadomień push.'));
    }
    // Re-register after login or access-token refresh. The API upserts the same subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, state]);

  if (state === 'unsupported') return null;

  const enablePush = async () => {
    if (state === 'denied') {
      setMessage('Powiadomienia są zablokowane w ustawieniach tej przeglądarki.');
      return;
    }

    try {
      const permission = state === 'granted' ? state : await Notification.requestPermission();
      setState(permission);
      if (permission !== 'granted') {
        setMessage('Bez zgody przeglądarka nie może wyświetlać powiadomień push.');
        return;
      }
      await register();
      setMessage('Powiadomienia push są włączone.');
    } catch {
      setMessage('Nie udało się włączyć powiadomień push.');
    }
  };

  const label =
    state === 'granted'
      ? 'Powiadomienia push są włączone'
      : state === 'denied'
        ? 'Powiadomienia push są zablokowane'
        : 'Włącz powiadomienia push';

  return (
    <>
      <Tooltip title={label}>
        <IconButton aria-label={label} onClick={() => void enablePush()}>
          <Badge color="warning" variant="dot" invisible={state !== 'default'}>
            <Icon
              icon={
                state === 'granted'
                  ? 'solar:bell-bing-bold-duotone'
                  : state === 'denied'
                    ? 'solar:bell-off-bold-duotone'
                    : 'solar:bell-bold-duotone'
              }
            />
          </Badge>
        </IconButton>
      </Tooltip>
      <Snackbar open={Boolean(message)} autoHideDuration={5000} onClose={() => setMessage(null)}>
        <Alert severity={state === 'granted' ? 'success' : 'warning'} onClose={() => setMessage(null)}>
          {message}
        </Alert>
      </Snackbar>
    </>
  );
}

function readPushState(): PushState {
  if (
    !vapidPublicKey ||
    typeof Notification === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return 'unsupported';
  }
  return Notification.permission;
}

async function registerBrowserForPush(accessToken: string): Promise<void> {
  const registration = await navigator.serviceWorker.register('/push-service-worker.js', {
    scope: '/',
  });
  await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      applicationServerKey: decodeVapidPublicKey(vapidPublicKey),
      userVisibleOnly: true,
    }));
  const serialized = subscription.toJSON();

  if (!serialized.endpoint || !serialized.keys?.auth || !serialized.keys.p256dh) {
    throw new Error('Przeglądarka zwróciła niepełną subskrypcję push.');
  }

  await registerWebPushSubscription(
    {
      deviceName: navigator.userAgent.slice(0, 200),
      endpoint: serialized.endpoint,
      keys: { auth: serialized.keys.auth, p256dh: serialized.keys.p256dh },
    },
    { accessToken }
  );
}

function decodeVapidPublicKey(value: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const decoded = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const buffer = new ArrayBuffer(decoded.length);
  const bytes = new Uint8Array(buffer);

  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return bytes;
}

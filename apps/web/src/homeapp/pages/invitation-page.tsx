import { useNavigate, useSearchParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Alert, Stack, Typography } from '@mui/material';

import { useSession } from '../auth/session-context';
import { acceptInvitation, previewInvitation } from '../api';
import { Page, ErrorView, LoadingView, SectionCard, PrimaryButton } from '../components/ui';

export function InvitationPage() {
  const { accessToken } = useSession();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = params.get('token') ?? '';
  const preview = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => previewInvitation(token),
    enabled: Boolean(token),
  });
  const accept = useMutation({
    mutationFn: () => acceptInvitation({ token }, { accessToken }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      navigate('/', { replace: true });
    },
  });

  if (!token) return <Page><ErrorView error={new Error('Brak tokenu zaproszenia.')} /></Page>;
  if (preview.isLoading) return <LoadingView />;
  if (preview.error || !preview.data) return <Page><ErrorView error={preview.error} /></Page>;

  return (
    <Page>
      <SectionCard sx={{ maxWidth: 620, mx: 'auto', textAlign: 'center' }}>
        <Stack spacing={2.5} sx={{ alignItems: 'center' }}>
          <Typography variant="h3">Zaproszenie do domu</Typography>
          <Typography color="text.secondary">
            {preview.data.invitedByDisplayName} zaprasza Cię do domu „{preview.data.householdName}”.
          </Typography>
          {accept.error && <Alert severity="error">{accept.error.message}</Alert>}
          <PrimaryButton onClick={() => accept.mutate()} disabled={accept.isPending}>
            Dołącz do domu
          </PrimaryButton>
        </Stack>
      </SectionCard>
    </Page>
  );
}

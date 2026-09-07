import { useState, type FormEvent } from 'react';

import { Box, Stack, Button, MenuItem, TextField, Typography } from '@mui/material';

import { ErrorView } from '../components/ui';
import { useSession } from '../auth/session-context';

export function CreateHouseholdPage() {
  const { createFirstHousehold } = useSession();
  const [name, setName] = useState('Mój dom');
  const [currencyCode, setCurrencyCode] = useState('PLN');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    try {
      await createFirstHousehold({
        name: name.trim(),
        currencyCode,
        mealSlotsPerDay: 2,
      });
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Stack component="form" onSubmit={submit} spacing={3} sx={{ width: 1 }}>
      <Box>
        <Typography variant="h3">Utwórz swój dom</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          To wspólna przestrzeń dla domowników, zadań i budżetu.
        </Typography>
      </Box>
      {error ? <ErrorView error={error} /> : null}
      <TextField
        label="Nazwa domu"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <TextField
        select
        label="Waluta"
        value={currencyCode}
        onChange={(e) => setCurrencyCode(e.target.value)}
      >
        <MenuItem value="PLN">PLN — złoty</MenuItem>
        <MenuItem value="EUR">EUR — euro</MenuItem>
        <MenuItem value="USD">USD — dolar</MenuItem>
      </TextField>
      <Button type="submit" variant="contained" size="large" disabled={loading}>
        {loading ? 'Tworzenie…' : 'Zaczynamy'}
      </Button>
    </Stack>
  );
}

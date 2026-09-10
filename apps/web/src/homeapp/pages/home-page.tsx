import type { DataEntry, Attachment, CleaningTask } from '../api';

import { Icon } from '@iconify/react';
import { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  Box,
  Tab,
  Chip,
  Tabs,
  Alert,
  Stack,
  Button,
  Divider,
  TextField,
  IconButton,
  Typography,
} from '@mui/material';

import { useSession } from '../auth/session-context';
import { usePermission } from '../auth/use-permission';
import { money, todayIso, shortDate } from '../utils/format';
import {
  Page,
  ErrorView,
  EmptyState,
  FormDialog,
  PageHeader,
  LoadingView,
  SectionCard,
  confirmDelete,
  PrimaryButton,
} from '../components/ui';
import {
  getMyHousehold,
  listAttachments,
  createDataEntry,
  deleteDataEntry,
  listAnnualCosts,
  listDataEntries,
  updateAttachment,
  deleteAttachment,
  createAnnualCost,
  listCleaningTasks,
  completeAnnualCost,
  createCleaningTask,
  updateCleaningTask,
  deleteCleaningTask,
  completeCleaningTask,
  uploadAttachmentFile,
  listAnnualCostHistory,
  createAttachmentRecord,
  getAttachmentFileRequest,
  createAttachmentUploadUrl,
} from '../api';

type HomeTab = 'cleaning' | 'costs' | 'data' | 'attachments';

const homeTabs: Array<{ icon: string; label: string; value: HomeTab }> = [
  { icon: 'solar:broom-bold-duotone', label: 'Sprzątanie', value: 'cleaning' },
  { icon: 'solar:chart-2-bold-duotone', label: 'Koszty', value: 'costs' },
  { icon: 'solar:database-bold-duotone', label: 'Dane', value: 'data' },
  { icon: 'solar:folder-with-files-bold-duotone', label: 'Pliki', value: 'attachments' },
];

function AttachmentThumbnail({
  accessToken,
  attachment,
}: {
  accessToken: string | null;
  attachment: Attachment;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!attachment.mimeType.startsWith('image/')) return undefined;
    let active = true;
    let objectUrl: string | null = null;

    const request = getAttachmentFileRequest(attachment.id, { accessToken });
    void fetch(request.uri, { headers: request.headers })
      .then((response) => {
        if (!response.ok) throw new Error('Nie udało się pobrać miniatury.');
        return response.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setUrl(objectUrl);
        else {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [accessToken, attachment.id, attachment.mimeType]);

  return (
    <Box
      sx={{
        width: 72,
        height: 64,
        display: 'grid',
        flexShrink: 0,
        overflow: 'hidden',
        placeItems: 'center',
        borderRadius: 1.5,
        color: 'primary.main',
        bgcolor: 'primary.lighter',
      }}
    >
      {url ? (
        <Box
          component="img"
          src={url}
          alt={`Miniatura ${attachment.fileName}`}
          sx={{ width: 1, height: 1, objectFit: 'cover' }}
        />
      ) : (
        <Icon
          icon={
            attachment.mimeType === 'application/pdf'
              ? 'solar:file-text-bold-duotone'
              : 'solar:gallery-bold-duotone'
          }
          width={28}
        />
      )}
    </Box>
  );
}

export function HomePage() {
  const { accessToken } = useSession();
  const cleaningPermission = usePermission('cleaning');
  const costsPermission = usePermission('annual_costs');
  const dataPermission = usePermission('data_entries');
  const attachmentsPermission = usePermission('attachments');
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<HomeTab>('cleaning');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [detail, setDetail] = useState('');
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState('');
  const [days, setDays] = useState('7');
  const [search, setSearch] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [editingCleaning, setEditingCleaning] = useState<CleaningTask | null>(null);
  const [editingAttachment, setEditingAttachment] = useState<Attachment | null>(null);
  const [selectedDataEntry, setSelectedDataEntry] = useState<DataEntry | null>(null);
  const [historyYear, setHistoryYear] = useState(new Date().getFullYear());
  const [completionCostId, setCompletionCostId] = useState<string | null>(null);
  const [previewingAttachment, setPreviewingAttachment] = useState<Attachment | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl]
  );
  const cleaning = useQuery({
    queryKey: ['cleaning'],
    queryFn: () => listCleaningTasks({ accessToken }),
  });
  const costs = useQuery({
    queryKey: ['annualCosts'],
    queryFn: () => listAnnualCosts({ accessToken }),
  });
  const data = useQuery({
    queryKey: ['dataEntries', search],
    queryFn: () => listDataEntries(search || undefined, { accessToken }),
  });
  const attachments = useQuery({
    queryKey: ['attachments', search],
    queryFn: () => listAttachments(search || undefined, { accessToken }),
  });
  const costHistory = useQuery({
    queryKey: ['annualCosts', 'history', historyYear],
    queryFn: () => listAnnualCostHistory(historyYear, { accessToken }),
  });
  const household = useQuery({
    queryKey: ['household'],
    queryFn: () => getMyHousehold({ accessToken }),
  });
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey:
        tab === 'cleaning'
          ? ['cleaning']
          : tab === 'costs'
            ? ['annualCosts']
            : tab === 'data'
              ? ['dataEntries']
              : ['attachments'],
    });
  const create = useMutation<unknown, Error>({
    mutationFn: () => {
      if (tab === 'cleaning')
        return editingCleaning
          ? updateCleaningTask(
              editingCleaning.id,
              {
                name: name.trim(),
                location: detail || undefined,
                nextDueAt: date,
                frequencyDays: Number(days),
                frequencyMode: 'custom_days',
                completionWindowDays: 1,
              },
              { accessToken }
            )
          : createCleaningTask(
              {
                name: name.trim(),
                location: detail || undefined,
                nextDueAt: date,
                frequencyDays: Number(days),
                frequencyMode: 'custom_days',
                completionWindowDays: 1,
              },
              { accessToken }
            );
      if (tab === 'costs')
        return createAnnualCost(
          {
            name: name.trim(),
            defaultAmount: amount ? Number(amount) : null,
            nextDueDate: date,
          },
          { accessToken }
        );
      if (tab === 'data')
        return createDataEntry({ title: name.trim(), value: detail }, { accessToken });
      if (editingAttachment)
        return updateAttachment(
          editingAttachment.id,
          { caption: detail, fileName: name.trim() },
          { accessToken }
        );
      if (!file) throw new Error('Wybierz plik.');
      return uploadAttachment(file);
    },
    onSuccess: async () => {
      setOpen(false);
      setName('');
      setDetail('');
      setAmount('');
      setFile(null);
      setEditingCleaning(null);
      setEditingAttachment(null);
      await invalidate();
    },
  });
  const completeCleaning = useMutation({
    mutationFn: (id: string) =>
      completeCleaningTask(id, { completedAt: new Date().toISOString() }, { accessToken }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['cleaning'] }),
        queryClient.invalidateQueries({ queryKey: ['start'] }),
      ]);
    },
  });
  const removeCleaning = useMutation({
    mutationFn: (id: string) => deleteCleaningTask(id, { accessToken }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cleaning'] }),
  });
  const completeCost = useMutation({
    mutationFn: () =>
      completeAnnualCost(
        completionCostId!,
        { executedAt: date, amount: amount ? Number(amount) : null },
        { accessToken }
      ),
    onSuccess: async () => {
      setCompletionCostId(null);
      setAmount('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['annualCosts'] }),
        queryClient.invalidateQueries({ queryKey: ['start'] }),
      ]);
    },
  });
  const removeData = useMutation({
    mutationFn: (id: string) => deleteDataEntry(id, { accessToken }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dataEntries'] }),
  });
  const removeAttachment = useMutation({
    mutationFn: (id: string) => deleteAttachment(id, { accessToken }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attachments'] }),
  });
  const active =
    tab === 'cleaning' ? cleaning : tab === 'costs' ? costs : tab === 'data' ? data : attachments;
  const currency = household.data?.currencyCode ?? 'PLN';
  const permission =
    tab === 'cleaning'
      ? cleaningPermission
      : tab === 'costs'
        ? costsPermission
        : tab === 'data'
          ? dataPermission
          : attachmentsPermission;
  const activeMeta = {
    cleaning: {
      color: '#6F8CFF',
      count: cleaning.data?.length ?? 0,
      icon: 'solar:broom-bold-duotone',
      title: 'Sprzątanie',
    },
    costs: {
      color: '#55D99B',
      count: costs.data?.length ?? 0,
      icon: 'solar:chart-2-bold-duotone',
      title: 'Koszty roczne',
    },
    data: {
      color: '#A879E8',
      count: data.data?.length ?? 0,
      icon: 'solar:database-bold-duotone',
      title: 'Ważne dane',
    },
    attachments: {
      color: '#F6B94D',
      count: attachments.data?.length ?? 0,
      icon: 'solar:folder-with-files-bold-duotone',
      title: 'Pliki',
    },
  }[tab];

  async function uploadAttachment(selectedFile: File) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
    if (!allowed.includes(selectedFile.type as (typeof allowed)[number]))
      throw new Error('Obsługiwane są JPG, PNG, WEBP i PDF.');
    const mimeType = selectedFile.type as Attachment['mimeType'];
    const contract = await createAttachmentUploadUrl(
      { fileName: selectedFile.name, mimeType },
      { accessToken }
    );
    const uploaded = await uploadAttachmentFile(
      {
        file: selectedFile,
        fileName: contract.fileName,
        mimeType,
        storagePath: contract.storagePath,
        uploadUrl: contract.uploadUrl,
      },
      { accessToken }
    );
    return createAttachmentRecord(
      {
        caption: detail,
        fileName: name.trim() || uploaded.fileName,
        mimeType: uploaded.mimeType,
        storagePath: uploaded.storagePath,
      },
      { accessToken }
    );
  }

  async function downloadAttachment(attachment: Attachment) {
    try {
      setAttachmentError(null);
      const request = getAttachmentFileRequest(attachment.id, { accessToken });
      const response = await fetch(request.uri, { headers: request.headers });
      if (!response.ok) throw new Error('Nie udało się pobrać pliku.');
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = attachment.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : 'Nie udało się pobrać pliku.');
    }
  }

  async function previewAttachment(attachment: Attachment) {
    setPreviewingAttachment(attachment);
    setPreviewLoading(true);
    setAttachmentError(null);
    setPreviewUrl(null);

    try {
      const request = getAttachmentFileRequest(attachment.id, { accessToken });
      const response = await fetch(request.uri, { headers: request.headers });
      if (!response.ok) throw new Error('Nie udało się otworzyć pliku.');
      setPreviewUrl(URL.createObjectURL(await response.blob()));
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : 'Nie udało się otworzyć pliku.');
    } finally {
      setPreviewLoading(false);
    }
  }

  function closeAttachmentPreview() {
    setPreviewUrl(null);
    setPreviewingAttachment(null);
    setAttachmentError(null);
  }

  function openCleaningEdit(task: CleaningTask) {
    setEditingCleaning(task);
    setName(task.name);
    setDetail(task.location ?? '');
    setDate(task.nextDueAt.slice(0, 10));
    setDays(String(task.frequencyDays));
    setOpen(true);
  }

  function openAttachmentEdit(attachment: Attachment) {
    setEditingAttachment(attachment);
    setName(attachment.fileName);
    setDetail(attachment.caption);
    setOpen(true);
  }

  return (
    <Page>
      <PageHeader
        title="Dom"
        description="Zarządzaj swoim domem."
        action={
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <Button
              component={RouterLink}
              to="/domownicy"
              variant="outlined"
              startIcon={<Icon icon="solar:settings-bold-duotone" />}
            >
              Ustawienia
            </Button>
            <PrimaryButton
              disabled={!permission.canCreate}
              onClick={() => {
                setEditingCleaning(null);
                setEditingAttachment(null);
                setName('');
                setDetail('');
                setFile(null);
                setOpen(true);
              }}
            >
              Dodaj
            </PrimaryButton>
          </Stack>
        }
      />
      <SectionCard>
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          variant="scrollable"
          scrollButtons={false}
          sx={{
            '& .MuiTabs-flexContainer': { gap: 0.5 },
            '& .MuiTab-root': { minHeight: 52, borderRadius: 1.5 },
          }}
        >
          {homeTabs.map((item) => (
            <Tab
              key={item.value}
              value={item.value}
              icon={<Icon icon={item.icon} width={21} />}
              iconPosition="start"
              label={item.label}
            />
          ))}
        </Tabs>
      </SectionCard>
      {(tab === 'data' || tab === 'attachments') && (
        <TextField
          fullWidth
          label={tab === 'data' ? 'Szukaj w ważnych danych' : 'Szukaj dokumentu'}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          sx={{ maxWidth: 520 }}
        />
      )}
      {tab === 'attachments' && attachmentError && (
        <Alert severity="error" onClose={() => setAttachmentError(null)}>
          {attachmentError}
        </Alert>
      )}
      <SectionCard>
        <Stack direction="row" spacing={1.5} sx={{ mb: 2, alignItems: 'center' }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              display: 'grid',
              flexShrink: 0,
              placeItems: 'center',
              borderRadius: 1.5,
              color: activeMeta.color,
              bgcolor: `${activeMeta.color}18`,
            }}
          >
            <Icon icon={activeMeta.icon} width={27} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h4">{activeMeta.title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {activeMeta.count} {activeMeta.count === 1 ? 'wpis' : 'wpisów'}
            </Typography>
          </Box>
        </Stack>
        {active.isLoading ? (
          <LoadingView />
        ) : active.error ? (
          <ErrorView error={active.error} retry={() => void active.refetch()} />
        ) : tab === 'cleaning' ? (
          (cleaning.data?.length ?? 0) === 0 ? (
            <EmptyState text="Brak zaplanowanych prac." />
          ) : (
            <Stack divider={<Divider flexItem />}>
              {cleaning.data?.map((task) => (
                <Stack
                  key={task.id}
                  direction="row"
                  spacing={1}
                  sx={(theme) => ({
                    p: 2,
                    my: 0.75,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    border: '1px solid',
                    borderLeft: '5px solid',
                    borderColor: task.isOverdue ? 'error.main' : 'divider',
                    borderRadius: 1.75,
                    bgcolor: task.isOverdue ? 'rgba(255,86,109,.07)' : 'transparent',
                    ...theme.applyStyles('dark', {
                      bgcolor: task.isOverdue ? 'rgba(255,86,109,.10)' : 'rgba(255,255,255,.015)',
                    }),
                  })}
                >
                  <Box sx={{ flex: '1 1 260px', minWidth: 0 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Typography sx={{ fontWeight: 700 }}>{task.name}</Typography>
                      {task.isOverdue && <Chip size="small" color="error" label="Po terminie" />}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {task.location || 'Cały dom'} · co {task.frequencyDays} dni · termin{' '}
                      {shortDate(task.nextDueAt)}
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    startIcon={<Icon icon="solar:check-circle-bold" />}
                    onClick={() => completeCleaning.mutate(task.id)}
                    disabled={!cleaningPermission.canUpdate}
                  >
                    Wykonane
                  </Button>
                  <IconButton
                    disabled={!cleaningPermission.canUpdate}
                    onClick={() => openCleaningEdit(task)}
                  >
                    <Icon icon="solar:pen-bold-duotone" />
                  </IconButton>
                  <IconButton
                    color="error"
                    disabled={!cleaningPermission.canDelete}
                    onClick={() => confirmDelete(task.name) && removeCleaning.mutate(task.id)}
                  >
                    <Icon icon="solar:trash-bin-trash-bold-duotone" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          )
        ) : tab === 'costs' ? (
          (costs.data?.length ?? 0) === 0 ? (
            <EmptyState text="Brak kosztów rocznych." />
          ) : (
            <Stack divider={<Divider flexItem />}>
              {costs.data?.map((cost) => (
                <Stack
                  key={cost.id}
                  direction="row"
                  spacing={1.5}
                  sx={{
                    p: 2,
                    my: 0.75,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderLeft: '5px solid #55D99B',
                    borderRadius: 1.75,
                  }}
                >
                  <Box sx={{ flex: '1 1 240px' }}>
                    <Typography sx={{ fontWeight: 700 }}>{cost.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Termin {shortDate(cost.nextDueDate)}
                    </Typography>
                  </Box>
                  <Typography variant="h3">
                    {cost.defaultAmount ? money(cost.defaultAmount, currency) : '—'}
                  </Typography>
                  <Button
                    variant="outlined"
                    disabled={!costsPermission.canUpdate}
                    onClick={() => {
                      setCompletionCostId(cost.id);
                      setDate(todayIso());
                      setAmount(cost.defaultAmount ?? '');
                    }}
                  >
                    Opłacone
                  </Button>
                </Stack>
              ))}
            </Stack>
          )
        ) : tab === 'data' ? (
          (data.data?.length ?? 0) === 0 ? (
            <EmptyState text="Brak zapisanych danych." />
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                gap: 2,
              }}
            >
              {data.data?.map((entry) => (
                <SectionCard
                  key={entry.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedDataEntry(entry)}
                  onKeyDown={(event) => event.key === 'Enter' && setSelectedDataEntry(entry)}
                  sx={{ bgcolor: 'action.hover', cursor: 'pointer' }}
                >
                  <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="overline" color="text.secondary">
                        {entry.title}
                      </Typography>
                      <Typography variant="h3" sx={{ wordBreak: 'break-word' }}>
                        {entry.value}
                      </Typography>
                    </Box>
                    <IconButton
                      color="error"
                      disabled={!dataPermission.canDelete}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (confirmDelete(entry.title)) removeData.mutate(entry.id);
                      }}
                    >
                      <Icon icon="solar:trash-bin-trash-bold-duotone" />
                    </IconButton>
                  </Stack>
                </SectionCard>
              ))}
            </Box>
          )
        ) : (attachments.data?.length ?? 0) === 0 ? (
          <EmptyState text="Brak dokumentów i zdjęć." />
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
              gap: 2,
            }}
          >
            {attachments.data?.map((attachment) => (
              <SectionCard key={attachment.id} sx={{ bgcolor: 'action.hover' }}>
                <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                  <AttachmentThumbnail accessToken={accessToken} attachment={attachment} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700 }} noWrap>
                      {attachment.fileName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {attachment.caption || shortDate(attachment.createdAt)}
                    </Typography>
                  </Box>
                  <Stack
                    direction="row"
                    sx={{
                      width: { xs: '100%', sm: 'auto' },
                      justifyContent: { xs: 'flex-end', sm: 'initial' },
                    }}
                  >
                    <IconButton
                      aria-label="Otwórz podgląd"
                      onClick={() => void previewAttachment(attachment)}
                    >
                      <Icon icon="solar:eye-bold-duotone" />
                    </IconButton>
                    <IconButton
                      aria-label="Pobierz plik"
                      onClick={() => void downloadAttachment(attachment)}
                    >
                      <Icon icon="solar:download-bold-duotone" />
                    </IconButton>
                    <IconButton
                      aria-label="Edytuj opis pliku"
                      disabled={!attachmentsPermission.canUpdate}
                      onClick={() => openAttachmentEdit(attachment)}
                    >
                      <Icon icon="solar:pen-bold-duotone" />
                    </IconButton>
                    <IconButton
                      color="error"
                      aria-label="Usuń plik"
                      disabled={!attachmentsPermission.canDelete}
                      onClick={() =>
                        confirmDelete(attachment.fileName) && removeAttachment.mutate(attachment.id)
                      }
                    >
                      <Icon icon="solar:trash-bin-trash-bold-duotone" />
                    </IconButton>
                  </Stack>
                </Stack>
              </SectionCard>
            ))}
          </Box>
        )}
      </SectionCard>
      <FormDialog
        title={previewingAttachment?.fileName ?? 'Podgląd pliku'}
        subtitle={previewingAttachment?.caption || 'Dokument zapisany w HomeApp.'}
        icon="solar:gallery-wide-bold-duotone"
        open={Boolean(previewingAttachment)}
        onClose={closeAttachmentPreview}
        onSubmit={() => undefined}
        hideSubmit
        maxWidth="lg"
      >
        {previewLoading ? (
          <LoadingView />
        ) : attachmentError ? (
          <Alert severity="error">{attachmentError}</Alert>
        ) : previewUrl && previewingAttachment?.mimeType === 'application/pdf' ? (
          <Box
            component="iframe"
            src={previewUrl}
            title={previewingAttachment.fileName}
            sx={{ width: 1, height: '72vh', border: 0, borderRadius: 1.5, bgcolor: 'common.white' }}
          />
        ) : previewUrl ? (
          <Box
            component="img"
            src={previewUrl}
            alt={previewingAttachment?.fileName ?? 'Podgląd załącznika'}
            sx={{ width: 1, maxHeight: '72vh', objectFit: 'contain', borderRadius: 1.5 }}
          />
        ) : null}
      </FormDialog>
      {tab === 'costs' && (
        <SectionCard title="Historia opłat">
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
            <TextField
              label="Rok"
              type="number"
              value={historyYear}
              onChange={(event) => setHistoryYear(Number(event.target.value))}
              sx={{ width: 140 }}
            />
          </Stack>
          {costHistory.isLoading ? (
            <LoadingView />
          ) : (costHistory.data?.length ?? 0) === 0 ? (
            <EmptyState text="Brak opłaconych kosztów w tym roku." />
          ) : (
            <Stack divider={<Divider flexItem />}>
              {costHistory.data?.map((entry) => (
                <Stack key={entry.id} direction="row" sx={{ py: 1.2 }}>
                  <Typography sx={{ flex: 1, fontWeight: 700 }}>{entry.annualCostName}</Typography>
                  <Typography color="text.secondary">{shortDate(entry.executedAt)}</Typography>
                  <Typography sx={{ ml: 2 }}>
                    {entry.amount ? money(entry.amount, currency) : '—'}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}
        </SectionCard>
      )}
      <FormDialog
        title={selectedDataEntry?.title ?? 'Ważne dane'}
        subtitle="Wartość zapisana w domowej bazie danych."
        icon="solar:database-bold-duotone"
        open={Boolean(selectedDataEntry)}
        onClose={() => setSelectedDataEntry(null)}
        onSubmit={() => setSelectedDataEntry(null)}
        cancelLabel="Zamknij"
        hideSubmit
      >
        <Typography variant="h4" sx={{ py: 2, wordBreak: 'break-word' }}>
          {selectedDataEntry?.value}
        </Typography>
        {selectedDataEntry && dataPermission.canDelete && (
          <Button
            color="error"
            variant="outlined"
            startIcon={<Icon icon="solar:trash-bin-trash-bold-duotone" />}
            onClick={() => {
              if (confirmDelete(selectedDataEntry.title)) {
                removeData.mutate(selectedDataEntry.id);
                setSelectedDataEntry(null);
              }
            }}
          >
            Usuń wpis
          </Button>
        )}
      </FormDialog>
      <FormDialog
        title="Zapisz opłacony koszt"
        subtitle="Podaj faktyczną kwotę i datę płatności."
        icon="solar:bill-check-bold-duotone"
        open={completionCostId !== null}
        onClose={() => setCompletionCostId(null)}
        onSubmit={() => completeCost.mutate()}
        loading={completeCost.isPending}
        submitLabel="Zapisz płatność"
      >
        {completeCost.error && <Alert severity="error">{completeCost.error.message}</Alert>}
        <TextField
          label="Faktyczna kwota"
          type="number"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
        />
        <TextField
          label="Data płatności"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </FormDialog>
      <FormDialog
        title={
          tab === 'cleaning'
            ? editingCleaning
              ? 'Edytuj zadanie domowe'
              : 'Nowe zadanie domowe'
            : tab === 'costs'
              ? 'Nowy koszt roczny'
              : tab === 'data'
                ? 'Nowy wpis'
                : editingAttachment
                  ? 'Edytuj dokument'
                  : 'Dodaj dokument'
        }
        subtitle={
          tab === 'cleaning'
            ? 'Nazwa, miejsce i cykl wykonywania.'
            : tab === 'costs'
              ? 'Dodaj cykliczny koszt domu.'
              : tab === 'data'
                ? 'Zapisz ważną informację w bezpiecznym miejscu.'
                : 'Dodaj zdjęcie lub dokument PDF.'
        }
        icon={activeMeta.icon}
        open={open}
        onClose={() => {
          setOpen(false);
          setEditingCleaning(null);
          setEditingAttachment(null);
          setFile(null);
        }}
        onSubmit={() => create.mutate()}
        loading={create.isPending}
        submitDisabled={
          !name.trim() ||
          (tab === 'data' && !detail.trim()) ||
          ((tab === 'cleaning' || tab === 'costs') && !date) ||
          (tab === 'attachments' && !editingAttachment && !file)
        }
      >
        {create.error && <Alert severity="error">{create.error.message}</Alert>}
        <TextField
          label={tab === 'data' ? 'Nazwa pola' : tab === 'attachments' ? 'Nazwa pliku' : 'Nazwa'}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
        {tab !== 'costs' && tab !== 'attachments' && (
          <TextField
            label={tab === 'cleaning' ? 'Pomieszczenie' : 'Wartość'}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            required={tab === 'data'}
          />
        )}
        {tab === 'attachments' && (
          <>
            {!editingAttachment && (
              <Button variant="outlined" component="label">
                {file ? file.name : 'Wybierz JPG, PNG, WEBP lub PDF'}
                <input
                  hidden
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(event) => {
                    const selectedFile = event.target.files?.[0] ?? null;
                    setFile(selectedFile);
                    if (selectedFile && !name) setName(selectedFile.name);
                  }}
                />
              </Button>
            )}
            <TextField
              label="Opis"
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
              multiline
              minRows={2}
            />
          </>
        )}
        {tab === 'cleaning' && (
          <TextField
            label="Powtarzaj co ile dni"
            type="number"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            slotProps={{ htmlInput: { min: 1 } }}
          />
        )}
        {tab === 'costs' && (
          <TextField
            label="Domyślna kwota"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
          />
        )}
        {(tab === 'cleaning' || tab === 'costs') && (
          <TextField
            label={tab === 'cleaning' ? 'Następny termin' : 'Termin płatności'}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        )}
      </FormDialog>
    </Page>
  );
}

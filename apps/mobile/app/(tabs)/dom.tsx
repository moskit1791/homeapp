import type { ModuleKey } from '@homeapp/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import {
  CalendarClock,
  Check,
  FileText,
  RefreshCcw,
  Search,
  Sparkles,
  Trash2
} from '../../src/ui/icon';
import {
  queryKeys,
  createAnnualCost,
  createAttachmentRecord,
  createCleaningTask,
  createDataEntry,
  deleteDataEntry,
  completeAnnualCost,
  completeCleaningTask,
  listAnnualCostHistory,
  listAnnualCosts,
  listAttachments,
  listCleaningTasks,
  listDataEntries,
  type AnnualCost,
  type Attachment,
  type CleaningTask,
  type DataEntry
} from '../../src/api';
import { usePermissions } from '../../src/permissions/use-permissions';
import { useSession } from '../../src/session/session-context';
import { radii, spacing } from '../../src/theme/tokens';
import { useAppTheme, type AppPalette } from '../../src/theme/use-app-theme';
import {
  ActionButton,
  AppScreen,
  IconButton,
  InlineAlert,
  QueryState,
  SectionCard,
  SegmentedControl
} from '../../src/ui';

type HomeSegment = 'cleaning' | 'annual_costs' | 'data_entries' | 'attachments';

type Accent = {
  color: string;
  soft: string;
};

const segments: Array<{ label: string; value: HomeSegment }> = [
  { label: 'Sprzątanie', value: 'cleaning' },
  { label: 'Koszty', value: 'annual_costs' },
  { label: 'Dane', value: 'data_entries' },
  { label: 'Pliki', value: 'attachments' }
];

export default function DomScreen() {
  const { session } = useSession();
  const permissionsQuery = usePermissions();
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const [activeSegment, setActiveSegment] = useState<HomeSegment>('cleaning');
  const accessToken = session?.accessToken;

  const availableSegments = useMemo(
    () =>
      segments.filter((segment) => hasReadPermission(permissionsQuery.data, segment.value)),
    [permissionsQuery.data]
  );

  useEffect(() => {
    if (
      permissionsQuery.isSuccess &&
      availableSegments.length > 0 &&
      !availableSegments.some((segment) => segment.value === activeSegment)
    ) {
      const firstSegment = availableSegments[0];

      if (firstSegment) {
        setActiveSegment(firstSegment.value);
      }
    }
  }, [activeSegment, availableSegments, permissionsQuery.isSuccess]);

  if (permissionsQuery.isLoading) {
    return (
      <AppScreen title="Dom">
        <QueryState isLoading />
      </AppScreen>
    );
  }

  if (permissionsQuery.isSuccess && availableSegments.length === 0) {
    return (
      <AppScreen title="Dom">
        <InlineAlert tone="info" text="Nie masz uprawnienia do żadnego modułu domowego." />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      subtitle="Sprzątanie, koszty, dane i pliki w czytelnych sekcjach."
      title="Dom"
    >
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Sparkles color={theme.colors.primary} size={23} />
        </View>
        <View style={styles.heroContent}>
          <Text style={styles.heroKicker}>Centrum domu</Text>
          <Text style={styles.heroTitle}>Wybierz obszar i dopisz to, co ma nie zginąć.</Text>
          <View style={styles.moduleGrid}>
            {(availableSegments.length ? availableSegments : segments).map((segment) => (
              <ModulePill
                active={segment.value === activeSegment}
                colors={theme.colors}
                key={segment.value}
                segment={segment.value}
                text={segment.label}
              />
            ))}
          </View>
        </View>
      </View>

      <SegmentedControl
        onChange={setActiveSegment}
        options={availableSegments.length ? availableSegments : segments}
        value={activeSegment}
      />

      {activeSegment === 'cleaning' ? <CleaningPanel accessToken={accessToken} /> : null}
      {activeSegment === 'annual_costs' ? <AnnualCostsPanel accessToken={accessToken} /> : null}
      {activeSegment === 'data_entries' ? <DataEntriesPanel accessToken={accessToken} /> : null}
      {activeSegment === 'attachments' ? <AttachmentsPanel accessToken={accessToken} /> : null}
    </AppScreen>
  );
}

function CleaningPanel({ accessToken }: { accessToken?: string }) {
  const queryClient = useQueryClient();
  const permission = useModuleAccess('cleaning');
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const accent = getSegmentAccent(theme.colors, 'cleaning');
  const [name, setName] = useState('');
  const [frequencyDays, setFrequencyDays] = useState('7');
  const [nextDueAt, setNextDueAt] = useState(todayIso());

  const tasksQuery = useQuery({
    enabled: permission.canRead && Boolean(accessToken),
    queryFn: () => listCleaningTasks({ accessToken }),
    queryKey: [...queryKeys.cleaning, 'tasks']
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createCleaningTask(
        {
          completionWindowDays: 0,
          frequencyDays: Number(frequencyDays) || 1,
          frequencyMode: 'preset',
          name: name.trim(),
          nextDueAt
        },
        { accessToken }
      ),
    onSuccess: async () => {
      setName('');
      await queryClient.invalidateQueries({ queryKey: queryKeys.cleaning });
    }
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => completeCleaningTask(id, { completedAt: todayIso() }, { accessToken }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.cleaning })
  });

  const tasks = tasksQuery.data ?? [];
  const overdueCount = tasks.filter((task) => task.isOverdue).length;
  const canAdd = permission.canCreate && Boolean(name.trim()) && !createMutation.isPending;

  return (
    <Panel
      accent={accent}
      icon={<Sparkles color={accent.color} size={18} />}
      onRefresh={() => tasksQuery.refetch()}
      subtitle={`${tasks.length} zadań / ${overdueCount} po terminie`}
      title="Sprzątanie"
    >
      {permission.canCreate ? (
        <FormBlock accent={accent} title="Nowe zadanie">
          <TextInput
            onChangeText={setName}
            placeholder="Nazwa zadania"
            placeholderTextColor={theme.colors.textSubtle}
            style={styles.input}
            value={name}
          />
          <View style={styles.formRow}>
            <TextInput
              keyboardType="number-pad"
              onChangeText={setFrequencyDays}
              placeholder="Co ile dni"
              placeholderTextColor={theme.colors.textSubtle}
              style={[styles.input, styles.flexInput]}
              value={frequencyDays}
            />
            <TextInput
              onChangeText={setNextDueAt}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.colors.textSubtle}
              style={[styles.input, styles.dateInput]}
              value={nextDueAt}
            />
          </View>
          <InlineButton disabled={!canAdd} onPress={() => createMutation.mutate()} title="Dodaj" />
          {createMutation.error ? <InlineAlert tone="error" text="Nie udało się dodać zadania." /> : null}
        </FormBlock>
      ) : null}

      <QueryState
        emptyText="Brak zadań sprzątania."
        error={tasksQuery.error}
        isEmpty={!tasksQuery.isLoading && !tasksQuery.error && tasks.length === 0}
        isLoading={tasksQuery.isLoading}
      />
      <View style={styles.itemList}>
        {tasks.map((task) => (
          <CleaningRow
            accent={accent}
            canUpdate={permission.canUpdate}
            completing={completeMutation.isPending}
            key={task.id}
            onComplete={() => completeMutation.mutate(task.id)}
            task={task}
          />
        ))}
      </View>
    </Panel>
  );
}

function AnnualCostsPanel({ accessToken }: { accessToken?: string }) {
  const queryClient = useQueryClient();
  const permission = useModuleAccess('annual_costs');
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const accent = getSegmentAccent(theme.colors, 'annual_costs');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [nextDueDate, setNextDueDate] = useState(todayIso());
  const year = new Date().getFullYear();

  const costsQuery = useQuery({
    enabled: permission.canRead && Boolean(accessToken),
    queryFn: () => listAnnualCosts({ accessToken }),
    queryKey: [...queryKeys.annualCosts, 'items']
  });

  const historyQuery = useQuery({
    enabled: permission.canRead && Boolean(accessToken),
    queryFn: () => listAnnualCostHistory(year, { accessToken }),
    queryKey: [...queryKeys.annualCosts, 'history', year]
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createAnnualCost(
        {
          defaultAmount: parseOptionalNumber(amount),
          name: name.trim(),
          nextDueDate
        },
        { accessToken }
      ),
    onSuccess: async () => {
      setName('');
      setAmount('');
      await queryClient.invalidateQueries({ queryKey: queryKeys.annualCosts });
    }
  });

  const completeMutation = useMutation({
    mutationFn: (cost: AnnualCost) =>
      completeAnnualCost(
        cost.id,
        {
          amount: parseOptionalNumber(String(cost.defaultAmount ?? '')),
          executedAt: todayIso()
        },
        { accessToken }
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.annualCosts })
  });

  const costs = costsQuery.data ?? [];
  const history = historyQuery.data ?? [];
  const canAdd = permission.canCreate && Boolean(name.trim()) && !createMutation.isPending;

  return (
    <Panel
      accent={accent}
      icon={<CalendarClock color={accent.color} size={18} />}
      onRefresh={() => {
        costsQuery.refetch();
        historyQuery.refetch();
      }}
      subtitle={`${costs.length} cyklicznych pozycji / ${history.length} wpisów w ${year}`}
      title="Koszty roczne"
    >
      {permission.canCreate ? (
        <FormBlock accent={accent} title="Nowy koszt">
          <TextInput
            onChangeText={setName}
            placeholder="Nazwa kosztu"
            placeholderTextColor={theme.colors.textSubtle}
            style={styles.input}
            value={name}
          />
          <View style={styles.formRow}>
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={setAmount}
              placeholder="Kwota"
              placeholderTextColor={theme.colors.textSubtle}
              style={[styles.input, styles.flexInput]}
              value={amount}
            />
            <TextInput
              onChangeText={setNextDueDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.colors.textSubtle}
              style={[styles.input, styles.dateInput]}
              value={nextDueDate}
            />
          </View>
          <InlineButton disabled={!canAdd} onPress={() => createMutation.mutate()} title="Dodaj" />
          {createMutation.error ? <InlineAlert tone="error" text="Nie udało się dodać kosztu." /> : null}
        </FormBlock>
      ) : null}

      <QueryState
        emptyText="Brak kosztów rocznych."
        error={costsQuery.error}
        isEmpty={!costsQuery.isLoading && !costsQuery.error && costs.length === 0}
        isLoading={costsQuery.isLoading}
      />
      <View style={styles.itemList}>
        {costs.map((cost) => (
          <CostRow
            accent={accent}
            canUpdate={permission.canUpdate}
            completing={completeMutation.isPending}
            cost={cost}
            key={cost.id}
            onComplete={() => completeMutation.mutate(cost)}
          />
        ))}
      </View>

      {history.length > 0 ? (
        <View style={styles.subSection}>
          <Text style={styles.sectionTitle}>Historia {year}</Text>
          {history.slice(0, 5).map((item) => (
            <SmallRow
              key={item.id}
              meta={item.executedAt}
              title={`${item.annualCostName} / ${formatMoney(item.amount)}`}
            />
          ))}
        </View>
      ) : null}
    </Panel>
  );
}

function DataEntriesPanel({ accessToken }: { accessToken?: string }) {
  const queryClient = useQueryClient();
  const permission = useModuleAccess('data_entries');
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const accent = getSegmentAccent(theme.colors, 'data_entries');
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');

  const entriesQuery = useQuery({
    enabled: permission.canRead && Boolean(accessToken),
    queryFn: () => listDataEntries(search.trim() || undefined, { accessToken }),
    queryKey: [...queryKeys.dataEntries, search.trim()]
  });

  const createMutation = useMutation({
    mutationFn: () => createDataEntry({ title: title.trim(), value: value.trim() }, { accessToken }),
    onSuccess: async () => {
      setTitle('');
      setValue('');
      await queryClient.invalidateQueries({ queryKey: queryKeys.dataEntries });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDataEntry(id, { accessToken }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.dataEntries })
  });

  const entries = entriesQuery.data ?? [];
  const canAdd = permission.canCreate && Boolean(title.trim()) && !createMutation.isPending;

  return (
    <Panel
      accent={accent}
      icon={<Search color={accent.color} size={18} />}
      onRefresh={() => entriesQuery.refetch()}
      subtitle={`${entries.length} zapisanych wpisów`}
      title="Dane"
    >
      <SearchBlock accent={accent}>
        <TextInput
          onChangeText={setSearch}
          placeholder="Szukaj danych"
          placeholderTextColor={theme.colors.textSubtle}
          style={styles.searchInput}
          value={search}
        />
      </SearchBlock>

      {permission.canCreate ? (
        <FormBlock accent={accent} title="Nowy wpis">
          <TextInput
            onChangeText={setTitle}
            placeholder="Tytuł"
            placeholderTextColor={theme.colors.textSubtle}
            style={styles.input}
            value={title}
          />
          <TextInput
            multiline
            onChangeText={setValue}
            placeholder="Wartość"
            placeholderTextColor={theme.colors.textSubtle}
            style={[styles.input, styles.multilineInput]}
            value={value}
          />
          <InlineButton disabled={!canAdd} onPress={() => createMutation.mutate()} title="Dodaj" />
          {createMutation.error ? <InlineAlert tone="error" text="Nie udało się dodać wpisu." /> : null}
        </FormBlock>
      ) : null}

      <QueryState
        emptyText="Brak zapisanych danych."
        error={entriesQuery.error}
        isEmpty={!entriesQuery.isLoading && !entriesQuery.error && entries.length === 0}
        isLoading={entriesQuery.isLoading}
      />
      <View style={styles.itemList}>
        {entries.map((entry) => (
          <DataRow
            accent={accent}
            canDelete={permission.canDelete}
            deleting={deleteMutation.isPending}
            entry={entry}
            key={entry.id}
            onDelete={() => deleteMutation.mutate(entry.id)}
          />
        ))}
      </View>
    </Panel>
  );
}

function AttachmentsPanel({ accessToken }: { accessToken?: string }) {
  const queryClient = useQueryClient();
  const permission = useModuleAccess('attachments');
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const accent = getSegmentAccent(theme.colors, 'attachments');
  const [search, setSearch] = useState('');
  const [fileName, setFileName] = useState('');
  const [storagePath, setStoragePath] = useState('');
  const [caption, setCaption] = useState('');
  const [mimeType, setMimeType] = useState<Attachment['mimeType']>('application/pdf');

  const attachmentsQuery = useQuery({
    enabled: permission.canRead && Boolean(accessToken),
    queryFn: () => listAttachments(search.trim() || undefined, { accessToken }),
    queryKey: [...queryKeys.attachments, search.trim()]
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createAttachmentRecord(
        {
          caption: caption.trim() || undefined,
          fileName: fileName.trim(),
          mimeType,
          storagePath: storagePath.trim()
        },
        { accessToken }
      ),
    onSuccess: async () => {
      setFileName('');
      setStoragePath('');
      setCaption('');
      await queryClient.invalidateQueries({ queryKey: queryKeys.attachments });
    }
  });

  const attachments = attachmentsQuery.data ?? [];
  const canAdd =
    permission.canCreate &&
    Boolean(fileName.trim()) &&
    Boolean(storagePath.trim()) &&
    !createMutation.isPending;

  return (
    <Panel
      accent={accent}
      icon={<FileText color={accent.color} size={18} />}
      onRefresh={() => attachmentsQuery.refetch()}
      subtitle={`${attachments.length} rekordów plików`}
      title="Załączniki"
    >
      <SearchBlock accent={accent}>
        <TextInput
          onChangeText={setSearch}
          placeholder="Szukaj plików"
          placeholderTextColor={theme.colors.textSubtle}
          style={styles.searchInput}
          value={search}
        />
      </SearchBlock>

      {permission.canCreate ? (
        <FormBlock accent={accent} title="Nowy załącznik">
          <TextInput
            onChangeText={setFileName}
            placeholder="Nazwa pliku"
            placeholderTextColor={theme.colors.textSubtle}
            style={styles.input}
            value={fileName}
          />
          <TextInput
            onChangeText={setStoragePath}
            placeholder="Ścieżka storage"
            placeholderTextColor={theme.colors.textSubtle}
            style={styles.input}
            value={storagePath}
          />
          <TextInput
            onChangeText={setCaption}
            placeholder="Opis"
            placeholderTextColor={theme.colors.textSubtle}
            style={styles.input}
            value={caption}
          />
          <SegmentedControl
            onChange={setMimeType}
            options={(['application/pdf', 'image/jpeg', 'image/png'] as Attachment['mimeType'][]).map((type) => ({
              label: type === 'application/pdf' ? 'PDF' : type.replace('image/', '').toUpperCase(),
              value: type
            }))}
            value={mimeType}
          />
          <InlineButton disabled={!canAdd} onPress={() => createMutation.mutate()} title="Dodaj rekord" />
          {createMutation.error ? <InlineAlert tone="error" text="Nie udało się dodać załącznika." /> : null}
        </FormBlock>
      ) : null}

      <QueryState
        emptyText="Brak załączników."
        error={attachmentsQuery.error}
        isEmpty={!attachmentsQuery.isLoading && !attachmentsQuery.error && attachments.length === 0}
        isLoading={attachmentsQuery.isLoading}
      />
      <View style={styles.itemList}>
        {attachments.map((attachment) => (
          <AttachmentRow accent={accent} attachment={attachment} key={attachment.id} />
        ))}
      </View>
    </Panel>
  );
}

function CleaningRow({
  accent,
  canUpdate,
  completing,
  onComplete,
  task
}: {
  accent: Accent;
  canUpdate: boolean;
  completing: boolean;
  onComplete: () => void;
  task: CleaningTask;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <View style={[styles.itemRow, { borderLeftColor: task.isOverdue ? theme.colors.warning : accent.color }, task.isOverdue && styles.warningRow]}>
      <View style={styles.itemContent}>
        <Text style={styles.itemName}>{task.name}</Text>
        <Text style={styles.itemMeta}>Termin: {task.nextDueAt} / co {task.frequencyDays} dni</Text>
      </View>
      <IconButton disabled={!canUpdate || completing} onPress={onComplete}>
        <Check color={accent.color} size={17} />
      </IconButton>
    </View>
  );
}

function CostRow({
  accent,
  canUpdate,
  completing,
  cost,
  onComplete
}: {
  accent: Accent;
  canUpdate: boolean;
  completing: boolean;
  cost: AnnualCost;
  onComplete: () => void;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <View style={[styles.itemRow, { borderLeftColor: accent.color }]}>
      <View style={styles.itemContent}>
        <Text style={styles.itemName}>{cost.name}</Text>
        <Text style={styles.itemMeta}>
          {cost.nextDueDate} / {formatMoney(cost.defaultAmount)}
        </Text>
      </View>
      <IconButton disabled={!canUpdate || completing} onPress={onComplete}>
        <Check color={accent.color} size={17} />
      </IconButton>
    </View>
  );
}

function DataRow({
  accent,
  canDelete,
  deleting,
  entry,
  onDelete
}: {
  accent: Accent;
  canDelete: boolean;
  deleting: boolean;
  entry: DataEntry;
  onDelete: () => void;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <View style={[styles.itemRow, { borderLeftColor: accent.color }]}>
      <View style={styles.itemContent}>
        <Text style={styles.itemName}>{entry.title}</Text>
        <Text numberOfLines={2} style={styles.itemMeta}>{entry.value}</Text>
      </View>
      {canDelete ? (
        <IconButton disabled={deleting} onPress={onDelete}>
          <Trash2 color={theme.colors.danger} size={17} />
        </IconButton>
      ) : null}
    </View>
  );
}

function AttachmentRow({ accent, attachment }: { accent: Accent; attachment: Attachment }) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <View style={[styles.itemRow, { borderLeftColor: accent.color }]}>
      <View style={styles.itemContent}>
        <Text style={styles.itemName}>{attachment.fileName}</Text>
        <Text style={styles.itemMeta}>
          {attachment.mimeType} / {attachment.caption || attachment.storagePath}
        </Text>
      </View>
    </View>
  );
}

function Panel({
  accent,
  children,
  icon,
  onRefresh,
  subtitle,
  title
}: {
  accent: Accent;
  children: ReactNode;
  icon: ReactNode;
  onRefresh: () => void;
  subtitle: string;
  title: string;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <SectionCard
      action={
        <IconButton onPress={onRefresh}>
          <RefreshCcw color={theme.colors.textMuted} size={18} />
        </IconButton>
      }
      icon={icon}
      subtitle={subtitle}
      title={title}
    >
      <View style={[styles.panelAccent, { backgroundColor: accent.soft }]} />
      {children}
    </SectionCard>
  );
}

function FormBlock({ accent, children, title }: { accent: Accent; children: ReactNode; title: string }) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <View style={[styles.formCard, { borderColor: accent.soft }]}>
      <Text style={[styles.formTitle, { color: accent.color }]}>{title}</Text>
      {children}
    </View>
  );
}

function SearchBlock({ accent, children }: { accent: Accent; children: ReactNode }) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <View style={[styles.searchBlock, { backgroundColor: accent.soft }]}>
      <Search color={accent.color} size={18} />
      {children}
    </View>
  );
}

function ModulePill({
  active,
  colors,
  segment,
  text
}: {
  active: boolean;
  colors: AppPalette;
  segment: HomeSegment;
  text: string;
}) {
  const styles = createStyles(colors);
  const accent = getSegmentAccent(colors, segment);

  return (
    <View style={[styles.modulePill, { backgroundColor: active ? accent.color : accent.soft }]}>
      <Text style={[styles.modulePillText, { color: active ? colors.inverseText : accent.color }]}>{text}</Text>
    </View>
  );
}

function SmallRow({ meta, title }: { meta: string; title: string }) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <View style={styles.smallRow}>
      <Text style={styles.itemName}>{title}</Text>
      <Text style={styles.itemMeta}>{meta}</Text>
    </View>
  );
}

function InlineButton({
  disabled,
  onPress,
  title
}: {
  disabled?: boolean;
  onPress: () => void;
  title: string;
}) {
  return (
    <ActionButton
      disabled={disabled}
      onPress={onPress}
      style={staticStyles.inlineButton}
      title={title}
    />
  );
}

function useModuleAccess(moduleKey: ModuleKey) {
  const permissionsQuery = usePermissions();
  const permission = permissionsQuery.data?.find((item) => item.moduleKey === moduleKey);

  return {
    canCreate: Boolean(permission?.canCreate),
    canDelete: Boolean(permission?.canDelete),
    canRead: Boolean(permission?.canRead),
    canUpdate: Boolean(permission?.canUpdate)
  };
}

function hasReadPermission(
  permissions: Array<{ canRead: boolean; moduleKey: ModuleKey }> | undefined,
  moduleKey: ModuleKey
) {
  return Boolean(permissions?.find((permission) => permission.moduleKey === moduleKey)?.canRead);
}

function getSegmentAccent(colors: AppPalette, segment: HomeSegment): Accent {
  const accents: Record<HomeSegment, Accent> = {
    annual_costs: { color: colors.finance, soft: colors.softGreen },
    attachments: { color: colors.shopping, soft: colors.softPurple },
    cleaning: { color: colors.primary, soft: colors.primarySoft },
    data_entries: { color: colors.calendar, soft: colors.softBlue }
  };

  return accents[segment];
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function parseOptionalNumber(value: string): number | null {
  const normalized = value.replace(',', '.').trim();

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return 'bez kwoty';
  }

  return `${Number(value).toLocaleString('pl-PL', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  })} zł`;
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    dateInput: {
      minWidth: 132
    },
    flexInput: {
      flex: 1
    },
    formCard: {
      backgroundColor: colors.cardMuted,
      borderRadius: radii.control,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.md
    },
    formRow: {
      flexDirection: 'row',
      gap: spacing.sm
    },
    formTitle: {
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0,
      textTransform: 'uppercase'
    },
    hero: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.md,
      padding: spacing.lg
    },
    heroContent: {
      flex: 1,
      gap: spacing.sm
    },
    heroIcon: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: radii.control,
      height: 48,
      justifyContent: 'center',
      width: 48
    },
    heroKicker: {
      color: colors.primaryDark,
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0,
      textTransform: 'uppercase'
    },
    heroTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: 0,
      lineHeight: 25
    },
    input: {
      backgroundColor: colors.field,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      color: colors.text,
      fontSize: 15,
      letterSpacing: 0,
      minHeight: 46,
      paddingHorizontal: spacing.md
    },
    itemContent: {
      flex: 1,
      gap: spacing.xs,
      paddingRight: spacing.sm
    },
    itemList: {
      gap: spacing.sm
    },
    itemMeta: {
      color: colors.textMuted,
      fontSize: 12,
      letterSpacing: 0,
      lineHeight: 17
    },
    itemName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
      letterSpacing: 0,
      lineHeight: 19
    },
    itemRow: {
      alignItems: 'center',
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      borderLeftWidth: 4,
      flexDirection: 'row',
      gap: spacing.sm,
      minHeight: 60,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm
    },
    moduleGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm
    },
    modulePill: {
      borderRadius: 999,
      overflow: 'hidden',
      paddingHorizontal: spacing.sm,
      paddingVertical: 6
    },
    modulePillText: {
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0
    },
    multilineInput: {
      minHeight: 92,
      paddingTop: spacing.sm,
      textAlignVertical: 'top'
    },
    panelAccent: {
      borderRadius: 999,
      height: 6
    },
    searchBlock: {
      alignItems: 'center',
      borderRadius: radii.control,
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs
    },
    searchInput: {
      color: colors.text,
      flex: 1,
      fontSize: 15,
      letterSpacing: 0,
      minHeight: 40,
      paddingHorizontal: spacing.xs
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '900',
      letterSpacing: 0
    },
    smallRow: {
      backgroundColor: colors.cardMuted,
      borderRadius: radii.control,
      gap: spacing.xs,
      padding: spacing.md
    },
    subSection: {
      gap: spacing.sm,
      marginTop: spacing.sm
    },
    warningRow: {
      backgroundColor: colors.warningSoft
    }
  });
}

const staticStyles = StyleSheet.create({
  inlineButton: {
    alignSelf: 'flex-start'
  }
});

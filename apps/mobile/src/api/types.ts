import type {
  AccountStatus,
  CleaningFrequencyMode,
  EncryptableModuleKey,
  HouseholdMemberRole,
  ModuleKey,
  PermissionSet,
  RealtimeEvent as SharedRealtimeEvent,
  RealtimeEventType,
  ScopeType,
  ShoppingCategory,
  ShoppingListType,
} from "@homeapp/shared-types";

export type RealtimeEvent = SharedRealtimeEvent;

export type EffectivePermission = PermissionSet;

export type { EncryptableModuleKey, ModuleKey, ShoppingListType };

export interface ClientEncryptedRecord {
  encryptedPayload: string | null;
  encryptionEntity: string;
  encryptionVersion: number | null;
}

export interface ClientEncryptedWrite {
  encryptedPayload?: string;
  encryptionVersion?: number;
}

export interface ApiUser {
  accountStatus: AccountStatus;
  authProviderUserId: string;
  displayName: string;
  email: string;
  id: string;
}

export interface RegisterRequest {
  displayName: string;
  email: string;
  password: string;
}

export type RegisterInput = RegisterRequest;

export interface RegisterResponse {
  devVerificationToken?: string;
  user: ApiUser;
}

export interface VerifyEmailRequest {
  email: string;
  token: string;
}

export interface OkResponse {
  ok: true;
}

export type VerifyEmailResponse = OkResponse;

export interface ResendVerificationRequest {
  email: string;
}

export interface ResendVerificationResponse extends OkResponse {
  devVerificationToken?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse extends OkResponse {
  devResetToken?: string;
}

export interface ResetPasswordRequest {
  password: string;
  token: string;
}

export type ResetPasswordResponse = OkResponse;
export type DeleteAccountResponse = OkResponse;

export interface GoogleLoginRequest {
  idToken: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export type LoginInput = LoginRequest;

export interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export interface CreateHouseholdRequest {
  currencyCode?: string;
  mealSlotsPerDay?: number;
  name: string;
}

export type CreateHouseholdInput = CreateHouseholdRequest;
export type UpdateHouseholdRequest = Partial<CreateHouseholdRequest>;

export interface Household {
  currencyCode: string;
  id: string;
  mealSlotsPerDay: number;
  name: string;
  weekStartsOn: number;
}

export interface HouseholdEncryptionSettings {
  canManage: boolean;
  configured: boolean;
  enabledModules: EncryptableModuleKey[];
  householdId: string;
  kdfSalt: string | null;
  keyVersion: number | null;
  recoveryWrappedKey: string | null;
  updatedAt: string | null;
  wrappedKey: string | null;
}

export interface UpdateHouseholdEncryptionRequest {
  enabledModules: EncryptableModuleKey[];
  expectedUpdatedAt?: string | null;
  kdfSalt: string;
  keyVersion: number;
  recoveryWrappedKey: string;
  wrappedKey: string;
  migrationItems?: EncryptionMigrationItem[];
}

export interface RemoveHouseholdEncryptionRequest {
  expectedUpdatedAt: string;
  keyVersion: number;
  migrationItems?: EncryptionMigrationItem[];
}

export type EncryptionMigrationEntity =
  | "calendar-event"
  | "budget-category"
  | "budget-item"
  | "expense"
  | "income"
  | "finance-debt"
  | "finance-debt-payment"
  | "finance-savings-account"
  | "finance-savings-transaction"
  | "meal-plan-entry"
  | "meal-idea"
  | "shopping-item"
  | "todo-item"
  | "note-item"
  | "cleaning-task"
  | "annual-cost"
  | "annual-cost-history"
  | "data-entry"
  | "attachment";

export interface EncryptionMigrationItem {
  encryptedPayload?: string;
  encryptionVersion: number;
  entity: EncryptionMigrationEntity;
  id: string;
  sourceRevision: string;
  plaintextPayload?: Record<string, unknown>;
}

export interface EncryptionExportItem {
  encryptedPayload: string | null;
  encryptionVersion: number | null;
  entity: EncryptionMigrationEntity;
  id: string;
  plaintextPayload: Record<string, unknown> | null;
  sourceRevision: string;
}

export interface HouseholdMembership {
  householdId: string;
  memberId: string;
  role: HouseholdMemberRole;
}

export interface CreateHouseholdResponse {
  household: Household;
  membership: HouseholdMembership;
}

export interface StartDashboard {
  finance: StartFinanceSummary | null;
  mealPlan: StartMealPlan | null;
  todoCount: number;
  todoPreview: StartTodoItem[];
  upcomingEvents: StartCalendarEvent[];
}

export interface StartFinanceSummary {
  incomeAmount: string;
  month: StartFinanceMonth;
  totalBudgetAmount: string;
  totalRemainingAmount: string;
  totalSpentAmount: string;
}

export interface StartFinanceMonth {
  id: string;
  month: number;
  year: number;
}

export interface StartCalendarEvent {
  encryptedPayload: string | null;
  encryptionVersion: number | null;
  eventDate: string;
  eventTime: string | null;
  googleCalendarAccountEmail: string | null;
  googleCalendarConnectionId: string | null;
  googleCalendarOwnerMemberId: string | null;
  id: string;
  locationName: string | null;
  locationUrl: string | null;
  ownerMemberId: string | null;
  scopeType: ScopeType;
  sourceType: "google" | "manual";
  title: string;
}

export interface StartMealPlan {
  entries: StartMealEntry[];
  id: string;
  weekStartDate: string;
}

export interface StartMealEntry extends ClientEncryptedRecord {
  id: string;
  mealName: string;
  slotIndex: number;
  weekday: number;
}

export interface StartTodoItem extends ClientEncryptedRecord {
  createdAt: string;
  id: string;
  ownerMemberId: string | null;
  scopeType: ScopeType;
  sortOrder: number;
  title: string;
}

export interface ShoppingList {
  createdAt: string;
  householdId: string;
  id: string;
  name: string;
  type: ShoppingListType;
  updatedAt: string;
}

export interface ShoppingItem extends ClientEncryptedRecord {
  category: string | null;
  checkedAt: string | null;
  createdAt: string;
  displayOrder: number;
  expirationDate: string | null;
  householdId: string;
  id: string;
  isChecked: boolean;
  name: string;
  quantity: string;
  shoppingListId: string;
  type: ShoppingListType;
  updatedAt: string;
}

export interface CreateShoppingItemRequest extends ClientEncryptedWrite {
  category?: string | null;
  displayOrder?: number;
  expirationDate?: string | null;
  name: string;
  quantity?: string;
}

export interface UpdateShoppingItemRequest extends ClientEncryptedWrite {
  category?: string | null;
  displayOrder?: number;
  expirationDate?: string | null;
  name?: string;
  quantity?: string;
}

export interface PantryDashboard {
  items: ShoppingItem[];
  stats: {
    expiringSoon: number;
    expired: number;
    shoppingList: number;
    total: number;
  };
}

export interface MoveShoppingItemRequest {
  targetType: ShoppingListType;
}

export interface BulkShoppingResult {
  deleted?: number;
  moved?: number;
}

export interface ImportShoppingItemsWithAiRequest {
  message: string;
  planOnly?: boolean;
}

export interface ShoppingAiSourceFragment {
  id: string;
  text: string;
}

export interface ImportShoppingItemsWithAiResponse {
  ignoredSourceFragments: Array<{ id: string; reason: string }>;
  importedCount: number;
  items: ShoppingItem[];
  plannedItems: Array<{
    category: ShoppingCategory;
    name: string;
    quantity: string;
  }>;
  sourceFragments: ShoppingAiSourceFragment[];
}

export interface BudgetMonth {
  archivedAt: string | null;
  createdAt: string;
  generatedAt: string;
  householdId: string;
  id: string;
  isCurrent: boolean;
  month: number;
  sourceBudgetMonthId: string | null;
  updatedAt: string;
  year: number;
}

export interface CreateBudgetMonthRequest {
  month: number;
  sourceBudgetMonthId?: string | null;
  year: number;
}

export interface GenerateNextBudgetMonthItemRequest {
  budgetAmount?: number | null;
  budgetItemId: string;
  encryptedPayload?: string;
  encryptionVersion?: number;
}

export interface GenerateNextBudgetMonthCategoryRequest {
  categoryId: string;
  displayOrder: number;
}

export interface GenerateNextBudgetMonthRequest {
  categories?: GenerateNextBudgetMonthCategoryRequest[];
  items?: GenerateNextBudgetMonthItemRequest[];
}

export interface FinanceTotalSummary {
  incomeAmount: string;
  totalBudgetAmount: string;
  totalRemainingAmount: string;
  totalSpentAmount: string;
}

export interface BudgetItemOwner {
  displayName: string;
  email: string;
  memberId: string;
}

export interface BudgetItemSummary {
  budgetAmount: string | null;
  budgetMonthId: string;
  categoryId: string;
  createdAt: string;
  displayOrder: number;
  encryptedPayload: string | null;
  encryptionVersion: number | null;
  expenses: Expense[];
  id: string;
  name: string;
  owner: BudgetItemOwner;
  remainingAmount: string | null;
  spentAmount: string;
  updatedAt: string;
}

export interface BudgetCategoryWithItems {
  copyBudgetToNextMonth: boolean;
  displayOrder: number;
  encryptedPayload: string | null;
  encryptionVersion: number | null;
  householdId: string;
  id: string;
  isActive: boolean;
  items: BudgetItemSummary[];
  name: string;
}

export interface BudgetCategory {
  copyBudgetToNextMonth: boolean;
  createdAt: string;
  displayOrder: number;
  encryptedPayload: string | null;
  encryptionVersion: number | null;
  householdId: string;
  id: string;
  isActive: boolean;
  name: string;
  updatedAt: string;
}

export interface BudgetItem {
  budgetAmount: string | null;
  budgetMonthId: string;
  categoryId: string;
  createdAt: string;
  displayOrder: number;
  encryptedPayload: string | null;
  encryptionVersion: number | null;
  id: string;
  isDeleted: boolean;
  name: string;
  ownerMemberId: string;
  updatedAt: string;
}

export interface IncomeSummary {
  amount: string;
  displayName: string;
  email: string;
  encryptedPayload: string | null;
  encryptionVersion: number | null;
  ownerMemberId: string;
}

export interface PersonFinanceSummary {
  budgetMonthId: string;
  displayName: string;
  email: string;
  incomeAmount: string;
  ownerMemberId: string;
  totalBudgetAmount: string;
  totalRemainingAmount: string;
  totalSpentAmount: string;
}

export interface BudgetMonthDetail {
  categories: BudgetCategoryWithItems[];
  incomes: IncomeSummary[];
  month: BudgetMonth;
  personSummary: PersonFinanceSummary[];
  summary: FinanceTotalSummary;
}

export interface CreateBudgetCategoryRequest {
  copyBudgetToNextMonth?: boolean;
  displayOrder?: number;
  encryptedPayload?: string;
  encryptionVersion?: number;
  name: string;
}

export interface UpdateBudgetCategoryRequest {
  copyBudgetToNextMonth?: boolean;
  displayOrder?: number;
  encryptedPayload?: string;
  encryptionVersion?: number;
  isActive?: boolean;
  name?: string;
}

export interface CreateBudgetItemRequest {
  budgetAmount?: number | null;
  budgetMonthId: string;
  categoryId: string;
  displayOrder?: number;
  encryptedPayload?: string;
  encryptionVersion?: number;
  name: string;
  ownerMemberId: string;
}

export interface UpdateBudgetItemRequest {
  budgetAmount?: number | null;
  categoryId?: string;
  displayOrder?: number;
  encryptedPayload?: string;
  encryptionVersion?: number;
  name?: string;
  ownerMemberId?: string;
}

export interface CreateExpenseRequest {
  amount: number;
  budgetItemId: string;
  encryptedPayload?: string;
  encryptionVersion?: number;
}

export interface Expense {
  amount: string;
  budgetItemId: string;
  createdAt: string;
  encryptedPayload: string | null;
  encryptionVersion: number | null;
  id: string;
  updatedAt: string;
}

export interface UpsertIncomeRequest {
  amount: number;
  budgetMonthId?: string;
  encryptedPayload?: string;
  encryptionVersion?: number;
}

export interface Income {
  amount: string;
  budgetMonthId: string;
  createdAt: string;
  encryptedPayload: string | null;
  encryptionVersion: number | null;
  id: string;
  ownerMemberId: string;
  updatedAt: string;
}

export interface FinanceDebt {
  amount: string;
  createdAt: string;
  dueDate: string | null;
  encryptedPayload: string | null;
  encryptionVersion: number | null;
  householdId: string;
  id: string;
  isSettled: boolean;
  lenderName: string;
  note: string | null;
  paidAmount: string;
  payments: FinanceDebtPayment[];
  purpose: string;
  remainingAmount: string;
  settledAt: string | null;
  updatedAt: string;
}

export interface FinanceDebtPayment {
  amount: string;
  createdAt: string;
  debtId: string;
  encryptedPayload: string | null;
  encryptionVersion: number | null;
  id: string;
  note: string | null;
  paidAt: string | null;
}

export interface CreateFinanceDebtRequest {
  amount: number;
  dueDate?: string | null;
  encryptedPayload?: string;
  encryptionVersion?: number;
  lenderName: string;
  note?: string | null;
  purpose: string;
}

export interface CreateFinanceDebtPaymentRequest {
  amount: number;
  encryptedPayload?: string;
  encryptionVersion?: number;
  note?: string | null;
  paidAt?: string;
}

export interface UpdateFinanceDebtRequest {
  amount?: number;
  dueDate?: string | null;
  encryptedPayload?: string;
  encryptionVersion?: number;
  isSettled?: boolean;
  lenderName?: string;
  note?: string | null;
  purpose?: string;
}

export type FinanceSavingsDirection = "add" | "subtract";

export interface FinanceSavingsTransaction {
  amount: string;
  changedAt: string;
  createdAt: string;
  direction: FinanceSavingsDirection;
  encryptedPayload: string | null;
  encryptionVersion: number | null;
  id: string;
  locationName: string | null;
  locationUrl: string | null;
  note: string | null;
  savingsAccountId: string;
}

export interface FinanceSavingsAccount {
  createdAt: string;
  currentAmount: string;
  encryptedPayload: string | null;
  encryptionVersion: number | null;
  householdId: string;
  id: string;
  lastChangedAt: string;
  ownerMemberId: string | null;
  name: string;
  targetAmount: string | null;
  targetDate: string | null;
  transactions: FinanceSavingsTransaction[];
  updatedAt: string;
}

export interface CreateFinanceSavingsAccountRequest {
  amount: number;
  changedAt?: string;
  encryptedPayload?: string;
  encryptionVersion?: number;
  ownerMemberId?: string | null;
  name: string;
  note?: string | null;
  targetAmount?: number | null;
  targetDate?: string | null;
  transactionEncryptedPayload?: string;
}

export interface CreateFinanceSavingsTransactionRequest {
  amount: number;
  changedAt?: string;
  direction: FinanceSavingsDirection;
  encryptedPayload?: string;
  encryptionVersion?: number;
  note?: string | null;
}

export interface MealPlanWeek {
  createdAt: string;
  householdId: string;
  id: string;
  updatedAt: string;
  weekStartDate: string;
}

export interface MealPlanEntry extends ClientEncryptedRecord {
  createdAt: string;
  id: string;
  linkUrl: string | null;
  mealName: string;
  mealPlanWeekId: string;
  note: string | null;
  slotIndex: number;
  updatedAt: string;
  weekday: number;
}

export interface MealPlanDetail {
  entries: MealPlanEntry[];
  week: MealPlanWeek;
}

export interface MealPlanSummary extends MealPlanWeek {
  entriesByWeekday: Record<number, number>;
  entriesCount: number;
}

export interface CreateMealPlanRequest {
  weekStartDate: string;
}

export interface MealPlanEntryRequest extends ClientEncryptedWrite {
  linkUrl?: string | null;
  mealName: string;
  note?: string | null;
  slotIndex: number;
  weekday: number;
}

export interface DeleteMealSlotRequest {
  slotIndex: number;
  weekday: number;
}

export interface UpdateMealPlanRequest {
  entries: MealPlanEntryRequest[];
}

export interface MealPlanAiMessage {
  content: string;
  role: "assistant" | "user";
}

export interface MealPlanAiDraftEntry {
  linkUrl: string | null;
  mealName: string;
  note: string | null;
  slotIndex: number;
  sourceHint: string | null;
  weekday: number;
}

export interface MealPlanAiChatRequest {
  currentDraft?: MealPlanAiDraftEntry[];
  messages: MealPlanAiMessage[];
  targetWeekStartDate: string;
}

export interface MealPlanAiChatResponse {
  assistantMessage: string;
  entries: MealPlanAiDraftEntry[];
  limitExhausted: boolean;
  questions: string[];
  status: "limit_exhausted" | "needs_clarification" | "ready";
  targetWeekStartDate: string;
}

export type MealPlanAiFinalizeRequest = MealPlanAiChatRequest;
export type MealPlanAiFinalizeResponse = MealPlanAiChatResponse;

export interface MealPlanAiSuggestRequest {
  targetWeekStartDate: string;
}

export interface MealPlanAiSuggestResponse {
  assistantMessage: string;
  entries: MealPlanAiDraftEntry[];
  excludedRecentDays: number;
  insights: string[];
  limitExhausted: boolean;
  recentMealNames: string[];
  status: "limit_exhausted" | "needs_more_history" | "ready";
  targetWeekStartDate: string;
}

export interface CopyMealPlanRequest {
  targetWeekStartDate: string;
}

export interface MealIdea extends ClientEncryptedRecord {
  createdAt: string;
  householdId: string;
  id: string;
  linkUrl: string | null;
  note: string | null;
  title: string;
  updatedAt: string;
}

export interface CreateMealIdeaRequest extends ClientEncryptedWrite {
  linkUrl?: string | null;
  note?: string | null;
  title: string;
}

export interface MealRandomizeRequest {
  slotIndex?: number;
  targetWeekStartDate?: string;
  weekday?: number;
}

export interface MealRandomizeSuggestion {
  linkUrl: string | null;
  mealName: string;
  note: string | null;
  slotIndex: number;
  sourceWeekStartDate: string;
  weekday: number;
}

export interface MealRandomizeResult {
  excludedRecentWeeks: number;
  suggestions: MealRandomizeSuggestion[];
  targetWeekStartDate: string;
}

export interface CalendarEvent {
  encryptedPayload: string | null;
  encryptionVersion: number | null;
  eventDate: string;
  eventTime: string | null;
  googleCalendarAccountEmail: string | null;
  googleCalendarConnectionId: string | null;
  googleCalendarOwnerMemberId: string | null;
  id: string;
  locationName: string | null;
  locationUrl: string | null;
  note: string | null;
  ownerMemberId: string | null;
  recurrenceRule: string | null;
  reminderOffsetMinutes: number | null;
  reminderSentAt?: string | null;
  scopeType: ScopeType;
  sourceEventId?: string;
  sourceType: "google" | "manual";
  title: string;
}

export interface CreateCalendarEventRequest {
  encryptedPayload?: string;
  encryptionVersion?: number;
  eventDate: string;
  eventTime?: string | null;
  locationName?: string | null;
  locationUrl?: string | null;
  note?: string | null;
  ownerMemberId?: string | null;
  recurrenceRule?: string | null;
  reminderOffsetMinutes?: number | null;
  scopeType: ScopeType;
  title: string;
}

export type UpdateCalendarEventRequest = Partial<CreateCalendarEventRequest>;

export interface GoogleCalendarConnectionStatus {
  connected: boolean;
  connectedAt: string | null;
  googleAccountEmail: string | null;
  lastSyncedAt: string | null;
}

export interface GoogleCalendarConnectResponse {
  authorizationUrl: string;
}

export interface GoogleCalendarSyncResult {
  clientEncryptionRequired: false;
  eventDates: string[];
  from: string;
  importedCount: number;
  skippedCount: number;
  to: string;
  updatedCount: number;
}

export interface GoogleCalendarSyncPlanEvent {
  eventDate: string;
  eventTime: string | null;
  googleEventId: string;
  googleUpdatedAt: string | null;
  locationName: string | null;
  locationUrl: string | null;
  note: string | null;
  title: string;
}

export interface GoogleCalendarSyncPlan {
  clientEncryptionRequired: true;
  events: GoogleCalendarSyncPlanEvent[];
  from: string;
  skippedCount: number;
  to: string;
}

export type GoogleCalendarSyncResponse =
  | GoogleCalendarSyncResult
  | GoogleCalendarSyncPlan;

export interface GoogleCalendarEncryptedSyncItem {
  encryptedPayload: string;
  encryptionVersion: number;
  eventDate: string;
  eventTime: string | null;
  googleEventId: string;
  googleUpdatedAt: string | null;
}

export interface CommitGoogleCalendarEncryptedSyncRequest {
  events: GoogleCalendarEncryptedSyncItem[];
  finalize: boolean;
}

export interface GoogleCalendarEncryptedSyncBatchResult {
  eventDates: string[];
  importedCount: number;
  skippedCount: number;
  updatedCount: number;
}

export interface TodoItem extends ClientEncryptedRecord {
  createdAt: string;
  description: string | null;
  doneAt: string | null;
  householdId: string;
  id: string;
  ownerMemberId: string | null;
  scopeType: ScopeType;
  sortOrder: number;
  status: "todo" | "done";
  title: string;
  updatedAt: string;
}

export interface CreateTodoItemRequest extends ClientEncryptedWrite {
  description?: string;
  scopeType: ScopeType;
  title: string;
}

export interface UpdateTodoItemRequest extends ClientEncryptedWrite {
  description?: string;
  scopeType?: "household";
  status?: "todo" | "done";
  title?: string;
}

export interface MoveTodoItemRequest {
  direction: "down" | "up";
}

export interface Note extends ClientEncryptedRecord {
  createdAt: string;
  description: string | null;
  householdId: string;
  id: string;
  ownerMemberId: string;
  title: string;
  updatedAt: string;
}

export interface CreateNoteRequest extends ClientEncryptedWrite {
  description?: string;
  title: string;
}

export type UpdateNoteRequest = Partial<CreateNoteRequest>;

export interface CleaningTask extends ClientEncryptedRecord {
  completionWindowDays: number;
  createdAt: string;
  frequencyDays: number;
  frequencyMode: "preset" | "custom_days";
  householdId: string;
  id: string;
  isOverdue: boolean;
  location: string | null;
  name: string;
  nextDueAt: string;
  reminderSentAt: string | null;
  updatedAt: string;
}

export interface CreateCleaningTaskRequest extends ClientEncryptedWrite {
  completionWindowDays: number;
  frequencyDays: number;
  frequencyMode: CleaningFrequencyMode;
  location?: string;
  name: string;
  nextDueAt: string;
}

export type UpdateCleaningTaskRequest = Partial<CreateCleaningTaskRequest>;

export interface CompleteCleaningTaskRequest {
  completedAt?: string;
}

export interface AnnualCost extends ClientEncryptedRecord {
  createdAt: string;
  defaultAmount: string | null;
  householdId: string;
  id: string;
  name: string;
  nextDueDate: string;
  updatedAt: string;
}

export interface CreateAnnualCostRequest extends ClientEncryptedWrite {
  defaultAmount?: number | null;
  name: string;
  nextDueDate: string;
}

export interface CompleteAnnualCostRequest extends ClientEncryptedWrite {
  amount?: number | null;
  executedAt: string;
}

export interface AnnualCostHistory extends ClientEncryptedRecord {
  amount: string | null;
  annualCostEncryptedPayload: string | null;
  annualCostId: string;
  annualCostName: string;
  createdAt: string;
  executedAt: string;
  id: string;
}

export interface AnnualCostCompletion {
  cost: AnnualCost;
  history: AnnualCostHistory;
}

export interface DataEntry extends ClientEncryptedRecord {
  createdAt: string;
  householdId: string;
  id: string;
  title: string;
  updatedAt: string;
  value: string;
}

export interface CreateDataEntryRequest extends ClientEncryptedWrite {
  title: string;
  value: string;
}

export interface Attachment extends ClientEncryptedRecord {
  caption: string;
  createdAt: string;
  createdByMemberId: string | null;
  fileName: string;
  householdId: string;
  id: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
  storagePath: string;
  updatedAt: string;
}

export interface CreateAttachmentRequest extends ClientEncryptedWrite {
  caption?: string;
  fileName: string;
  mimeType: Attachment["mimeType"];
  storagePath: string;
}

export interface UpdateAttachmentRequest extends ClientEncryptedWrite {
  caption?: string;
  fileName?: string;
}

export interface CreateAttachmentUploadUrlRequest {
  fileName: string;
  mimeType: Attachment["mimeType"];
}

export interface AttachmentUploadContract {
  fileName: string;
  method: "POST";
  mimeType: Attachment["mimeType"];
  storagePath: string;
  uploadUrl: string;
}

export interface LocalAttachmentUploadResponse {
  fileName: string;
  mimeType: Attachment["mimeType"];
  size: number;
  storagePath: string;
}

export interface UploadAttachmentFileRequest {
  fileName: string;
  fileUri: string;
  mimeType: Attachment["mimeType"];
  storagePath: string;
  uploadUrl: string;
}

export type PushPlatform = "android" | "ios" | "web" | "unknown";

export interface RegisterPushTokenRequest {
  deviceName?: string;
  expoPushToken: string;
  platform: PushPlatform;
}

export interface PushToken {
  createdAt: string;
  deviceName: string;
  enabled: boolean;
  expoPushToken: string;
  householdId: string;
  householdMemberId: string;
  id: string;
  lastRegisteredAt: string;
  platform: PushPlatform;
  updatedAt: string;
  userId: string;
}

export interface SendTestPushRequest {
  body?: string;
  title?: string;
}

export interface PushSendResult {
  sent: number;
  tickets: Array<{
    details?: { error?: string };
    id?: string;
    message?: string;
    status: "ok" | "error";
  }>;
}

export interface NotificationPreference {
  enabled: boolean;
  eventType: RealtimeEventType;
}

export interface UpdateNotificationPreferencesRequest {
  preferences: NotificationPreference[];
}

export interface HouseholdMember {
  displayName: string;
  email: string;
  householdId: string;
  id: string;
  isActive: boolean;
  joinedAt: string;
  role: HouseholdMemberRole;
  userId: string;
}

export interface CreateInvitationRequest {
  email: string;
}

export interface HouseholdInvitation {
  email: string;
  expiresAt: string;
  id: string;
  notificationSent?: number;
  token: string;
}

export interface AcceptInvitationRequest {
  token: string;
}

export interface AcceptInvitationResponse {
  householdId: string;
  invitationId: string;
  membership: HouseholdMembership;
}

export interface InvitationPreview {
  email: string;
  expiresAt: string;
  householdName: string;
  invitedByDisplayName: string;
}

export interface CompleteInvitationRegistrationRequest {
  acceptedPrivacy: boolean;
  acceptedTerms: boolean;
  displayName: string;
  password: string;
  token: string;
}

export interface CompleteInvitationRegistrationResponse extends LoginResponse {
  householdId: string;
  invitationId: string;
  membership: HouseholdMembership;
}

export interface PatchMemberPermissionsRequest {
  permissions: EffectivePermission[];
}

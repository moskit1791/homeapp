import type {
  AccountStatus,
  HouseholdMemberRole,
  ModuleKey,
  PermissionSet,
  RealtimeEvent as SharedRealtimeEvent,
  RealtimeEventType,
  ScopeType,
  ShoppingListType
} from '@homeapp/shared-types';

export type RealtimeEvent = SharedRealtimeEvent;

export type EffectivePermission = PermissionSet;

export type { ModuleKey, ShoppingListType };

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
  eventDate: string;
  eventTime: string | null;
  id: string;
  ownerMemberId: string | null;
  scopeType: 'household';
  title: string;
}

export interface StartMealPlan {
  entries: StartMealEntry[];
  id: string;
  weekStartDate: string;
}

export interface StartMealEntry {
  id: string;
  mealName: string;
  slotIndex: number;
  weekday: number;
}

export interface StartTodoItem {
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

export interface ShoppingItem {
  category: string | null;
  checkedAt: string | null;
  createdAt: string;
  displayOrder: number;
  householdId: string;
  id: string;
  isChecked: boolean;
  name: string;
  quantity: string;
  shoppingListId: string;
  type: ShoppingListType;
  updatedAt: string;
}

export interface CreateShoppingItemRequest {
  category?: string | null;
  displayOrder?: number;
  name: string;
  quantity?: string;
}

export interface UpdateShoppingItemRequest {
  category?: string | null;
  displayOrder?: number;
  name?: string;
  quantity?: string;
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
}

export interface ShoppingAiSourceFragment {
  id: string;
  text: string;
}

export interface ImportShoppingItemsWithAiResponse {
  ignoredSourceFragments: Array<{
    id: string;
    reason: string;
  }>;
  importedCount: number;
  items: ShoppingItem[];
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
  name: string;
}

export interface CreateBudgetItemRequest {
  budgetAmount?: number | null;
  budgetMonthId: string;
  categoryId: string;
  displayOrder?: number;
  name: string;
  ownerMemberId: string;
}

export interface UpdateBudgetItemRequest {
  budgetAmount?: number | null;
  categoryId?: string;
  displayOrder?: number;
  name?: string;
  ownerMemberId?: string;
}

export interface CreateExpenseRequest {
  amount: number;
  budgetItemId: string;
}

export interface Expense {
  amount: string;
  budgetItemId: string;
  createdAt: string;
  id: string;
  updatedAt: string;
}

export interface UpsertIncomeRequest {
  amount: number;
  budgetMonthId?: string;
}

export interface Income {
  amount: string;
  budgetMonthId: string;
  createdAt: string;
  id: string;
  ownerMemberId: string;
  updatedAt: string;
}

export interface FinanceDebt {
  amount: string;
  createdAt: string;
  dueDate: string | null;
  householdId: string;
  id: string;
  isSettled: boolean;
  lenderName: string;
  note: string | null;
  purpose: string;
  settledAt: string | null;
  updatedAt: string;
}

export interface CreateFinanceDebtRequest {
  amount: number;
  dueDate?: string | null;
  lenderName: string;
  note?: string | null;
  purpose: string;
}

export interface UpdateFinanceDebtRequest {
  amount?: number;
  dueDate?: string | null;
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
  id: string;
  note: string | null;
  savingsAccountId: string;
}

export interface FinanceSavingsAccount {
  createdAt: string;
  currentAmount: string;
  householdId: string;
  id: string;
  lastChangedAt: string;
  name: string;
  transactions: FinanceSavingsTransaction[];
  updatedAt: string;
}

export interface CreateFinanceSavingsAccountRequest {
  amount: number;
  changedAt?: string;
  name: string;
  note?: string | null;
}

export interface CreateFinanceSavingsTransactionRequest {
  amount: number;
  changedAt?: string;
  direction: FinanceSavingsDirection;
  note?: string | null;
}

export interface MealPlanWeek {
  createdAt: string;
  householdId: string;
  id: string;
  updatedAt: string;
  weekStartDate: string;
}

export interface MealPlanEntry {
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
  entriesCount: number;
}

export interface CreateMealPlanRequest {
  weekStartDate: string;
}

export interface MealPlanEntryRequest {
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

export interface CopyMealPlanRequest {
  targetWeekStartDate: string;
}

export interface MealIdea {
  createdAt: string;
  householdId: string;
  id: string;
  linkUrl: string | null;
  note: string | null;
  title: string;
  updatedAt: string;
}

export interface CreateMealIdeaRequest {
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
  eventDate: string;
  eventTime: string | null;
  id: string;
  note: string | null;
  ownerMemberId: string | null;
  recurrenceRule: string | null;
  reminderOffsetMinutes: number | null;
  reminderSentAt?: string | null;
  scopeType: ScopeType;
  sourceEventId?: string;
  title: string;
}

export interface CreateCalendarEventRequest {
  eventDate: string;
  eventTime?: string | null;
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

export interface GoogleCalendarSyncResponse {
  from: string;
  importedCount: number;
  skippedCount: number;
  to: string;
  updatedCount: number;
}

export interface TodoItem {
  createdAt: string;
  description: string | null;
  doneAt: string | null;
  householdId: string;
  id: string;
  ownerMemberId: string | null;
  scopeType: ScopeType;
  sortOrder: number;
  status: 'todo' | 'done';
  title: string;
  updatedAt: string;
}

export interface CreateTodoItemRequest {
  description?: string;
  scopeType: ScopeType;
  title: string;
}

export interface UpdateTodoItemRequest {
  description?: string;
  scopeType?: 'household';
  status?: 'todo' | 'done';
  title?: string;
}

export interface MoveTodoItemRequest {
  direction: 'down' | 'up';
}

export interface Note {
  createdAt: string;
  description: string | null;
  householdId: string;
  id: string;
  ownerMemberId: string;
  title: string;
  updatedAt: string;
}

export interface CreateNoteRequest {
  description?: string;
  title: string;
}

export type UpdateNoteRequest = Partial<CreateNoteRequest>;

export interface CleaningTask {
  completionWindowDays: number;
  createdAt: string;
  frequencyDays: number;
  frequencyMode: 'preset' | 'custom_days';
  householdId: string;
  id: string;
  isOverdue: boolean;
  name: string;
  nextDueAt: string;
  updatedAt: string;
}

export interface CreateCleaningTaskRequest {
  completionWindowDays?: number;
  frequencyDays: number;
  frequencyMode: 'preset' | 'custom_days';
  name: string;
  nextDueAt: string;
}

export type UpdateCleaningTaskRequest = Partial<CreateCleaningTaskRequest>;

export interface CompleteCleaningTaskRequest {
  completedAt?: string;
}

export interface AnnualCost {
  createdAt: string;
  defaultAmount: string | null;
  householdId: string;
  id: string;
  name: string;
  nextDueDate: string;
  updatedAt: string;
}

export interface CreateAnnualCostRequest {
  defaultAmount?: number | null;
  name: string;
  nextDueDate: string;
}

export interface CompleteAnnualCostRequest {
  amount?: number | null;
  executedAt: string;
}

export interface AnnualCostHistory {
  amount: string | null;
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

export interface DataEntry {
  createdAt: string;
  householdId: string;
  id: string;
  title: string;
  updatedAt: string;
  value: string;
}

export interface CreateDataEntryRequest {
  title: string;
  value: string;
}

export interface Attachment {
  caption: string;
  createdAt: string;
  createdByMemberId: string | null;
  fileName: string;
  householdId: string;
  id: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
  storagePath: string;
  updatedAt: string;
}

export interface CreateAttachmentRequest {
  caption?: string;
  fileName: string;
  mimeType: Attachment['mimeType'];
  storagePath: string;
}

export interface UpdateAttachmentRequest {
  caption?: string;
  fileName?: string;
}

export interface CreateAttachmentUploadUrlRequest {
  fileName: string;
  mimeType: Attachment['mimeType'];
}

export interface AttachmentUploadContract {
  fileName: string;
  method: 'POST';
  mimeType: Attachment['mimeType'];
  storagePath: string;
  uploadUrl: string;
}

export interface LocalAttachmentUploadResponse {
  fileName: string;
  mimeType: Attachment['mimeType'];
  size: number;
  storagePath: string;
}

export interface UploadAttachmentFileRequest {
  fileName: string;
  fileUri: string;
  mimeType: Attachment['mimeType'];
  storagePath: string;
  uploadUrl: string;
}

export type PushPlatform = 'android' | 'ios' | 'web' | 'unknown';

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
    details?: {
      error?: string;
    };
    id?: string;
    message?: string;
    status: 'ok' | 'error';
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

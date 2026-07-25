import type { EncryptableModuleKey } from "@homeapp/shared-types";
import { isRuntimeModuleEncrypted } from "../encryption/runtime-transport";
import { buildApiUrl, getApiBaseUrl } from "./config";
import { createApiErrorFromResponse } from "./errors";
import { apiRequest } from "./request";
import type {
  AnnualCost,
  AnnualCostCompletion,
  AnnualCostHistory,
  AcceptInvitationRequest,
  AcceptInvitationResponse,
  Attachment,
  AttachmentUploadContract,
  BudgetCategory,
  BudgetItem,
  BudgetItemSummary,
  BudgetMonth,
  BudgetMonthDetail,
  BulkShoppingResult,
  CalendarEvent,
  CleaningTask,
  CommitGoogleCalendarEncryptedSyncRequest,
  CompleteAnnualCostRequest,
  CompleteInvitationRegistrationRequest,
  CompleteInvitationRegistrationResponse,
  CompleteCleaningTaskRequest,
  CopyMealPlanRequest,
  CreateAnnualCostRequest,
  CreateAttachmentUploadUrlRequest,
  CreateAttachmentRequest,
  CreateBudgetCategoryRequest,
  CreateBudgetItemRequest,
  CreateBudgetMonthRequest,
  CreateCalendarEventRequest,
  CreateCleaningTaskRequest,
  CreateDataEntryRequest,
  CreateExpenseRequest,
  CreateFinanceDebtRequest,
  CreateFinanceDebtPaymentRequest,
  CreateFinanceSavingsAccountRequest,
  CreateFinanceSavingsTransactionRequest,
  CreateHouseholdRequest,
  CreateHouseholdResponse,
  CreateInvitationRequest,
  CreateMealIdeaRequest,
  CreateMealPlanRequest,
  CreateNoteRequest,
  CreateShoppingItemRequest,
  CreateTodoItemRequest,
  DataEntry,
  DeleteAccountResponse,
  DeleteMealSlotRequest,
  EffectivePermission,
  EncryptionExportItem,
  Expense,
  Household,
  HouseholdEncryptionSettings,
  HouseholdInvitation,
  InvitationPreview,
  HouseholdMember,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  FinanceDebt,
  FinanceSavingsAccount,
  GenerateNextBudgetMonthRequest,
  GoogleCalendarConnectResponse,
  GoogleCalendarConnectionStatus,
  GoogleCalendarEncryptedSyncBatchResult,
  GoogleCalendarSyncResponse,
  GoogleLoginRequest,
  Income,
  IncomeSummary,
  ImportShoppingItemsWithAiRequest,
  ImportShoppingItemsWithAiResponse,
  LocalAttachmentUploadResponse,
  LoginRequest,
  LoginResponse,
  MealIdea,
  MealPlanAiChatRequest,
  MealPlanAiChatResponse,
  MealPlanAiFinalizeRequest,
  MealPlanAiFinalizeResponse,
  MealPlanDetail,
  MealPlanEntryRequest,
  MealPlanSummary,
  MealRandomizeRequest,
  MealRandomizeResult,
  MoveShoppingItemRequest,
  MoveTodoItemRequest,
  Note,
  NotificationPreference,
  OkResponse,
  PantryDashboard,
  PatchMemberPermissionsRequest,
  PushSendResult,
  PushToken,
  RemoveHouseholdEncryptionRequest,
  RegisterRequest,
  RegisterPushTokenRequest,
  RegisterResponse,
  RefreshTokenRequest,
  ResendVerificationRequest,
  ResendVerificationResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  SendTestPushRequest,
  ShoppingItem,
  ShoppingList,
  ShoppingListType,
  StartDashboard,
  TodoItem,
  UpdateCalendarEventRequest,
  UpdateAttachmentRequest,
  UpdateBudgetCategoryRequest,
  UpdateBudgetItemRequest,
  UpdateCleaningTaskRequest,
  UpdateFinanceDebtRequest,
  UpdateHouseholdRequest,
  UpdateHouseholdEncryptionRequest,
  UpdateMealPlanRequest,
  UpdateNoteRequest,
  UpdateNotificationPreferencesRequest,
  UpdateShoppingItemRequest,
  UpdateTodoItemRequest,
  UploadAttachmentFileRequest,
  UpsertIncomeRequest,
  VerifyEmailRequest,
  VerifyEmailResponse,
} from "./types";

export interface ApiCallOptions {
  accessToken?: string | null;
  signal?: AbortSignal;
}

export type ApiCallOptionsInput = ApiCallOptions | string | null | undefined;

export function getHouseholdEncryptionSettings(
  options?: ApiCallOptionsInput,
): Promise<HouseholdEncryptionSettings> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<HouseholdEncryptionSettings>("/encryption/household", {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal,
  });
}

export function updateHouseholdEncryptionSettings(
  input: UpdateHouseholdEncryptionRequest,
  options?: ApiCallOptionsInput,
): Promise<HouseholdEncryptionSettings> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<
    HouseholdEncryptionSettings,
    UpdateHouseholdEncryptionRequest
  >("/encryption/household", {
    accessToken: requestOptions.accessToken,
    body: input,
    method: "PUT",
    signal: requestOptions.signal,
  });
}

export function removeHouseholdEncryptionSettings(
  input: RemoveHouseholdEncryptionRequest,
  options?: ApiCallOptionsInput,
): Promise<HouseholdEncryptionSettings> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<
    HouseholdEncryptionSettings,
    RemoveHouseholdEncryptionRequest
  >("/encryption/household/remove", {
    accessToken: requestOptions.accessToken,
    body: input,
    method: "POST",
    signal: requestOptions.signal,
  });
}

export function exportHouseholdEncryptionData(
  module: EncryptableModuleKey,
  options?: ApiCallOptionsInput,
): Promise<EncryptionExportItem[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<EncryptionExportItem[]>(
    `/encryption/household/export/${module}`,
    {
      ...requestOptions,
      method: "GET",
    },
  );
}

export function register(
  input: RegisterRequest,
  options?: ApiCallOptionsInput,
): Promise<RegisterResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<RegisterResponse, RegisterRequest>("/auth/register", {
    body: input,
    method: "POST",
    signal: requestOptions.signal,
  });
}

export function verifyEmail(
  input: VerifyEmailRequest,
  options?: ApiCallOptionsInput,
): Promise<VerifyEmailResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<VerifyEmailResponse, VerifyEmailRequest>(
    "/auth/verify-email",
    {
      body: input,
      method: "POST",
      signal: requestOptions.signal,
    },
  );
}

export function resendVerification(
  input: ResendVerificationRequest,
  options?: ApiCallOptionsInput,
): Promise<ResendVerificationResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<ResendVerificationResponse, ResendVerificationRequest>(
    "/auth/resend-verification",
    {
      body: input,
      method: "POST",
      signal: requestOptions.signal,
    },
  );
}

export function login(
  input: LoginRequest,
  options?: ApiCallOptionsInput,
): Promise<LoginResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<LoginResponse, LoginRequest>("/auth/login", {
    body: input,
    method: "POST",
    signal: requestOptions.signal,
  });
}

export function refreshSession(
  input: RefreshTokenRequest,
  options?: ApiCallOptionsInput,
): Promise<LoginResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<LoginResponse, RefreshTokenRequest>("/auth/refresh", {
    body: input,
    method: "POST",
    signal: requestOptions.signal,
  });
}

export function logoutSession(
  options?: ApiCallOptionsInput,
): Promise<OkResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<OkResponse>("/auth/logout", {
    accessToken: requestOptions.accessToken,
    method: "POST",
    signal: requestOptions.signal,
  });
}

export function loginWithGoogle(
  input: GoogleLoginRequest,
  options?: ApiCallOptionsInput,
): Promise<LoginResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<LoginResponse, GoogleLoginRequest>("/auth/google", {
    body: input,
    method: "POST",
    signal: requestOptions.signal,
  });
}

export function checkApiHealth(
  options?: ApiCallOptionsInput,
): Promise<{ service: string; status: string }> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<{ service: string; status: string }>("/health", {
    signal: requestOptions.signal,
  });
}

export function forgotPassword(
  input: ForgotPasswordRequest,
  options?: ApiCallOptionsInput,
): Promise<ForgotPasswordResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<ForgotPasswordResponse, ForgotPasswordRequest>(
    "/auth/forgot-password",
    {
      body: input,
      method: "POST",
      signal: requestOptions.signal,
    },
  );
}

export function resetPassword(
  input: ResetPasswordRequest,
  options?: ApiCallOptionsInput,
): Promise<ResetPasswordResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<ResetPasswordResponse, ResetPasswordRequest>(
    "/auth/reset-password",
    {
      body: input,
      method: "POST",
      signal: requestOptions.signal,
    },
  );
}

export function deleteMyAccount(
  options?: ApiCallOptionsInput,
): Promise<DeleteAccountResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<DeleteAccountResponse>("/auth/me", {
    accessToken: requestOptions.accessToken,
    method: "DELETE",
    signal: requestOptions.signal,
  });
}

export function createHousehold(
  input: CreateHouseholdRequest,
  options?: ApiCallOptionsInput,
): Promise<CreateHouseholdResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<CreateHouseholdResponse, CreateHouseholdRequest>(
    "/households",
    {
      accessToken: requestOptions.accessToken,
      body: input,
      method: "POST",
      signal: requestOptions.signal,
    },
  );
}

export function getStartDashboard(
  options?: ApiCallOptionsInput,
): Promise<StartDashboard> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<StartDashboard>("/start/dashboard", {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal,
  });
}

export function getMyPermissions(
  options?: ApiCallOptionsInput,
): Promise<EffectivePermission[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<EffectivePermission[]>("/households/me/permissions", {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal,
  });
}

export function registerPushToken(
  input: RegisterPushTokenRequest,
  options?: ApiCallOptionsInput,
): Promise<PushToken> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<PushToken, RegisterPushTokenRequest>(
    "/notifications/push-tokens",
    {
      accessToken: requestOptions.accessToken,
      body: input,
      method: "POST",
      signal: requestOptions.signal,
    },
  );
}

export function sendTestPush(
  input: SendTestPushRequest = {},
  options?: ApiCallOptionsInput,
): Promise<PushSendResult> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<PushSendResult, SendTestPushRequest>(
    "/notifications/test-push",
    {
      accessToken: requestOptions.accessToken,
      body: input,
      method: "POST",
      signal: requestOptions.signal,
    },
  );
}

export function listNotificationPreferences(
  options?: ApiCallOptionsInput,
): Promise<NotificationPreference[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<NotificationPreference[]>("/notifications/preferences", {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal,
  });
}

export function updateNotificationPreferences(
  input: UpdateNotificationPreferencesRequest,
  options?: ApiCallOptionsInput,
): Promise<NotificationPreference[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<
    NotificationPreference[],
    UpdateNotificationPreferencesRequest
  >("/notifications/preferences", {
    accessToken: requestOptions.accessToken,
    body: input,
    method: "PATCH",
    signal: requestOptions.signal,
  });
}

export function getMyHousehold(
  options?: ApiCallOptionsInput,
): Promise<Household> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<Household>("/households/me", {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal,
  });
}

export function updateMyHousehold(
  input: UpdateHouseholdRequest,
  options?: ApiCallOptionsInput,
): Promise<Household> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<Household, UpdateHouseholdRequest>("/households/me", {
    accessToken: requestOptions.accessToken,
    body: input,
    method: "PATCH",
    signal: requestOptions.signal,
  });
}

export function listHouseholdMembers(
  options?: ApiCallOptionsInput,
): Promise<HouseholdMember[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<HouseholdMember[]>("/households/me/members", {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal,
  });
}

export function listMemberPermissions(
  memberId: string,
  options?: ApiCallOptionsInput,
): Promise<EffectivePermission[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<EffectivePermission[]>(
    `/households/me/members/${memberId}/permissions`,
    {
      accessToken: requestOptions.accessToken,
      signal: requestOptions.signal,
    },
  );
}

export function inviteHouseholdMember(
  input: CreateInvitationRequest,
  options?: ApiCallOptionsInput,
): Promise<HouseholdInvitation> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<HouseholdInvitation, CreateInvitationRequest>(
    "/households/me/invitations",
    {
      accessToken: requestOptions.accessToken,
      body: input,
      method: "POST",
      signal: requestOptions.signal,
    },
  );
}

export function acceptInvitation(
  input: AcceptInvitationRequest,
  options?: ApiCallOptionsInput,
): Promise<AcceptInvitationResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<AcceptInvitationResponse, AcceptInvitationRequest>(
    "/invitations/accept",
    {
      accessToken: requestOptions.accessToken,
      body: input,
      method: "POST",
      signal: requestOptions.signal,
    },
  );
}

export function previewInvitation(
  token: string,
  options?: ApiCallOptionsInput,
): Promise<InvitationPreview> {
  const requestOptions = normalizeApiCallOptions(options);
  const query = `token=${encodeURIComponent(token)}`;

  return apiRequest<InvitationPreview>(`/invitations/preview?${query}`, {
    signal: requestOptions.signal,
  });
}

export function completeInvitationRegistration(
  input: CompleteInvitationRegistrationRequest,
  options?: ApiCallOptionsInput,
): Promise<CompleteInvitationRegistrationResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<
    CompleteInvitationRegistrationResponse,
    CompleteInvitationRegistrationRequest
  >("/invitations/complete-registration", {
    body: input,
    method: "POST",
    signal: requestOptions.signal,
  });
}

export function removeHouseholdMember(
  memberId: string,
  options?: ApiCallOptionsInput,
): Promise<OkResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<OkResponse>(`/households/me/members/${memberId}`, {
    accessToken: requestOptions.accessToken,
    method: "DELETE",
    signal: requestOptions.signal,
  });
}

export function updateMemberPermissions(
  memberId: string,
  input: PatchMemberPermissionsRequest,
  options?: ApiCallOptionsInput,
): Promise<EffectivePermission[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<EffectivePermission[], PatchMemberPermissionsRequest>(
    `/households/me/members/${memberId}/permissions`,
    {
      accessToken: requestOptions.accessToken,
      body: input,
      method: "PATCH",
      signal: requestOptions.signal,
    },
  );
}

export function getCurrentBudgetMonth(
  options?: ApiCallOptionsInput,
): Promise<BudgetMonthDetail> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<BudgetMonthDetail>("/finance/current-month", {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal,
  });
}

export const getFinanceSummary = getCurrentBudgetMonth;

export function getBudgetMonth(
  monthId: string,
  options?: ApiCallOptionsInput,
): Promise<BudgetMonthDetail> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<BudgetMonthDetail>(`/finance/months/${monthId}`, {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal,
  });
}

export function listBudgetMonths(
  options?: ApiCallOptionsInput,
): Promise<BudgetMonth[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<BudgetMonth[]>("/finance/months/archive", {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal,
  });
}

export function generateNextBudgetMonth(
  inputOrOptions?: GenerateNextBudgetMonthRequest | ApiCallOptionsInput,
  options?: ApiCallOptionsInput,
): Promise<BudgetMonthDetail> {
  const hasRequestBody =
    typeof inputOrOptions === "object" &&
    inputOrOptions !== null &&
    ("items" in inputOrOptions || "categories" in inputOrOptions);
  const input: GenerateNextBudgetMonthRequest = hasRequestBody
    ? (inputOrOptions as GenerateNextBudgetMonthRequest)
    : {};
  const requestOptions = normalizeApiCallOptions(
    hasRequestBody ? options : (inputOrOptions as ApiCallOptionsInput),
  );

  return apiRequest<BudgetMonthDetail, GenerateNextBudgetMonthRequest>(
    "/finance/months/generate-next",
    {
      accessToken: requestOptions.accessToken,
      body: input,
      method: "POST",
      signal: requestOptions.signal,
    },
  );
}

export function createBudgetMonth(
  input: CreateBudgetMonthRequest,
  options?: ApiCallOptionsInput,
): Promise<BudgetMonthDetail> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<BudgetMonthDetail, CreateBudgetMonthRequest>(
    "/finance/months",
    {
      accessToken: requestOptions.accessToken,
      body: input,
      method: "POST",
      signal: requestOptions.signal,
    },
  );
}

export function deleteBudgetMonth(
  monthId: string,
  options?: ApiCallOptionsInput,
): Promise<OkResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<OkResponse>(`/finance/months/${monthId}`, {
    accessToken: requestOptions.accessToken,
    method: "DELETE",
    signal: requestOptions.signal,
  });
}

export function listBudgetCategories(
  options?: ApiCallOptionsInput,
): Promise<BudgetCategory[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<BudgetCategory[]>("/finance/categories", {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal,
  });
}

export function createBudgetCategory(
  input: CreateBudgetCategoryRequest,
  options?: ApiCallOptionsInput,
): Promise<BudgetCategory> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<BudgetCategory, CreateBudgetCategoryRequest>(
    "/finance/categories",
    {
      accessToken: requestOptions.accessToken,
      body: input,
      method: "POST",
      signal: requestOptions.signal,
    },
  );
}

export function updateBudgetCategory(
  categoryId: string,
  input: UpdateBudgetCategoryRequest,
  options?: ApiCallOptionsInput,
): Promise<BudgetCategory> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<BudgetCategory, UpdateBudgetCategoryRequest>(
    `/finance/categories/${categoryId}`,
    {
      accessToken: requestOptions.accessToken,
      body: input,
      method: "PATCH",
      signal: requestOptions.signal,
    },
  );
}

export async function listBudgetItems(
  options?: ApiCallOptionsInput,
): Promise<BudgetItemSummary[]> {
  const detail = await getCurrentBudgetMonth(options);

  return detail.categories.flatMap((category) => category.items);
}

export function createBudgetItem(
  input: CreateBudgetItemRequest,
  options?: ApiCallOptionsInput,
): Promise<BudgetItem> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<BudgetItem, CreateBudgetItemRequest>(
    "/finance/budget-items",
    {
      accessToken: requestOptions.accessToken,
      body: input,
      method: "POST",
      signal: requestOptions.signal,
    },
  );
}

export function updateBudgetItem(
  budgetItemId: string,
  input: UpdateBudgetItemRequest,
  options?: ApiCallOptionsInput,
): Promise<BudgetItem> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<BudgetItem, UpdateBudgetItemRequest>(
    `/finance/budget-items/${budgetItemId}`,
    {
      accessToken: requestOptions.accessToken,
      body: input,
      method: "PATCH",
      signal: requestOptions.signal,
    },
  );
}

export function deleteBudgetItem(
  budgetItemId: string,
  options?: ApiCallOptionsInput,
): Promise<OkResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<OkResponse>(`/finance/budget-items/${budgetItemId}`, {
    accessToken: requestOptions.accessToken,
    method: "DELETE",
    signal: requestOptions.signal,
  });
}

export function createExpense(
  input: CreateExpenseRequest,
  options?: ApiCallOptionsInput,
): Promise<Expense> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<Expense, CreateExpenseRequest>("/finance/expenses", {
    accessToken: requestOptions.accessToken,
    body: input,
    method: "POST",
    signal: requestOptions.signal,
  });
}

export async function listIncomes(
  options?: ApiCallOptionsInput,
): Promise<IncomeSummary[]> {
  const detail = await getCurrentBudgetMonth(options);

  return detail.incomes;
}

export function upsertIncome(
  memberId: string,
  input: UpsertIncomeRequest,
  options?: ApiCallOptionsInput,
): Promise<Income> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<Income, UpsertIncomeRequest>(
    `/finance/incomes/${memberId}`,
    {
      accessToken: requestOptions.accessToken,
      body: input,
      method: "PUT",
      signal: requestOptions.signal,
    },
  );
}

export function listFinanceDebts(
  options?: ApiCallOptionsInput,
): Promise<FinanceDebt[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<FinanceDebt[]>("/finance/debts", {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal,
  });
}

export function createFinanceDebt(
  input: CreateFinanceDebtRequest,
  options?: ApiCallOptionsInput,
): Promise<FinanceDebt> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<FinanceDebt, CreateFinanceDebtRequest>("/finance/debts", {
    accessToken: requestOptions.accessToken,
    body: input,
    method: "POST",
    signal: requestOptions.signal,
  });
}

export function updateFinanceDebt(
  debtId: string,
  input: UpdateFinanceDebtRequest,
  options?: ApiCallOptionsInput,
): Promise<FinanceDebt> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<FinanceDebt, UpdateFinanceDebtRequest>(
    `/finance/debts/${debtId}`,
    {
      accessToken: requestOptions.accessToken,
      body: input,
      method: "PATCH",
      signal: requestOptions.signal,
    },
  );
}

export function createFinanceDebtPayment(
  debtId: string,
  input: CreateFinanceDebtPaymentRequest,
  options?: ApiCallOptionsInput,
): Promise<FinanceDebt> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<FinanceDebt, CreateFinanceDebtPaymentRequest>(
    `/finance/debts/${debtId}/payments`,
    {
      accessToken: requestOptions.accessToken,
      body: input,
      method: "POST",
      signal: requestOptions.signal,
    },
  );
}

export function deleteFinanceDebt(
  debtId: string,
  options?: ApiCallOptionsInput,
): Promise<OkResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<OkResponse>(`/finance/debts/${debtId}`, {
    accessToken: requestOptions.accessToken,
    method: "DELETE",
    signal: requestOptions.signal,
  });
}

export function listFinanceSavings(
  options?: ApiCallOptionsInput,
): Promise<FinanceSavingsAccount[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<FinanceSavingsAccount[]>("/finance/savings", {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal,
  });
}

export function createFinanceSavingsAccount(
  input: CreateFinanceSavingsAccountRequest,
  options?: ApiCallOptionsInput,
): Promise<FinanceSavingsAccount> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<FinanceSavingsAccount, CreateFinanceSavingsAccountRequest>(
    "/finance/savings",
    {
      accessToken: requestOptions.accessToken,
      body: input,
      method: "POST",
      signal: requestOptions.signal,
    },
  );
}

export function createFinanceSavingsTransaction(
  accountId: string,
  input: CreateFinanceSavingsTransactionRequest,
  options?: ApiCallOptionsInput,
): Promise<FinanceSavingsAccount> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<
    FinanceSavingsAccount,
    CreateFinanceSavingsTransactionRequest
  >(`/finance/savings/${accountId}/transactions`, {
    accessToken: requestOptions.accessToken,
    body: input,
    method: "POST",
    signal: requestOptions.signal,
  });
}

export function deleteFinanceSavingsAccount(
  accountId: string,
  options?: ApiCallOptionsInput,
): Promise<OkResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<OkResponse>(`/finance/savings/${accountId}`, {
    accessToken: requestOptions.accessToken,
    method: "DELETE",
    signal: requestOptions.signal,
  });
}

export async function getCurrentMealPlanWeek(
  options?: ApiCallOptionsInput,
): Promise<MealPlanDetail | null> {
  const requestOptions = normalizeApiCallOptions(options);

  const currentPlan = await apiRequest<MealPlanDetail | null | undefined>(
    "/meal-plans/current",
    {
      accessToken: requestOptions.accessToken,
      signal: requestOptions.signal,
    },
  );

  return currentPlan ?? null;
}

export function listMealPlanHistory(
  options?: ApiCallOptionsInput,
): Promise<MealPlanSummary[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<MealPlanSummary[]>("/meal-plans/history", {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal,
  });
}

export function getMealPlanWeek(
  planId: string,
  options?: ApiCallOptionsInput,
): Promise<MealPlanDetail> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<MealPlanDetail>(`/meal-plans/${planId}`, {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal,
  });
}

export function createMealPlan(
  input: CreateMealPlanRequest,
  options?: ApiCallOptionsInput,
): Promise<MealPlanDetail> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<MealPlanDetail, CreateMealPlanRequest>("/meal-plans", {
    accessToken: requestOptions.accessToken,
    body: input,
    method: "POST",
    signal: requestOptions.signal,
  });
}

export function updateMealPlan(
  planId: string,
  input: UpdateMealPlanRequest,
  options?: ApiCallOptionsInput,
): Promise<MealPlanDetail> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<MealPlanDetail, UpdateMealPlanRequest>(
    `/meal-plans/${planId}`,
    {
      accessToken: requestOptions.accessToken,
      body: input,
      method: "PATCH",
      signal: requestOptions.signal,
    },
  );
}

export function chatMealPlanWithAi(
  input: MealPlanAiChatRequest,
  options?: ApiCallOptionsInput,
): Promise<MealPlanAiChatResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<MealPlanAiChatResponse, MealPlanAiChatRequest>(
    "/meal-plans/ai/chat",
    {
      accessToken: requestOptions.accessToken,
      body: input,
      method: "POST",
      signal: requestOptions.signal,
    },
  );
}

export function finalizeMealPlanWithAi(
  input: MealPlanAiFinalizeRequest,
  options?: ApiCallOptionsInput,
): Promise<MealPlanAiFinalizeResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<MealPlanAiFinalizeResponse, MealPlanAiFinalizeRequest>(
    "/meal-plans/ai/finalize",
    {
      accessToken: requestOptions.accessToken,
      body: input,
      method: "POST",
      signal: requestOptions.signal,
    },
  );
}

export function generateMealPlanAiPrompt(
  options?: ApiCallOptionsInput,
): Promise<{ prompt: string }> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<{ prompt: string }>("/meal-plans/ai/prompt", {
    accessToken: requestOptions.accessToken,
    method: "GET",
    signal: requestOptions.signal,
  });
}

export function deleteMealPlanWeek(
  planId: string,
  options?: ApiCallOptionsInput,
): Promise<OkResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<OkResponse>(`/meal-plans/${planId}`, {
    accessToken: requestOptions.accessToken,
    method: "DELETE",
    signal: requestOptions.signal,
  });
}

export function deleteMealSlot(
  planId: string,
  input: DeleteMealSlotRequest,
  options?: ApiCallOptionsInput,
): Promise<MealPlanDetail> {
  const requestOptions = normalizeApiCallOptions(options);
  const query = `weekday=${encodeURIComponent(input.weekday)}&slotIndex=${encodeURIComponent(input.slotIndex)}`;

  return apiRequest<MealPlanDetail>(`/meal-plans/${planId}/entries?${query}`, {
    accessToken: requestOptions.accessToken,
    method: "DELETE",
    signal: requestOptions.signal,
  });
}

export function upsertMealSlot(
  planId: string,
  entries: MealPlanEntryRequest[],
  options?: ApiCallOptionsInput,
): Promise<MealPlanDetail> {
  return updateMealPlan(planId, { entries }, options);
}

export function copyMealPlanWeek(
  planId: string,
  input: CopyMealPlanRequest,
  options?: ApiCallOptionsInput,
): Promise<MealPlanDetail> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<MealPlanDetail, CopyMealPlanRequest>(
    `/meal-plans/${planId}/copy`,
    {
      accessToken: requestOptions.accessToken,
      body: input,
      method: "POST",
      signal: requestOptions.signal,
    },
  );
}

export function drawMealInspirations(
  input: MealRandomizeRequest,
  options?: ApiCallOptionsInput,
): Promise<MealRandomizeResult> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<MealRandomizeResult, MealRandomizeRequest>(
    "/meal-plans/randomize",
    {
      accessToken: requestOptions.accessToken,
      body: input,
      method: "POST",
      signal: requestOptions.signal,
    },
  );
}

export function listMealIdeas(
  options?: ApiCallOptionsInput,
): Promise<MealIdea[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<MealIdea[]>("/meal-ideas", {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal,
  });
}

export function createMealIdea(
  input: CreateMealIdeaRequest,
  options?: ApiCallOptionsInput,
): Promise<MealIdea> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<MealIdea, CreateMealIdeaRequest>("/meal-ideas", {
    accessToken: requestOptions.accessToken,
    body: input,
    method: "POST",
    signal: requestOptions.signal,
  });
}

export function listCalendarUpcoming(
  limit = 8,
  options?: ApiCallOptionsInput,
): Promise<CalendarEvent[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<CalendarEvent[]>(`/calendar/upcoming?limit=${limit}`, {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal,
  });
}

export function listCalendarEvents(
  from: string,
  to: string,
  options?: ApiCallOptionsInput,
): Promise<CalendarEvent[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<CalendarEvent[]>(
    `/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    {
      accessToken: requestOptions.accessToken,
      signal: requestOptions.signal,
    },
  );
}

export function createCalendarEvent(
  input: CreateCalendarEventRequest,
  options?: ApiCallOptionsInput,
): Promise<CalendarEvent> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<CalendarEvent, CreateCalendarEventRequest>(
    "/calendar/events",
    {
      accessToken: requestOptions.accessToken,
      body: input,
      method: "POST",
      signal: requestOptions.signal,
    },
  );
}

export function updateCalendarEvent(
  eventId: string,
  input: UpdateCalendarEventRequest,
  options?: ApiCallOptionsInput,
): Promise<CalendarEvent> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<CalendarEvent, UpdateCalendarEventRequest>(
    `/calendar/events/${eventId}`,
    {
      accessToken: requestOptions.accessToken,
      body: input,
      method: "PATCH",
      signal: requestOptions.signal,
    },
  );
}

export function deleteCalendarEvent(
  eventId: string,
  options?: ApiCallOptionsInput,
): Promise<OkResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<OkResponse>(`/calendar/events/${eventId}`, {
    accessToken: requestOptions.accessToken,
    method: "DELETE",
    signal: requestOptions.signal,
  });
}

export function getGoogleCalendarStatus(
  options?: ApiCallOptionsInput,
): Promise<GoogleCalendarConnectionStatus> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<GoogleCalendarConnectionStatus>("/calendar/google/status", {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal,
  });
}

export function connectGoogleCalendar(
  options?: ApiCallOptionsInput,
): Promise<GoogleCalendarConnectResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<GoogleCalendarConnectResponse>("/calendar/google/connect", {
    accessToken: requestOptions.accessToken,
    method: "POST",
    signal: requestOptions.signal,
  });
}

export function syncGoogleCalendar(
  options?: ApiCallOptionsInput,
): Promise<GoogleCalendarSyncResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<GoogleCalendarSyncResponse>("/calendar/google/sync", {
    accessToken: requestOptions.accessToken,
    method: "POST",
    signal: requestOptions.signal,
  });
}

export function commitGoogleCalendarEncryptedSync(
  input: CommitGoogleCalendarEncryptedSyncRequest,
  options?: ApiCallOptionsInput,
): Promise<GoogleCalendarEncryptedSyncBatchResult> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<
    GoogleCalendarEncryptedSyncBatchResult,
    CommitGoogleCalendarEncryptedSyncRequest
  >("/calendar/google/sync/encrypted", {
    accessToken: requestOptions.accessToken,
    body: input,
    method: "POST",
    signal: requestOptions.signal,
  });
}

export function listTodoItems(
  status?: "todo" | "done",
  options?: ApiCallOptionsInput,
): Promise<TodoItem[]> {
  const requestOptions = normalizeApiCallOptions(options);
  const query = status ? `?status=${status}` : "";

  return apiRequest<TodoItem[]>(`/todo-items${query}`, {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal,
  });
}

export function createTodoItem(
  input: CreateTodoItemRequest,
  options?: ApiCallOptionsInput,
): Promise<TodoItem> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<TodoItem, CreateTodoItemRequest>("/todo-items", {
    accessToken: requestOptions.accessToken,
    body: input,
    method: "POST",
    signal: requestOptions.signal,
  });
}

export function updateTodoItem(
  itemId: string,
  input: UpdateTodoItemRequest,
  options?: ApiCallOptionsInput,
): Promise<TodoItem> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<TodoItem, UpdateTodoItemRequest>(`/todo-items/${itemId}`, {
    accessToken: requestOptions.accessToken,
    body: input,
    method: "PATCH",
    signal: requestOptions.signal,
  });
}

export function completeTodoItem(
  itemId: string,
  options?: ApiCallOptionsInput,
): Promise<TodoItem> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<TodoItem>(`/todo-items/${itemId}/done`, {
    accessToken: requestOptions.accessToken,
    method: "POST",
    signal: requestOptions.signal,
  });
}

export function reopenTodoItem(
  itemId: string,
  options?: ApiCallOptionsInput,
): Promise<TodoItem> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<TodoItem>(`/todo-items/${itemId}/reopen`, {
    accessToken: requestOptions.accessToken,
    method: "POST",
    signal: requestOptions.signal,
  });
}

export function moveTodoItem(
  itemId: string,
  input: MoveTodoItemRequest,
  options?: ApiCallOptionsInput,
): Promise<TodoItem> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<TodoItem, MoveTodoItemRequest>(
    `/todo-items/${itemId}/move`,
    {
      accessToken: requestOptions.accessToken,
      body: input,
      method: "POST",
      signal: requestOptions.signal,
    },
  );
}

export function deleteTodoItem(
  itemId: string,
  options?: ApiCallOptionsInput,
): Promise<OkResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<OkResponse>(`/todo-items/${itemId}`, {
    accessToken: requestOptions.accessToken,
    method: "DELETE",
    signal: requestOptions.signal,
  });
}

export function listNotes(options?: ApiCallOptionsInput): Promise<Note[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<Note[]>("/notes", {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal,
  });
}

export function createNote(
  input: CreateNoteRequest,
  options?: ApiCallOptionsInput,
): Promise<Note> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<Note, CreateNoteRequest>("/notes", {
    accessToken: requestOptions.accessToken,
    body: input,
    method: "POST",
    signal: requestOptions.signal,
  });
}

export function updateNote(
  noteId: string,
  input: UpdateNoteRequest,
  options?: ApiCallOptionsInput,
): Promise<Note> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<Note, UpdateNoteRequest>(`/notes/${noteId}`, {
    accessToken: requestOptions.accessToken,
    body: input,
    method: "PATCH",
    signal: requestOptions.signal,
  });
}

export function deleteNote(
  noteId: string,
  options?: ApiCallOptionsInput,
): Promise<OkResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<OkResponse>(`/notes/${noteId}`, {
    accessToken: requestOptions.accessToken,
    method: "DELETE",
    signal: requestOptions.signal,
  });
}

export function listCleaningTasks(
  options?: ApiCallOptionsInput,
): Promise<CleaningTask[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<CleaningTask[]>("/cleaning", {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal,
  });
}

export function createCleaningTask(
  input: CreateCleaningTaskRequest,
  options?: ApiCallOptionsInput,
): Promise<CleaningTask> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<CleaningTask, CreateCleaningTaskRequest>("/cleaning", {
    accessToken: requestOptions.accessToken,
    body: input,
    method: "POST",
    signal: requestOptions.signal,
  });
}

export function completeCleaningTask(
  taskId: string,
  input: CompleteCleaningTaskRequest,
  options?: ApiCallOptionsInput,
): Promise<CleaningTask> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<CleaningTask, CompleteCleaningTaskRequest>(
    `/cleaning/${taskId}/complete`,
    {
      accessToken: requestOptions.accessToken,
      body: input,
      method: "POST",
      signal: requestOptions.signal,
    },
  );
}

export function updateCleaningTask(
  taskId: string,
  input: UpdateCleaningTaskRequest,
  options?: ApiCallOptionsInput,
): Promise<CleaningTask> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<CleaningTask, UpdateCleaningTaskRequest>(
    `/cleaning/${taskId}`,
    {
      accessToken: requestOptions.accessToken,
      body: input,
      method: "PATCH",
      signal: requestOptions.signal,
    },
  );
}

export function deleteCleaningTask(
  taskId: string,
  options?: ApiCallOptionsInput,
): Promise<OkResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<OkResponse>(`/cleaning/${taskId}`, {
    accessToken: requestOptions.accessToken,
    method: "DELETE",
    signal: requestOptions.signal,
  });
}

export function listAnnualCosts(
  options?: ApiCallOptionsInput,
): Promise<AnnualCost[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<AnnualCost[]>("/annual-costs", {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal,
  });
}

export function createAnnualCost(
  input: CreateAnnualCostRequest,
  options?: ApiCallOptionsInput,
): Promise<AnnualCost> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<AnnualCost, CreateAnnualCostRequest>("/annual-costs", {
    accessToken: requestOptions.accessToken,
    body: input,
    method: "POST",
    signal: requestOptions.signal,
  });
}

export function completeAnnualCost(
  costId: string,
  input: CompleteAnnualCostRequest,
  options?: ApiCallOptionsInput,
): Promise<AnnualCostCompletion> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<AnnualCostCompletion, CompleteAnnualCostRequest>(
    `/annual-costs/${costId}/complete`,
    {
      accessToken: requestOptions.accessToken,
      body: input,
      method: "POST",
      signal: requestOptions.signal,
    },
  );
}

export function listAnnualCostHistory(
  year: number,
  options?: ApiCallOptionsInput,
): Promise<AnnualCostHistory[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<AnnualCostHistory[]>(`/annual-costs/history?year=${year}`, {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal,
  });
}

export function listDataEntries(
  search?: string,
  options?: ApiCallOptionsInput,
): Promise<DataEntry[]> {
  const requestOptions = normalizeApiCallOptions(options);
  const encrypted = isRuntimeModuleEncrypted("data_entries");
  const normalizedSearch = search?.trim().toLocaleLowerCase("pl");
  const query =
    search && !encrypted ? `?search=${encodeURIComponent(search)}` : "";

  return apiRequest<DataEntry[]>(`/data-entries${query}`, {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal,
  }).then((items) =>
    encrypted && normalizedSearch
      ? items.filter((item) =>
          `${item.title} ${item.value}`
            .toLocaleLowerCase("pl")
            .includes(normalizedSearch),
        )
      : items,
  );
}

export function createDataEntry(
  input: CreateDataEntryRequest,
  options?: ApiCallOptionsInput,
): Promise<DataEntry> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<DataEntry, CreateDataEntryRequest>("/data-entries", {
    accessToken: requestOptions.accessToken,
    body: input,
    method: "POST",
    signal: requestOptions.signal,
  });
}

export function deleteDataEntry(
  id: string,
  options?: ApiCallOptionsInput,
): Promise<OkResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<OkResponse>(`/data-entries/${id}`, {
    accessToken: requestOptions.accessToken,
    method: "DELETE",
    signal: requestOptions.signal,
  });
}

export function listAttachments(
  search?: string,
  options?: ApiCallOptionsInput,
): Promise<Attachment[]> {
  const requestOptions = normalizeApiCallOptions(options);
  const encrypted = isRuntimeModuleEncrypted("attachments");
  const normalizedSearch = search?.trim().toLocaleLowerCase("pl");
  const query =
    search && !encrypted ? `?search=${encodeURIComponent(search)}` : "";

  return apiRequest<Attachment[]>(`/attachments${query}`, {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal,
  }).then((items) =>
    encrypted && normalizedSearch
      ? items.filter((item) =>
          `${item.fileName} ${item.caption}`
            .toLocaleLowerCase("pl")
            .includes(normalizedSearch),
        )
      : items,
  );
}

export function createAttachmentUploadUrl(
  input: CreateAttachmentUploadUrlRequest,
  options?: ApiCallOptionsInput,
): Promise<AttachmentUploadContract> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<AttachmentUploadContract, CreateAttachmentUploadUrlRequest>(
    "/attachments/upload-url",
    {
      accessToken: requestOptions.accessToken,
      body: input,
      method: "POST",
      signal: requestOptions.signal,
    },
  );
}

export async function uploadAttachmentFile(
  input: UploadAttachmentFileRequest,
  options?: ApiCallOptionsInput,
): Promise<LocalAttachmentUploadResponse> {
  const requestOptions = normalizeApiCallOptions(options);
  const formData = new FormData();

  formData.append("storagePath", input.storagePath);
  formData.append("mimeType", input.mimeType);
  formData.append("file", {
    name: input.fileName,
    type: input.mimeType,
    uri: input.fileUri,
  } as unknown as Blob);

  const headers: Record<string, string> = { Accept: "application/json" };

  if (requestOptions.accessToken) {
    headers.Authorization = `Bearer ${requestOptions.accessToken}`;
  }

  const response = await fetch(buildAttachmentUploadUrl(input.uploadUrl), {
    body: formData,
    headers,
    method: "POST",
    signal: requestOptions.signal,
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(response);
  }

  return readJsonResponse<LocalAttachmentUploadResponse>(response);
}

export function createAttachmentRecord(
  input: CreateAttachmentRequest,
  options?: ApiCallOptionsInput,
): Promise<Attachment> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<Attachment, CreateAttachmentRequest>("/attachments", {
    accessToken: requestOptions.accessToken,
    body: input,
    method: "POST",
    signal: requestOptions.signal,
  });
}

export function updateAttachment(
  id: string,
  input: UpdateAttachmentRequest,
  options?: ApiCallOptionsInput,
): Promise<Attachment> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<Attachment, UpdateAttachmentRequest>(`/attachments/${id}`, {
    accessToken: requestOptions.accessToken,
    body: input,
    method: "PATCH",
    signal: requestOptions.signal,
  });
}

export function deleteAttachment(
  id: string,
  options?: ApiCallOptionsInput,
): Promise<OkResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<OkResponse>(`/attachments/${id}`, {
    accessToken: requestOptions.accessToken,
    method: "DELETE",
    signal: requestOptions.signal,
  });
}

export function getAttachmentFileUrl(id: string): string {
  return buildApiUrl(`/attachments/${id}/file`);
}

export function getAttachmentFileRequest(
  id: string,
  options?: ApiCallOptionsInput,
): { headers?: Record<string, string>; uri: string } {
  const requestOptions = normalizeApiCallOptions(options);
  const headers = requestOptions.accessToken
    ? { Authorization: `Bearer ${requestOptions.accessToken}` }
    : undefined;

  return { headers, uri: getAttachmentFileUrl(id) };
}

export function listShoppingLists(
  options?: ApiCallOptionsInput,
): Promise<ShoppingList[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<ShoppingList[]>("/shopping-lists", {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal,
  });
}

export function listShoppingItems(
  type: ShoppingListType,
  options?: ApiCallOptionsInput,
): Promise<ShoppingItem[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<ShoppingItem[]>(`/shopping-lists/${type}/items`, {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal,
  });
}

export async function getPantryDashboard(
  options?: ApiCallOptionsInput,
): Promise<PantryDashboard> {
  const requestOptions = normalizeApiCallOptions(options);

  const dashboard = await apiRequest<PantryDashboard>(
    "/shopping-lists/pantry/dashboard",
    {
      accessToken: requestOptions.accessToken,
      signal: requestOptions.signal,
    },
  );

  if (!isRuntimeModuleEncrypted("shopping")) {
    return dashboard;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const warningDate = new Date(today);
  warningDate.setDate(warningDate.getDate() + 7);
  const datedItems = dashboard.items.filter((item) => item.expirationDate);

  return {
    ...dashboard,
    stats: {
      ...dashboard.stats,
      expired: datedItems.filter(
        (item) => new Date(`${item.expirationDate}T12:00:00`) < today,
      ).length,
      expiringSoon: datedItems.filter((item) => {
        const expiration = new Date(`${item.expirationDate}T12:00:00`);
        return expiration >= today && expiration <= warningDate;
      }).length,
      total: dashboard.items.length,
    },
  };
}

export function createShoppingItem(
  type: ShoppingListType,
  input: CreateShoppingItemRequest,
  options?: ApiCallOptionsInput,
): Promise<ShoppingItem> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<ShoppingItem, CreateShoppingItemRequest>(
    `/shopping-lists/${type}/items`,
    {
      accessToken: requestOptions.accessToken,
      body: input,
      method: "POST",
      signal: requestOptions.signal,
    },
  );
}

export async function importShoppingItemsWithAi(
  type: ShoppingListType,
  input: ImportShoppingItemsWithAiRequest,
  options?: ApiCallOptionsInput,
): Promise<ImportShoppingItemsWithAiResponse> {
  const requestOptions = normalizeApiCallOptions(options);
  const encryptResultsClientSide = isRuntimeModuleEncrypted("shopping");

  const response = await apiRequest<
    ImportShoppingItemsWithAiResponse,
    ImportShoppingItemsWithAiRequest
  >(`/shopping-lists/${type}/items/ai-import`, {
    accessToken: requestOptions.accessToken,
    body: encryptResultsClientSide ? { ...input, planOnly: true } : input,
    method: "POST",
    signal: requestOptions.signal,
  });

  if (!encryptResultsClientSide) {
    return response;
  }

  const items: ShoppingItem[] = [];

  for (const plannedItem of response.plannedItems ?? []) {
    items.push(
      await createShoppingItem(
        type,
        {
          category: plannedItem.category,
          name: plannedItem.name,
          quantity: plannedItem.quantity,
        },
        requestOptions,
      ),
    );
  }

  return {
    ...response,
    importedCount: items.length,
    items,
  };
}

export function updateShoppingItem(
  id: string,
  input: UpdateShoppingItemRequest,
  options?: ApiCallOptionsInput,
): Promise<ShoppingItem> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<ShoppingItem, UpdateShoppingItemRequest>(
    `/shopping-lists/items/${id}`,
    {
      accessToken: requestOptions.accessToken,
      body: input,
      method: "PATCH",
      signal: requestOptions.signal,
    },
  );
}

export function checkShoppingItem(
  id: string,
  options?: ApiCallOptionsInput,
): Promise<ShoppingItem> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<ShoppingItem>(`/shopping-lists/items/${id}/check`, {
    accessToken: requestOptions.accessToken,
    method: "POST",
    signal: requestOptions.signal,
  });
}

export function toggleShoppingItem(
  id: string,
  options?: ApiCallOptionsInput,
): Promise<ShoppingItem> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<ShoppingItem>(`/shopping-lists/items/${id}/toggle`, {
    accessToken: requestOptions.accessToken,
    method: "POST",
    signal: requestOptions.signal,
  });
}

export function moveShoppingItem(
  id: string,
  input: MoveShoppingItemRequest,
  options?: ApiCallOptionsInput,
): Promise<ShoppingItem> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<ShoppingItem, MoveShoppingItemRequest>(
    `/shopping-lists/items/${id}/move`,
    {
      accessToken: requestOptions.accessToken,
      body: input,
      method: "POST",
      signal: requestOptions.signal,
    },
  );
}

export function clearShoppingList(
  type: ShoppingListType,
  options?: ApiCallOptionsInput,
): Promise<BulkShoppingResult> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<BulkShoppingResult>(`/shopping-lists/${type}/items`, {
    accessToken: requestOptions.accessToken,
    method: "DELETE",
    signal: requestOptions.signal,
  });
}

export function moveUncheckedShoppingToTomorrow(
  options?: ApiCallOptionsInput,
): Promise<BulkShoppingResult> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<BulkShoppingResult>(
    "/shopping-lists/daily/move-unchecked-to-tomorrow",
    {
      accessToken: requestOptions.accessToken,
      method: "POST",
      signal: requestOptions.signal,
    },
  );
}

export function deleteShoppingItem(
  id: string,
  options?: ApiCallOptionsInput,
): Promise<OkResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<OkResponse>(`/shopping-lists/items/${id}`, {
    accessToken: requestOptions.accessToken,
    method: "DELETE",
    signal: requestOptions.signal,
  });
}

function buildAttachmentUploadUrl(uploadUrl: string): string {
  if (/^https?:\/\//i.test(uploadUrl)) {
    return uploadUrl;
  }

  if (uploadUrl.startsWith("/api/")) {
    return `${getApiBaseUrl().replace(/\/api$/, "")}${uploadUrl}`;
  }

  return buildApiUrl(uploadUrl);
}

async function readJsonResponse<TResponse>(
  response: Response,
): Promise<TResponse> {
  const text = await response.text();

  if (!text) {
    return undefined as TResponse;
  }

  return JSON.parse(text) as TResponse;
}

function normalizeApiCallOptions(options: ApiCallOptionsInput): ApiCallOptions {
  if (typeof options === "string") {
    return { accessToken: options };
  }

  return options ?? {};
}

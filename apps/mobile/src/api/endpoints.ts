import { apiRequest } from './request';
import type {
  AnnualCost,
  AnnualCostCompletion,
  AnnualCostHistory,
  Attachment,
  BudgetCategory,
  BudgetItem,
  BudgetItemSummary,
  BudgetMonth,
  BudgetMonthDetail,
  CalendarEvent,
  CleaningTask,
  CompleteAnnualCostRequest,
  CompleteCleaningTaskRequest,
  CopyMealPlanRequest,
  CreateAnnualCostRequest,
  CreateAttachmentRequest,
  CreateBudgetCategoryRequest,
  CreateBudgetItemRequest,
  CreateCalendarEventRequest,
  CreateCleaningTaskRequest,
  CreateDataEntryRequest,
  CreateExpenseRequest,
  CreateHouseholdRequest,
  CreateHouseholdResponse,
  CreateInvitationRequest,
  CreateMealIdeaRequest,
  CreateMealPlanRequest,
  CreateNoteRequest,
  CreateShoppingItemRequest,
  CreateTodoItemRequest,
  DataEntry,
  EffectivePermission,
  Expense,
  Household,
  HouseholdInvitation,
  HouseholdMember,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  GoogleLoginRequest,
  Income,
  IncomeSummary,
  LoginRequest,
  LoginResponse,
  MealIdea,
  MealPlanDetail,
  MealPlanEntryRequest,
  MealPlanSummary,
  MealRandomizeRequest,
  MealRandomizeResult,
  Note,
  OkResponse,
  PatchMemberPermissionsRequest,
  RegisterRequest,
  RegisterResponse,
  RefreshTokenRequest,
  ResendVerificationRequest,
  ResendVerificationResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  ShoppingItem,
  ShoppingList,
  ShoppingListType,
  StartDashboard,
  TodoItem,
  UpdateCalendarEventRequest,
  UpdateMealPlanRequest,
  UpdateNoteRequest,
  UpdateShoppingItemRequest,
  UpdateTodoItemRequest,
  UpsertIncomeRequest,
  VerifyEmailRequest,
  VerifyEmailResponse
} from './types';

export interface ApiCallOptions {
  accessToken?: string | null;
  signal?: AbortSignal;
}

export type ApiCallOptionsInput = ApiCallOptions | string | null | undefined;

export function register(
  input: RegisterRequest,
  options?: ApiCallOptionsInput
): Promise<RegisterResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<RegisterResponse, RegisterRequest>('/auth/register', {
    body: input,
    method: 'POST',
    signal: requestOptions.signal
  });
}

export function verifyEmail(
  input: VerifyEmailRequest,
  options?: ApiCallOptionsInput
): Promise<VerifyEmailResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<VerifyEmailResponse, VerifyEmailRequest>('/auth/verify-email', {
    body: input,
    method: 'POST',
    signal: requestOptions.signal
  });
}

export function resendVerification(
  input: ResendVerificationRequest,
  options?: ApiCallOptionsInput
): Promise<ResendVerificationResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<ResendVerificationResponse, ResendVerificationRequest>(
    '/auth/resend-verification',
    {
      body: input,
      method: 'POST',
      signal: requestOptions.signal
    }
  );
}

export function login(input: LoginRequest, options?: ApiCallOptionsInput): Promise<LoginResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<LoginResponse, LoginRequest>('/auth/login', {
    body: input,
    method: 'POST',
    signal: requestOptions.signal
  });
}

export function refreshSession(
  input: RefreshTokenRequest,
  options?: ApiCallOptionsInput
): Promise<LoginResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<LoginResponse, RefreshTokenRequest>('/auth/refresh', {
    body: input,
    method: 'POST',
    signal: requestOptions.signal
  });
}

export function loginWithGoogle(
  input: GoogleLoginRequest,
  options?: ApiCallOptionsInput
): Promise<LoginResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<LoginResponse, GoogleLoginRequest>('/auth/google', {
    body: input,
    method: 'POST',
    signal: requestOptions.signal
  });
}

export function forgotPassword(
  input: ForgotPasswordRequest,
  options?: ApiCallOptionsInput
): Promise<ForgotPasswordResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<ForgotPasswordResponse, ForgotPasswordRequest>('/auth/forgot-password', {
    body: input,
    method: 'POST',
    signal: requestOptions.signal
  });
}

export function resetPassword(
  input: ResetPasswordRequest,
  options?: ApiCallOptionsInput
): Promise<ResetPasswordResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<ResetPasswordResponse, ResetPasswordRequest>('/auth/reset-password', {
    body: input,
    method: 'POST',
    signal: requestOptions.signal
  });
}

export function createHousehold(
  input: CreateHouseholdRequest,
  options?: ApiCallOptionsInput
): Promise<CreateHouseholdResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<CreateHouseholdResponse, CreateHouseholdRequest>('/households', {
    accessToken: requestOptions.accessToken,
    body: input,
    method: 'POST',
    signal: requestOptions.signal
  });
}

export function getStartDashboard(options?: ApiCallOptionsInput): Promise<StartDashboard> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<StartDashboard>('/start/dashboard', {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal
  });
}

export function getMyPermissions(options?: ApiCallOptionsInput): Promise<EffectivePermission[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<EffectivePermission[]>('/households/me/permissions', {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal
  });
}

export function getMyHousehold(options?: ApiCallOptionsInput): Promise<Household> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<Household>('/households/me', {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal
  });
}

export function listHouseholdMembers(options?: ApiCallOptionsInput): Promise<HouseholdMember[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<HouseholdMember[]>('/households/me/members', {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal
  });
}

export function inviteHouseholdMember(
  input: CreateInvitationRequest,
  options?: ApiCallOptionsInput
): Promise<HouseholdInvitation> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<HouseholdInvitation, CreateInvitationRequest>('/households/me/invitations', {
    accessToken: requestOptions.accessToken,
    body: input,
    method: 'POST',
    signal: requestOptions.signal
  });
}

export function removeHouseholdMember(
  memberId: string,
  options?: ApiCallOptionsInput
): Promise<OkResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<OkResponse>(`/households/me/members/${memberId}`, {
    accessToken: requestOptions.accessToken,
    method: 'DELETE',
    signal: requestOptions.signal
  });
}

export function updateMemberPermissions(
  memberId: string,
  input: PatchMemberPermissionsRequest,
  options?: ApiCallOptionsInput
): Promise<EffectivePermission[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<EffectivePermission[], PatchMemberPermissionsRequest>(
    `/households/me/members/${memberId}/permissions`,
    {
      accessToken: requestOptions.accessToken,
      body: input,
      method: 'PATCH',
      signal: requestOptions.signal
    }
  );
}

export function getCurrentBudgetMonth(options?: ApiCallOptionsInput): Promise<BudgetMonthDetail> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<BudgetMonthDetail>('/finance/current-month', {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal
  });
}

export const getFinanceSummary = getCurrentBudgetMonth;

export function getBudgetMonth(
  monthId: string,
  options?: ApiCallOptionsInput
): Promise<BudgetMonthDetail> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<BudgetMonthDetail>(`/finance/months/${monthId}`, {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal
  });
}

export function listBudgetMonths(options?: ApiCallOptionsInput): Promise<BudgetMonth[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<BudgetMonth[]>('/finance/months/archive', {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal
  });
}

export function generateNextBudgetMonth(
  options?: ApiCallOptionsInput
): Promise<BudgetMonthDetail> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<BudgetMonthDetail>('/finance/months/generate-next', {
    accessToken: requestOptions.accessToken,
    method: 'POST',
    signal: requestOptions.signal
  });
}

export function listBudgetCategories(options?: ApiCallOptionsInput): Promise<BudgetCategory[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<BudgetCategory[]>('/finance/categories', {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal
  });
}

export function createBudgetCategory(
  input: CreateBudgetCategoryRequest,
  options?: ApiCallOptionsInput
): Promise<BudgetCategory> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<BudgetCategory, CreateBudgetCategoryRequest>('/finance/categories', {
    accessToken: requestOptions.accessToken,
    body: input,
    method: 'POST',
    signal: requestOptions.signal
  });
}

export async function listBudgetItems(
  options?: ApiCallOptionsInput
): Promise<BudgetItemSummary[]> {
  const detail = await getCurrentBudgetMonth(options);

  return detail.categories.flatMap((category) => category.items);
}

export function createBudgetItem(
  input: CreateBudgetItemRequest,
  options?: ApiCallOptionsInput
): Promise<BudgetItem> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<BudgetItem, CreateBudgetItemRequest>('/finance/budget-items', {
    accessToken: requestOptions.accessToken,
    body: input,
    method: 'POST',
    signal: requestOptions.signal
  });
}

export function createExpense(
  input: CreateExpenseRequest,
  options?: ApiCallOptionsInput
): Promise<Expense> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<Expense, CreateExpenseRequest>('/finance/expenses', {
    accessToken: requestOptions.accessToken,
    body: input,
    method: 'POST',
    signal: requestOptions.signal
  });
}

export async function listIncomes(options?: ApiCallOptionsInput): Promise<IncomeSummary[]> {
  const detail = await getCurrentBudgetMonth(options);

  return detail.incomes;
}

export function upsertIncome(
  memberId: string,
  input: UpsertIncomeRequest,
  options?: ApiCallOptionsInput
): Promise<Income> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<Income, UpsertIncomeRequest>(`/finance/incomes/${memberId}`, {
    accessToken: requestOptions.accessToken,
    body: input,
    method: 'PUT',
    signal: requestOptions.signal
  });
}

export async function getCurrentMealPlanWeek(
  options?: ApiCallOptionsInput
): Promise<MealPlanDetail | null> {
  const requestOptions = normalizeApiCallOptions(options);

  const currentPlan = await apiRequest<MealPlanDetail | null | undefined>('/meal-plans/current', {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal
  });

  return currentPlan ?? null;
}

export function listMealPlanHistory(
  options?: ApiCallOptionsInput
): Promise<MealPlanSummary[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<MealPlanSummary[]>('/meal-plans/history', {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal
  });
}

export function createMealPlan(
  input: CreateMealPlanRequest,
  options?: ApiCallOptionsInput
): Promise<MealPlanDetail> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<MealPlanDetail, CreateMealPlanRequest>('/meal-plans', {
    accessToken: requestOptions.accessToken,
    body: input,
    method: 'POST',
    signal: requestOptions.signal
  });
}

export function updateMealPlan(
  planId: string,
  input: UpdateMealPlanRequest,
  options?: ApiCallOptionsInput
): Promise<MealPlanDetail> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<MealPlanDetail, UpdateMealPlanRequest>(`/meal-plans/${planId}`, {
    accessToken: requestOptions.accessToken,
    body: input,
    method: 'PATCH',
    signal: requestOptions.signal
  });
}

export function upsertMealSlot(
  planId: string,
  entries: MealPlanEntryRequest[],
  options?: ApiCallOptionsInput
): Promise<MealPlanDetail> {
  return updateMealPlan(planId, { entries }, options);
}

export function copyMealPlanWeek(
  planId: string,
  input: CopyMealPlanRequest,
  options?: ApiCallOptionsInput
): Promise<MealPlanDetail> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<MealPlanDetail, CopyMealPlanRequest>(`/meal-plans/${planId}/copy`, {
    accessToken: requestOptions.accessToken,
    body: input,
    method: 'POST',
    signal: requestOptions.signal
  });
}

export function drawMealInspirations(
  input: MealRandomizeRequest,
  options?: ApiCallOptionsInput
): Promise<MealRandomizeResult> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<MealRandomizeResult, MealRandomizeRequest>('/meal-plans/randomize', {
    accessToken: requestOptions.accessToken,
    body: input,
    method: 'POST',
    signal: requestOptions.signal
  });
}

export function listMealIdeas(options?: ApiCallOptionsInput): Promise<MealIdea[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<MealIdea[]>('/meal-ideas', {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal
  });
}

export function createMealIdea(
  input: CreateMealIdeaRequest,
  options?: ApiCallOptionsInput
): Promise<MealIdea> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<MealIdea, CreateMealIdeaRequest>('/meal-ideas', {
    accessToken: requestOptions.accessToken,
    body: input,
    method: 'POST',
    signal: requestOptions.signal
  });
}

export function listCalendarUpcoming(
  limit = 8,
  options?: ApiCallOptionsInput
): Promise<CalendarEvent[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<CalendarEvent[]>(`/calendar/upcoming?limit=${limit}`, {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal
  });
}

export function listCalendarEvents(
  from: string,
  to: string,
  options?: ApiCallOptionsInput
): Promise<CalendarEvent[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<CalendarEvent[]>(
    `/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    {
      accessToken: requestOptions.accessToken,
      signal: requestOptions.signal
    }
  );
}

export function createCalendarEvent(
  input: CreateCalendarEventRequest,
  options?: ApiCallOptionsInput
): Promise<CalendarEvent> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<CalendarEvent, CreateCalendarEventRequest>('/calendar/events', {
    accessToken: requestOptions.accessToken,
    body: input,
    method: 'POST',
    signal: requestOptions.signal
  });
}

export function updateCalendarEvent(
  eventId: string,
  input: UpdateCalendarEventRequest,
  options?: ApiCallOptionsInput
): Promise<CalendarEvent> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<CalendarEvent, UpdateCalendarEventRequest>(`/calendar/events/${eventId}`, {
    accessToken: requestOptions.accessToken,
    body: input,
    method: 'PATCH',
    signal: requestOptions.signal
  });
}

export function listTodoItems(
  status?: 'todo' | 'done',
  options?: ApiCallOptionsInput
): Promise<TodoItem[]> {
  const requestOptions = normalizeApiCallOptions(options);
  const query = status ? `?status=${status}` : '';

  return apiRequest<TodoItem[]>(`/todo-items${query}`, {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal
  });
}

export function createTodoItem(
  input: CreateTodoItemRequest,
  options?: ApiCallOptionsInput
): Promise<TodoItem> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<TodoItem, CreateTodoItemRequest>('/todo-items', {
    accessToken: requestOptions.accessToken,
    body: input,
    method: 'POST',
    signal: requestOptions.signal
  });
}

export function updateTodoItem(
  itemId: string,
  input: UpdateTodoItemRequest,
  options?: ApiCallOptionsInput
): Promise<TodoItem> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<TodoItem, UpdateTodoItemRequest>(`/todo-items/${itemId}`, {
    accessToken: requestOptions.accessToken,
    body: input,
    method: 'PATCH',
    signal: requestOptions.signal
  });
}

export function completeTodoItem(itemId: string, options?: ApiCallOptionsInput): Promise<TodoItem> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<TodoItem>(`/todo-items/${itemId}/done`, {
    accessToken: requestOptions.accessToken,
    method: 'POST',
    signal: requestOptions.signal
  });
}

export function reopenTodoItem(itemId: string, options?: ApiCallOptionsInput): Promise<TodoItem> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<TodoItem>(`/todo-items/${itemId}/reopen`, {
    accessToken: requestOptions.accessToken,
    method: 'POST',
    signal: requestOptions.signal
  });
}

export function deleteTodoItem(itemId: string, options?: ApiCallOptionsInput): Promise<OkResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<OkResponse>(`/todo-items/${itemId}`, {
    accessToken: requestOptions.accessToken,
    method: 'DELETE',
    signal: requestOptions.signal
  });
}

export function listNotes(options?: ApiCallOptionsInput): Promise<Note[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<Note[]>('/notes', {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal
  });
}

export function createNote(
  input: CreateNoteRequest,
  options?: ApiCallOptionsInput
): Promise<Note> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<Note, CreateNoteRequest>('/notes', {
    accessToken: requestOptions.accessToken,
    body: input,
    method: 'POST',
    signal: requestOptions.signal
  });
}

export function updateNote(
  noteId: string,
  input: UpdateNoteRequest,
  options?: ApiCallOptionsInput
): Promise<Note> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<Note, UpdateNoteRequest>(`/notes/${noteId}`, {
    accessToken: requestOptions.accessToken,
    body: input,
    method: 'PATCH',
    signal: requestOptions.signal
  });
}

export function deleteNote(noteId: string, options?: ApiCallOptionsInput): Promise<OkResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<OkResponse>(`/notes/${noteId}`, {
    accessToken: requestOptions.accessToken,
    method: 'DELETE',
    signal: requestOptions.signal
  });
}

export function listCleaningTasks(options?: ApiCallOptionsInput): Promise<CleaningTask[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<CleaningTask[]>('/cleaning', {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal
  });
}

export function createCleaningTask(
  input: CreateCleaningTaskRequest,
  options?: ApiCallOptionsInput
): Promise<CleaningTask> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<CleaningTask, CreateCleaningTaskRequest>('/cleaning', {
    accessToken: requestOptions.accessToken,
    body: input,
    method: 'POST',
    signal: requestOptions.signal
  });
}

export function completeCleaningTask(
  taskId: string,
  input: CompleteCleaningTaskRequest,
  options?: ApiCallOptionsInput
): Promise<CleaningTask> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<CleaningTask, CompleteCleaningTaskRequest>(`/cleaning/${taskId}/complete`, {
    accessToken: requestOptions.accessToken,
    body: input,
    method: 'POST',
    signal: requestOptions.signal
  });
}

export function listAnnualCosts(options?: ApiCallOptionsInput): Promise<AnnualCost[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<AnnualCost[]>('/annual-costs', {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal
  });
}

export function createAnnualCost(
  input: CreateAnnualCostRequest,
  options?: ApiCallOptionsInput
): Promise<AnnualCost> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<AnnualCost, CreateAnnualCostRequest>('/annual-costs', {
    accessToken: requestOptions.accessToken,
    body: input,
    method: 'POST',
    signal: requestOptions.signal
  });
}

export function completeAnnualCost(
  costId: string,
  input: CompleteAnnualCostRequest,
  options?: ApiCallOptionsInput
): Promise<AnnualCostCompletion> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<AnnualCostCompletion, CompleteAnnualCostRequest>(
    `/annual-costs/${costId}/complete`,
    {
      accessToken: requestOptions.accessToken,
      body: input,
      method: 'POST',
      signal: requestOptions.signal
    }
  );
}

export function listAnnualCostHistory(
  year: number,
  options?: ApiCallOptionsInput
): Promise<AnnualCostHistory[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<AnnualCostHistory[]>(`/annual-costs/history?year=${year}`, {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal
  });
}

export function listDataEntries(
  search?: string,
  options?: ApiCallOptionsInput
): Promise<DataEntry[]> {
  const requestOptions = normalizeApiCallOptions(options);
  const query = search ? `?search=${encodeURIComponent(search)}` : '';

  return apiRequest<DataEntry[]>(`/data-entries${query}`, {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal
  });
}

export function createDataEntry(
  input: CreateDataEntryRequest,
  options?: ApiCallOptionsInput
): Promise<DataEntry> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<DataEntry, CreateDataEntryRequest>('/data-entries', {
    accessToken: requestOptions.accessToken,
    body: input,
    method: 'POST',
    signal: requestOptions.signal
  });
}

export function deleteDataEntry(id: string, options?: ApiCallOptionsInput): Promise<OkResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<OkResponse>(`/data-entries/${id}`, {
    accessToken: requestOptions.accessToken,
    method: 'DELETE',
    signal: requestOptions.signal
  });
}

export function listAttachments(
  search?: string,
  options?: ApiCallOptionsInput
): Promise<Attachment[]> {
  const requestOptions = normalizeApiCallOptions(options);
  const query = search ? `?search=${encodeURIComponent(search)}` : '';

  return apiRequest<Attachment[]>(`/attachments${query}`, {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal
  });
}

export function createAttachmentRecord(
  input: CreateAttachmentRequest,
  options?: ApiCallOptionsInput
): Promise<Attachment> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<Attachment, CreateAttachmentRequest>('/attachments', {
    accessToken: requestOptions.accessToken,
    body: input,
    method: 'POST',
    signal: requestOptions.signal
  });
}

export function listShoppingLists(options?: ApiCallOptionsInput): Promise<ShoppingList[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<ShoppingList[]>('/shopping-lists', {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal
  });
}

export function listShoppingItems(
  type: ShoppingListType,
  options?: ApiCallOptionsInput
): Promise<ShoppingItem[]> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<ShoppingItem[]>(`/shopping-lists/${type}/items`, {
    accessToken: requestOptions.accessToken,
    signal: requestOptions.signal
  });
}

export function createShoppingItem(
  type: ShoppingListType,
  input: CreateShoppingItemRequest,
  options?: ApiCallOptionsInput
): Promise<ShoppingItem> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<ShoppingItem, CreateShoppingItemRequest>(`/shopping-lists/${type}/items`, {
    accessToken: requestOptions.accessToken,
    body: input,
    method: 'POST',
    signal: requestOptions.signal
  });
}

export function updateShoppingItem(
  id: string,
  input: UpdateShoppingItemRequest,
  options?: ApiCallOptionsInput
): Promise<ShoppingItem> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<ShoppingItem, UpdateShoppingItemRequest>(`/shopping-lists/items/${id}`, {
    accessToken: requestOptions.accessToken,
    body: input,
    method: 'PATCH',
    signal: requestOptions.signal
  });
}

export function checkShoppingItem(
  id: string,
  options?: ApiCallOptionsInput
): Promise<ShoppingItem> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<ShoppingItem>(`/shopping-lists/items/${id}/check`, {
    accessToken: requestOptions.accessToken,
    method: 'POST',
    signal: requestOptions.signal
  });
}

export function deleteShoppingItem(id: string, options?: ApiCallOptionsInput): Promise<OkResponse> {
  const requestOptions = normalizeApiCallOptions(options);

  return apiRequest<OkResponse>(`/shopping-lists/items/${id}`, {
    accessToken: requestOptions.accessToken,
    method: 'DELETE',
    signal: requestOptions.signal
  });
}

function normalizeApiCallOptions(options: ApiCallOptionsInput): ApiCallOptions {
  if (typeof options === 'string') {
    return {
      accessToken: options
    };
  }

  return options ?? {};
}

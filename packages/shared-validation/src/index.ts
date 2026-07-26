import { z } from 'zod';
import { MODULE_KEYS } from '@homeapp/shared-types';

export const uuidSchema = z.string().uuid();

export const moduleKeySchema = z.enum(MODULE_KEYS);

export const nonEmptyTextSchema = z.string().trim().min(1).max(255);

export const optionalLongTextSchema = z
  .string()
  .trim()
  .max(5000)
  .optional()
  .nullable();

export const moneyAmountSchema = z
  .union([z.string(), z.number()])
  .transform((value) => Number(value))
  .pipe(z.number().finite().min(0));

export const positiveMoneyAmountSchema = z
  .union([z.string(), z.number()])
  .transform((value) => Number(value))
  .pipe(z.number().finite().positive());

export const createExpenseSchema = z.object({
  budgetItemId: uuidSchema,
  amount: positiveMoneyAmountSchema,
  name: z.string().trim().min(1).max(160).optional()
});

export const importExpenseItemSchema = createExpenseSchema.extend({
  clientId: uuidSchema,
  occurredAt: z.string().datetime({ offset: true }).optional(),
  originalAmount: positiveMoneyAmountSchema.optional(),
  originalCurrency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .optional(),
  sourceExternalId: uuidSchema
});

export const importExpensesSchema = z.object({
  items: z.array(importExpenseItemSchema).min(1).max(100)
});

export const upsertIncomeSchema = z.object({
  amount: moneyAmountSchema
});

export const createBudgetCategorySchema = z.object({
  name: nonEmptyTextSchema,
  displayOrder: z.number().int().min(0).default(0),
  copyBudgetToNextMonth: z.boolean().default(false)
});

export const createBudgetItemSchema = z.object({
  budgetMonthId: uuidSchema,
  ownerMemberId: uuidSchema,
  categoryId: uuidSchema,
  name: nonEmptyTextSchema,
  budgetAmount: moneyAmountSchema.nullable().optional(),
  displayOrder: z.number().int().min(0).default(0)
});

export const createShoppingItemSchema = z.object({
  name: nonEmptyTextSchema,
  quantity: z.string().trim().max(80).default(''),
  displayOrder: z.number().int().min(0).default(0)
});

export const createTodoSchema = z.object({
  title: nonEmptyTextSchema,
  description: optionalLongTextSchema,
  scopeType: z.literal('household')
});

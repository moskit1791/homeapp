import { BadRequestException, Injectable } from "@nestjs/common";
import {
  ENCRYPTABLE_MODULE_KEYS,
  EncryptableModuleKey,
} from "@homeapp/shared-types";
import type { PoolClient } from "pg";
import { DatabaseService } from "../database/database.service";
import { RealtimeService } from "../realtime/realtime.service";
import {
  EncryptionMigrationEntity,
  EncryptionMigrationItemDto,
  RemoveHouseholdEncryptionDto,
  UpdateHouseholdEncryptionDto,
} from "./dto/encryption.dto";

@Injectable()
export class EncryptionService {
  constructor(
    private readonly database: DatabaseService,
    private readonly realtime: RealtimeService,
  ) {}

  acquireHouseholdWriteLock(householdId: string): Promise<() => Promise<void>> {
    return this.database.acquireAdvisoryLock(
      this.householdLockKey(householdId),
    );
  }

  async getSettings(householdId: string): Promise<HouseholdEncryptionSettings> {
    const result = await this.database.query<EncryptionSettingsRow>(
      `
        select
          enabled_modules,
          key_version,
          kdf_salt,
          wrapped_key,
          recovery_wrapped_key,
          updated_at
        from household_encryption_settings
        where household_id = $1
        limit 1
      `,
      [householdId],
    );
    const row = result.rows[0];

    if (!row) {
      return {
        configured: false,
        enabledModules: [],
        householdId,
        kdfSalt: null,
        keyVersion: null,
        recoveryWrappedKey: null,
        updatedAt: null,
        wrappedKey: null,
      };
    }

    return {
      configured: true,
      enabledModules: row.enabled_modules,
      householdId,
      kdfSalt: row.kdf_salt,
      keyVersion: row.key_version,
      recoveryWrappedKey: row.recovery_wrapped_key,
      updatedAt: row.updated_at,
      wrappedKey: row.wrapped_key,
    };
  }

  async updateSettings(
    householdId: string,
    memberId: string,
    dto: UpdateHouseholdEncryptionDto,
  ): Promise<HouseholdEncryptionSettings> {
    await this.database.transaction(async (client) => {
      await client.query(
        "select pg_advisory_xact_lock(hashtextextended($1, 0))",
        [this.householdLockKey(householdId)],
      );
      const currentResult = await client.query<EncryptionSettingsRow>(
        `
          select enabled_modules, key_version, kdf_salt, wrapped_key,
            recovery_wrapped_key, updated_at
          from household_encryption_settings
          where household_id = $1
          for update
        `,
        [householdId],
      );

      this.validateSettingsTransition(currentResult.rows[0], dto);

      for (const item of dto.migrationItems ?? []) {
        this.validateMigrationDirection(item, dto);
        await this.assertMigrationSourceRevision(client, householdId, item);
        await this.applyMigrationItem(client, householdId, item);
      }

      if (!dto.enabledModules.includes("finances")) {
        await this.recalculatePlaintextSavings(client, householdId);
      }

      await Promise.all(
        ENCRYPTABLE_MODULE_KEYS.map((module) =>
          this.assertModuleState(
            client,
            householdId,
            module,
            dto.enabledModules.includes(module),
            dto.keyVersion,
          ),
        ),
      );

      await client.query(
        `
          insert into household_encryption_settings (
            household_id,
            enabled_modules,
            key_version,
            kdf_salt,
            wrapped_key,
            recovery_wrapped_key,
            configured_by_member_id
          )
          values ($1, $2, $3, $4, $5, $6, $7)
          on conflict (household_id) do update
          set
            enabled_modules = excluded.enabled_modules,
            key_version = excluded.key_version,
            kdf_salt = excluded.kdf_salt,
            wrapped_key = excluded.wrapped_key,
            recovery_wrapped_key = excluded.recovery_wrapped_key,
            configured_by_member_id = excluded.configured_by_member_id
        `,
        [
          householdId,
          dto.enabledModules,
          dto.keyVersion,
          dto.kdfSalt,
          dto.wrappedKey,
          dto.recoveryWrappedKey,
          memberId,
        ],
      );
    });

    this.realtime.publish(householdId, "household.changed", "encryption");

    return this.getSettings(householdId);
  }

  async removeSettings(
    householdId: string,
    dto: RemoveHouseholdEncryptionDto,
  ): Promise<HouseholdEncryptionSettings> {
    const removed = await this.database.transaction(async (client) => {
      await client.query(
        "select pg_advisory_xact_lock(hashtextextended($1, 0))",
        [this.householdLockKey(householdId)],
      );
      const currentResult = await client.query<EncryptionSettingsRow>(
        `
          select enabled_modules, key_version, kdf_salt, wrapped_key,
            recovery_wrapped_key, updated_at
          from household_encryption_settings
          where household_id = $1
          for update
        `,
        [householdId],
      );
      const current = currentResult.rows[0];

      if (!current) {
        return false;
      }

      const removalSettings: UpdateHouseholdEncryptionDto = {
        enabledModules: [],
        expectedUpdatedAt: dto.expectedUpdatedAt,
        kdfSalt: current.kdf_salt,
        keyVersion: dto.keyVersion,
        migrationItems: dto.migrationItems,
        recoveryWrappedKey: current.recovery_wrapped_key,
        wrappedKey: current.wrapped_key,
      };

      this.validateSettingsTransition(current, removalSettings);

      for (const item of dto.migrationItems ?? []) {
        this.validateMigrationDirection(item, removalSettings);
        await this.assertMigrationSourceRevision(client, householdId, item);
        await this.applyMigrationItem(client, householdId, item);
      }

      await this.recalculatePlaintextSavings(client, householdId);
      await Promise.all(
        ENCRYPTABLE_MODULE_KEYS.map((module) =>
          this.assertModuleState(
            client,
            householdId,
            module,
            false,
            dto.keyVersion,
          ),
        ),
      );
      await client.query(
        "delete from household_encryption_settings where household_id = $1",
        [householdId],
      );

      return true;
    });

    if (removed) {
      this.realtime.publish(householdId, "household.changed", "encryption");
    }

    return this.unconfiguredSettings(householdId);
  }

  async exportModule(
    householdId: string,
    module: EncryptableModuleKey,
  ): Promise<EncryptionExportItem[]> {
    const query = this.exportQueryForModule(module);
    const result = await this.database.query<EncryptionExportRow>(query, [
      householdId,
    ]);

    return result.rows.map((row) => ({
      encryptedPayload: row.encrypted_payload,
      encryptionVersion: row.encryption_version,
      entity: row.entity,
      id: row.id,
      plaintextPayload: row.plaintext_payload,
      sourceRevision: row.source_revision,
    }));
  }

  private exportQueryForModule(module: EncryptableModuleKey): string {
    switch (module) {
      case "calendar":
        return this.calendarExportQuery();
      case "finances":
        return this.financeExportQuery();
      case "meal_planner":
        return `
          select * from (
            select 'meal-plan-entry'::text as entity, mpe.id, mpe.encrypted_payload,
              mpe.encryption_version,
              case when mpe.encrypted_payload is null then jsonb_build_object(
                'mealName', mpe.meal_name, 'linkUrl', mpe.link_url, 'note', mpe.note
              ) else null end as plaintext_payload,
              mpe.encryption_migration_revision as source_revision
            from meal_plan_entries mpe
            join meal_plan_weeks mpw on mpw.id = mpe.meal_plan_week_id
            where mpw.household_id = $1
            union all
            select 'meal-idea', mi.id, mi.encrypted_payload, mi.encryption_version,
              case when mi.encrypted_payload is null then jsonb_build_object(
                'title', mi.title, 'linkUrl', mi.link_url, 'note', mi.note
              ) else null end,
              mi.encryption_migration_revision
            from meal_ideas mi where mi.household_id = $1
          ) exported order by entity, id
        `;
      case "shopping":
        return `
          select 'shopping-item'::text as entity, sli.id, sli.encrypted_payload,
            sli.encryption_version,
            case when sli.encrypted_payload is null then jsonb_build_object(
              'name', sli.name, 'quantity', sli.quantity, 'category', sli.category,
              'expirationDate', sli.expiration_date
            ) else null end as plaintext_payload,
            sli.encryption_migration_revision as source_revision
          from shopping_list_items sli
          join shopping_lists sl on sl.id = sli.shopping_list_id
          where sl.household_id = $1 order by sli.id
        `;
      case "todo":
        return `
          select 'todo-item'::text as entity, id, encrypted_payload, encryption_version,
            case when encrypted_payload is null then jsonb_build_object(
              'title', title, 'description', description
            ) else null end as plaintext_payload,
            encryption_migration_revision as source_revision
          from todo_items where household_id = $1 order by id
        `;
      case "notes":
        return `
          select 'note-item'::text as entity, id, encrypted_payload, encryption_version,
            case when encrypted_payload is null then jsonb_build_object(
              'title', title, 'description', description
            ) else null end as plaintext_payload,
            encryption_migration_revision as source_revision
          from note_items where household_id = $1 order by id
        `;
      case "cleaning":
        return `
          select 'cleaning-task'::text as entity, id, encrypted_payload, encryption_version,
            case when encrypted_payload is null then jsonb_build_object(
              'name', name, 'location', location
            ) else null end as plaintext_payload,
            encryption_migration_revision as source_revision
          from cleaning_tasks where household_id = $1 order by id
        `;
      case "annual_costs":
        return `
          select * from (
            select 'annual-cost'::text as entity, ac.id, ac.encrypted_payload,
              ac.encryption_version,
              case when ac.encrypted_payload is null then jsonb_build_object(
                'name', ac.name, 'defaultAmount', ac.default_amount::double precision
              ) else null end as plaintext_payload,
              ac.encryption_migration_revision as source_revision
            from annual_costs ac where ac.household_id = $1
            union all
            select 'annual-cost-history', ach.id, ach.encrypted_payload,
              ach.encryption_version,
              case when ach.encrypted_payload is null then jsonb_build_object(
                'amount', ach.amount::double precision
              ) else null end,
              ach.encryption_migration_revision
            from annual_cost_history ach
            join annual_costs ac on ac.id = ach.annual_cost_id
            where ac.household_id = $1
          ) exported order by entity, id
        `;
      case "data_entries":
        return `
          select 'data-entry'::text as entity, id, encrypted_payload, encryption_version,
            case when encrypted_payload is null then jsonb_build_object(
              'title', title, 'value', value
            ) else null end as plaintext_payload,
            encryption_migration_revision as source_revision
          from data_entries where household_id = $1 order by id
        `;
      case "attachments":
        return `
          select 'attachment'::text as entity, id, encrypted_payload, encryption_version,
            case when encrypted_payload is null then jsonb_build_object(
              'fileName', file_name, 'caption', caption
            ) else null end as plaintext_payload,
            encryption_migration_revision as source_revision
          from attachments where household_id = $1 order by id
        `;
    }
  }

  private calendarExportQuery(): string {
    return `
      select
        'calendar-event'::text as entity,
        id,
        encrypted_payload,
        encryption_version,
        case when encrypted_payload is null then jsonb_build_object(
          'title', title,
          'note', note,
          'locationName', location_name,
          'locationUrl', location_url
        ) else null end as plaintext_payload,
        encryption_migration_revision as source_revision
      from calendar_events
      where household_id = $1
      order by created_at asc
    `;
  }

  private financeExportQuery(): string {
    return `
      select * from (
        select
          'budget-category'::text as entity,
          bc.id,
          bc.encrypted_payload,
          bc.encryption_version,
          case when bc.encrypted_payload is null then jsonb_build_object('name', bc.name) else null end as plaintext_payload,
          bc.encryption_migration_revision as source_revision
        from budget_categories bc
        where bc.household_id = $1

        union all

        select
          'budget-item',
          bi.id,
          bi.encrypted_payload,
          bi.encryption_version,
          case when bi.encrypted_payload is null then jsonb_build_object(
            'name', bi.name,
            'budgetAmount', bi.budget_amount::double precision
          ) else null end,
          bi.encryption_migration_revision
        from budget_items bi
        join budget_months bm on bm.id = bi.budget_month_id
        where bm.household_id = $1

        union all

        select
          'expense',
          e.id,
          e.encrypted_payload,
          e.encryption_version,
          case when e.encrypted_payload is null then jsonb_strip_nulls(jsonb_build_object(
            'amount', e.amount::double precision,
            'name', e.name,
            'occurredAt', e.occurred_at,
            'originalAmount', e.original_amount::double precision,
            'originalCurrency', e.original_currency
          )) else null end,
          e.encryption_migration_revision
        from expenses e
        join budget_items bi on bi.id = e.budget_item_id
        join budget_months bm on bm.id = bi.budget_month_id
        where bm.household_id = $1

        union all

        select
          'income',
          mi.id,
          mi.encrypted_payload,
          mi.encryption_version,
          case when mi.encrypted_payload is null then jsonb_build_object('amount', mi.amount::double precision) else null end,
          mi.encryption_migration_revision
        from monthly_incomes mi
        join budget_months bm on bm.id = mi.budget_month_id
        where bm.household_id = $1

        union all

        select
          'finance-debt',
          fd.id,
          fd.encrypted_payload,
          fd.encryption_version,
          case when fd.encrypted_payload is null then jsonb_build_object(
            'amount', fd.amount::double precision,
            'lenderName', fd.lender_name,
            'purpose', fd.purpose,
            'note', fd.note
          ) else null end,
          fd.encryption_migration_revision
        from finance_debts fd
        where fd.household_id = $1

        union all

        select
          'finance-debt-payment',
          fdp.id,
          fdp.encrypted_payload,
          fdp.encryption_version,
          case when fdp.encrypted_payload is null then jsonb_build_object(
            'amount', fdp.amount::double precision,
            'note', fdp.note
          ) else null end,
          fdp.encryption_migration_revision
        from finance_debt_payments fdp
        join finance_debts fd on fd.id = fdp.finance_debt_id
        where fd.household_id = $1

        union all

        select
          'finance-savings-account',
          fsa.id,
          fsa.encrypted_payload,
          fsa.encryption_version,
          case when fsa.encrypted_payload is null then jsonb_build_object(
            'name', fsa.name,
            'targetAmount', fsa.target_amount::double precision,
            'currentAmount', fsa.current_amount::double precision
          ) else null end,
          fsa.encryption_migration_revision
        from finance_savings_accounts fsa
        where fsa.household_id = $1

        union all

        select
          'finance-savings-transaction',
          fst.id,
          fst.encrypted_payload,
          fst.encryption_version,
          case when fst.encrypted_payload is null then jsonb_build_object(
            'amount', fst.amount::double precision,
            'note', fst.note
          ) else null end,
          fst.encryption_migration_revision
        from finance_savings_transactions fst
        join finance_savings_accounts fsa on fsa.id = fst.savings_account_id
        where fsa.household_id = $1
      ) exported
      order by entity asc, id asc
    `;
  }

  private validateMigrationDirection(
    item: EncryptionMigrationItemDto,
    dto: UpdateHouseholdEncryptionDto,
  ): void {
    if (item.encryptionVersion !== dto.keyVersion) {
      throw new BadRequestException(
        "Migration item uses an outdated encryption key",
      );
    }

    const module = this.moduleForEntity(item.entity);
    const shouldEncrypt = dto.enabledModules.includes(module);
    const hasEncrypted = Boolean(item.encryptedPayload);
    const hasPlaintext = item.plaintextPayload !== undefined;

    if (hasEncrypted === hasPlaintext || hasEncrypted !== shouldEncrypt) {
      throw new BadRequestException("Invalid encryption migration direction");
    }
  }

  private validateSettingsTransition(
    current: EncryptionSettingsRow | undefined,
    dto: UpdateHouseholdEncryptionDto,
  ): void {
    if (!current) {
      if (dto.expectedUpdatedAt || dto.keyVersion !== 1) {
        throw new BadRequestException(
          "Encryption settings changed. Refresh and try again",
        );
      }
      return;
    }

    const currentUpdatedAt = new Date(current.updated_at).getTime();
    const expectedUpdatedAt = dto.expectedUpdatedAt
      ? new Date(dto.expectedUpdatedAt).getTime()
      : Number.NaN;

    if (
      !Number.isFinite(expectedUpdatedAt) ||
      currentUpdatedAt !== expectedUpdatedAt
    ) {
      throw new BadRequestException(
        "Encryption settings changed. Refresh and try again",
      );
    }

    const credentialsChanged =
      dto.kdfSalt !== current.kdf_salt ||
      dto.wrappedKey !== current.wrapped_key ||
      dto.recoveryWrappedKey !== current.recovery_wrapped_key;
    const expectedVersion = credentialsChanged
      ? current.key_version + 1
      : current.key_version;

    if (dto.keyVersion !== expectedVersion) {
      throw new BadRequestException(
        credentialsChanged
          ? "Changing encryption credentials requires rotating the data key"
          : "Encryption key version cannot change without new credentials",
      );
    }
  }

  private async assertMigrationSourceRevision(
    client: PoolClient,
    householdId: string,
    item: EncryptionMigrationItemDto,
  ): Promise<void> {
    const result = await client.query<{ source_revision: string }>(
      this.migrationRevisionQuery(item.entity),
      [householdId, item.id],
    );

    if (result.rows[0]?.source_revision !== item.sourceRevision) {
      throw new BadRequestException(
        "Dane zmieniły się podczas migracji szyfrowania. Odśwież dane i spróbuj ponownie.",
      );
    }
  }

  private migrationRevisionQuery(entity: EncryptionMigrationEntity): string {
    switch (entity) {
      case "calendar-event":
        return `select encryption_migration_revision::text as source_revision from calendar_events
          where household_id = $1 and id = $2 for update`;
      case "budget-category":
        return `select encryption_migration_revision::text as source_revision from budget_categories
          where household_id = $1 and id = $2 for update`;
      case "budget-item":
        return `select bi.encryption_migration_revision::text as source_revision from budget_items bi
          join budget_months bm on bm.id = bi.budget_month_id
          where bm.household_id = $1 and bi.id = $2 for update of bi`;
      case "expense":
        return `select e.encryption_migration_revision::text as source_revision from expenses e
          join budget_items bi on bi.id = e.budget_item_id
          join budget_months bm on bm.id = bi.budget_month_id
          where bm.household_id = $1 and e.id = $2 for update of e`;
      case "income":
        return `select mi.encryption_migration_revision::text as source_revision from monthly_incomes mi
          join budget_months bm on bm.id = mi.budget_month_id
          where bm.household_id = $1 and mi.id = $2 for update of mi`;
      case "finance-debt":
        return `select encryption_migration_revision::text as source_revision from finance_debts
          where household_id = $1 and id = $2 for update`;
      case "finance-debt-payment":
        return `select fdp.encryption_migration_revision::text as source_revision from finance_debt_payments fdp
          join finance_debts fd on fd.id = fdp.finance_debt_id
          where fd.household_id = $1 and fdp.id = $2 for update of fdp`;
      case "finance-savings-account":
        return `select encryption_migration_revision::text as source_revision from finance_savings_accounts
          where household_id = $1 and id = $2 for update`;
      case "finance-savings-transaction":
        return `select fst.encryption_migration_revision::text as source_revision from finance_savings_transactions fst
          join finance_savings_accounts fsa on fsa.id = fst.savings_account_id
          where fsa.household_id = $1 and fst.id = $2 for update of fst`;
      case "meal-plan-entry":
        return `select mpe.encryption_migration_revision::text as source_revision from meal_plan_entries mpe
          join meal_plan_weeks mpw on mpw.id = mpe.meal_plan_week_id
          where mpw.household_id = $1 and mpe.id = $2 for update of mpe`;
      case "meal-idea":
        return `select encryption_migration_revision::text as source_revision from meal_ideas
          where household_id = $1 and id = $2 for update`;
      case "shopping-item":
        return `select sli.encryption_migration_revision::text as source_revision from shopping_list_items sli
          join shopping_lists sl on sl.id = sli.shopping_list_id
          where sl.household_id = $1 and sli.id = $2 for update of sli`;
      case "todo-item":
        return `select encryption_migration_revision::text as source_revision from todo_items
          where household_id = $1 and id = $2 for update`;
      case "note-item":
        return `select encryption_migration_revision::text as source_revision from note_items
          where household_id = $1 and id = $2 for update`;
      case "cleaning-task":
        return `select encryption_migration_revision::text as source_revision from cleaning_tasks
          where household_id = $1 and id = $2 for update`;
      case "annual-cost":
        return `select encryption_migration_revision::text as source_revision from annual_costs
          where household_id = $1 and id = $2 for update`;
      case "annual-cost-history":
        return `select ach.encryption_migration_revision::text as source_revision from annual_cost_history ach
          join annual_costs ac on ac.id = ach.annual_cost_id
          where ac.household_id = $1 and ach.id = $2 for update of ach`;
      case "data-entry":
        return `select encryption_migration_revision::text as source_revision from data_entries
          where household_id = $1 and id = $2 for update`;
      case "attachment":
        return `select encryption_migration_revision::text as source_revision from attachments
          where household_id = $1 and id = $2 for update`;
    }
  }

  private moduleForEntity(
    entity: EncryptionMigrationEntity,
  ): EncryptableModuleKey {
    switch (entity) {
      case "calendar-event":
        return "calendar";
      case "budget-category":
      case "budget-item":
      case "expense":
      case "income":
      case "finance-debt":
      case "finance-debt-payment":
      case "finance-savings-account":
      case "finance-savings-transaction":
        return "finances";
      case "meal-plan-entry":
      case "meal-idea":
        return "meal_planner";
      case "shopping-item":
        return "shopping";
      case "todo-item":
        return "todo";
      case "note-item":
        return "notes";
      case "cleaning-task":
        return "cleaning";
      case "annual-cost":
      case "annual-cost-history":
        return "annual_costs";
      case "data-entry":
        return "data_entries";
      case "attachment":
        return "attachments";
    }
  }

  private async applyMigrationItem(
    client: PoolClient,
    householdId: string,
    item: EncryptionMigrationItemDto,
  ): Promise<void> {
    const encrypted = Boolean(item.encryptedPayload);
    const payload = item.plaintextPayload ?? {};
    let result: { rowCount: number | null };

    switch (item.entity) {
      case "calendar-event":
        result = await client.query(
          encrypted
            ? `update calendar_events set title = '[Zaszyfrowane wydarzenie]', note = null,
                location_name = null, location_url = null, encrypted_payload = $3, encryption_version = $4
              where household_id = $1 and id = $2`
            : `update calendar_events set title = $3, note = $4, location_name = $5, location_url = $6,
                encrypted_payload = null, encryption_version = null where household_id = $1 and id = $2`,
          encrypted
            ? [
                householdId,
                item.id,
                item.encryptedPayload,
                item.encryptionVersion,
              ]
            : [
                householdId,
                item.id,
                this.text(payload.title, "calendar title", 200),
                this.nullableText(payload.note, "calendar note", 5000),
                this.nullableText(
                  payload.locationName,
                  "calendar location",
                  500,
                ),
                this.nullableText(
                  payload.locationUrl,
                  "calendar location URL",
                  1000,
                ),
              ],
        );
        break;
      case "budget-category":
        result = await client.query(
          encrypted
            ? `update budget_categories set name = '[Zaszyfrowana kategoria ' || id::text || ']', encrypted_payload = $3,
                encryption_version = $4 where household_id = $1 and id = $2`
            : `update budget_categories set name = $3, encrypted_payload = null, encryption_version = null
                where household_id = $1 and id = $2`,
          encrypted
            ? [
                householdId,
                item.id,
                item.encryptedPayload,
                item.encryptionVersion,
              ]
            : [
                householdId,
                item.id,
                this.text(payload.name, "category name", 120),
              ],
        );
        break;
      case "budget-item":
        result = await client.query(
          encrypted
            ? `update budget_items bi set name = '[Zaszyfrowana pozycja]', budget_amount = null,
                encrypted_payload = $3, encryption_version = $4
              where bi.id = $2 and exists (
                select 1 from budget_months bm where bm.id = bi.budget_month_id and bm.household_id = $1
              )`
            : `update budget_items bi set name = $3, budget_amount = $4, encrypted_payload = null,
                encryption_version = null where bi.id = $2 and exists (
                  select 1 from budget_months bm where bm.id = bi.budget_month_id and bm.household_id = $1
                )`,
          encrypted
            ? [
                householdId,
                item.id,
                item.encryptedPayload,
                item.encryptionVersion,
              ]
            : [
                householdId,
                item.id,
                this.text(payload.name, "budget item name", 160),
                this.nullableMoney(payload.budgetAmount, "budget amount", 0),
              ],
        );
        break;
      case "expense":
        result = await client.query(
          encrypted
            ? `update expenses e set
                amount = 0.01,
                name = '[Zaszyfrowany wydatek]',
                occurred_at = null,
                original_amount = null,
                original_currency = null,
                encrypted_payload = $3,
                encryption_version = $4
              where e.id = $2 and exists (
                select 1 from budget_items bi join budget_months bm on bm.id = bi.budget_month_id
                where bi.id = e.budget_item_id and bm.household_id = $1
              )`
            : `update expenses e set
                amount = $3,
                name = $4,
                occurred_at = $5,
                original_amount = $6,
                original_currency = $7,
                encrypted_payload = null,
                encryption_version = null
              where e.id = $2 and exists (
                select 1 from budget_items bi join budget_months bm on bm.id = bi.budget_month_id
                where bi.id = e.budget_item_id and bm.household_id = $1
              )`,
          encrypted
            ? [
                householdId,
                item.id,
                item.encryptedPayload,
                item.encryptionVersion,
              ]
            : [
                householdId,
                item.id,
                this.money(payload.amount, "expense amount", 0.01),
                this.nullableText(payload.name, "expense name", 160),
                this.nullableDateTime(
                  payload.occurredAt,
                  "expense occurrence time",
                ),
                this.nullableMoney(
                  payload.originalAmount,
                  "original expense amount",
                  0.01,
                ),
                this.nullableCurrency(
                  payload.originalCurrency,
                  "original expense currency",
                ),
              ],
        );
        break;
      case "income":
        result = await client.query(
          encrypted
            ? `update monthly_incomes mi set amount = 0, encrypted_payload = $3, encryption_version = $4
              where mi.id = $2 and exists (
                select 1 from budget_months bm where bm.id = mi.budget_month_id and bm.household_id = $1
              )`
            : `update monthly_incomes mi set amount = $3, encrypted_payload = null, encryption_version = null
              where mi.id = $2 and exists (
                select 1 from budget_months bm where bm.id = mi.budget_month_id and bm.household_id = $1
              )`,
          encrypted
            ? [
                householdId,
                item.id,
                item.encryptedPayload,
                item.encryptionVersion,
              ]
            : [
                householdId,
                item.id,
                this.money(payload.amount, "income amount", 0),
              ],
        );
        break;
      case "finance-debt":
        result = await client.query(
          encrypted
            ? `update finance_debts set lender_name = '[Zaszyfrowany pożyczkodawca]',
                purpose = '[Zaszyfrowany cel]', amount = 0.01, note = null,
                encrypted_payload = $3, encryption_version = $4 where household_id = $1 and id = $2`
            : `update finance_debts set lender_name = $3, purpose = $4, amount = $5, note = $6,
                encrypted_payload = null, encryption_version = null where household_id = $1 and id = $2`,
          encrypted
            ? [
                householdId,
                item.id,
                item.encryptedPayload,
                item.encryptionVersion,
              ]
            : [
                householdId,
                item.id,
                this.text(payload.lenderName, "lender name", 160),
                this.text(payload.purpose, "debt purpose", 200),
                this.money(payload.amount, "debt amount", 0.01),
                this.nullableText(payload.note, "debt note", 500),
              ],
        );
        break;
      case "finance-debt-payment":
        result = await client.query(
          encrypted
            ? `update finance_debt_payments fdp set amount = 0.01, note = null,
                encrypted_payload = $3, encryption_version = $4 where fdp.id = $2 and exists (
                  select 1 from finance_debts fd where fd.id = fdp.finance_debt_id and fd.household_id = $1
                )`
            : `update finance_debt_payments fdp set amount = $3, note = $4,
                encrypted_payload = null, encryption_version = null where fdp.id = $2 and exists (
                  select 1 from finance_debts fd where fd.id = fdp.finance_debt_id and fd.household_id = $1
                )`,
          encrypted
            ? [
                householdId,
                item.id,
                item.encryptedPayload,
                item.encryptionVersion,
              ]
            : [
                householdId,
                item.id,
                this.money(payload.amount, "debt payment amount", 0.01),
                this.nullableText(payload.note, "debt payment note", 500),
              ],
        );
        break;
      case "finance-savings-account":
        result = await client.query(
          encrypted
            ? `update finance_savings_accounts set name = '[Zaszyfrowany cel ' || id::text || ']', current_amount = 0,
                target_amount = null, encrypted_payload = $3, encryption_version = $4
                where household_id = $1 and id = $2`
            : `update finance_savings_accounts set name = $3, current_amount = $4, target_amount = $5,
                encrypted_payload = null, encryption_version = null where household_id = $1 and id = $2`,
          encrypted
            ? [
                householdId,
                item.id,
                item.encryptedPayload,
                item.encryptionVersion,
              ]
            : [
                householdId,
                item.id,
                this.text(payload.name, "savings name", 160),
                this.money(payload.currentAmount, "savings current amount", 0),
                this.nullableMoney(
                  payload.targetAmount,
                  "savings target amount",
                  0.01,
                ),
              ],
        );
        break;
      case "finance-savings-transaction":
        result = await client.query(
          encrypted
            ? `update finance_savings_transactions fst set amount = 0.01, note = null,
                encrypted_payload = $3, encryption_version = $4 where fst.id = $2 and exists (
                  select 1 from finance_savings_accounts fsa
                  where fsa.id = fst.savings_account_id and fsa.household_id = $1
                )`
            : `update finance_savings_transactions fst set amount = $3, note = $4,
                encrypted_payload = null, encryption_version = null where fst.id = $2 and exists (
                  select 1 from finance_savings_accounts fsa
                  where fsa.id = fst.savings_account_id and fsa.household_id = $1
                )`,
          encrypted
            ? [
                householdId,
                item.id,
                item.encryptedPayload,
                item.encryptionVersion,
              ]
            : [
                householdId,
                item.id,
                this.money(payload.amount, "savings transaction amount", 0.01),
                this.nullableText(
                  payload.note,
                  "savings transaction note",
                  500,
                ),
              ],
        );
        break;
      case "meal-plan-entry":
        result = await client.query(
          encrypted
            ? `update meal_plan_entries mpe set meal_name = '[Zaszyfrowany posiłek]', link_url = null,
                note = null, encrypted_payload = $3, encryption_version = $4
              where mpe.id = $2 and exists (
                select 1 from meal_plan_weeks mpw
                where mpw.id = mpe.meal_plan_week_id and mpw.household_id = $1
              )`
            : `update meal_plan_entries mpe set meal_name = $3, link_url = $4, note = $5,
                encrypted_payload = null, encryption_version = null
              where mpe.id = $2 and exists (
                select 1 from meal_plan_weeks mpw
                where mpw.id = mpe.meal_plan_week_id and mpw.household_id = $1
              )`,
          encrypted
            ? [
                householdId,
                item.id,
                item.encryptedPayload,
                item.encryptionVersion,
              ]
            : [
                householdId,
                item.id,
                this.text(payload.mealName, "meal name", 240),
                this.nullableText(payload.linkUrl, "meal link", 2000),
                this.nullableText(payload.note, "meal note", 5000),
              ],
        );
        break;
      case "meal-idea":
        result = await client.query(
          encrypted
            ? `update meal_ideas set title = '[Zaszyfrowany pomysł]', link_url = null, note = null,
                encrypted_payload = $3, encryption_version = $4 where household_id = $1 and id = $2`
            : `update meal_ideas set title = $3, link_url = $4, note = $5,
                encrypted_payload = null, encryption_version = null where household_id = $1 and id = $2`,
          encrypted
            ? [
                householdId,
                item.id,
                item.encryptedPayload,
                item.encryptionVersion,
              ]
            : [
                householdId,
                item.id,
                this.text(payload.title, "meal idea title", 240),
                this.nullableText(payload.linkUrl, "meal idea link", 2000),
                this.nullableText(payload.note, "meal idea note", 5000),
              ],
        );
        break;
      case "shopping-item":
        result = await client.query(
          encrypted
            ? `update shopping_list_items sli set name = '[Zaszyfrowany produkt]', quantity = '',
                category = null, expiration_date = null, encrypted_payload = $3, encryption_version = $4
              where sli.id = $2 and exists (
                select 1 from shopping_lists sl
                where sl.id = sli.shopping_list_id and sl.household_id = $1
              )`
            : `update shopping_list_items sli set name = $3, quantity = $4, category = $5,
                expiration_date = $6, encrypted_payload = null, encryption_version = null
              where sli.id = $2 and exists (
                select 1 from shopping_lists sl
                where sl.id = sli.shopping_list_id and sl.household_id = $1
              )`,
          encrypted
            ? [
                householdId,
                item.id,
                item.encryptedPayload,
                item.encryptionVersion,
              ]
            : [
                householdId,
                item.id,
                this.text(payload.name, "shopping item name", 240),
                this.string(payload.quantity, "shopping quantity", 120),
                this.nullableText(payload.category, "shopping category", 120),
                this.nullableDate(
                  payload.expirationDate,
                  "shopping expiration date",
                ),
              ],
        );
        break;
      case "todo-item":
        result = await client.query(
          encrypted
            ? `update todo_items set title = '[Zaszyfrowane zadanie]', description = '',
                encrypted_payload = $3, encryption_version = $4 where household_id = $1 and id = $2`
            : `update todo_items set title = $3, description = $4,
                encrypted_payload = null, encryption_version = null where household_id = $1 and id = $2`,
          encrypted
            ? [
                householdId,
                item.id,
                item.encryptedPayload,
                item.encryptionVersion,
              ]
            : [
                householdId,
                item.id,
                this.text(payload.title, "todo title", 240),
                this.string(payload.description, "todo description", 5000),
              ],
        );
        break;
      case "note-item":
        result = await client.query(
          encrypted
            ? `update note_items set title = '[Zaszyfrowana notatka]', description = '',
                encrypted_payload = $3, encryption_version = $4 where household_id = $1 and id = $2`
            : `update note_items set title = $3, description = $4,
                encrypted_payload = null, encryption_version = null where household_id = $1 and id = $2`,
          encrypted
            ? [
                householdId,
                item.id,
                item.encryptedPayload,
                item.encryptionVersion,
              ]
            : [
                householdId,
                item.id,
                this.text(payload.title, "note title", 240),
                this.string(payload.description, "note description", 10000),
              ],
        );
        break;
      case "cleaning-task":
        result = await client.query(
          encrypted
            ? `update cleaning_tasks set name = '[Zaszyfrowane zadanie]', location = null,
                encrypted_payload = $3, encryption_version = $4 where household_id = $1 and id = $2`
            : `update cleaning_tasks set name = $3, location = $4,
                encrypted_payload = null, encryption_version = null where household_id = $1 and id = $2`,
          encrypted
            ? [
                householdId,
                item.id,
                item.encryptedPayload,
                item.encryptionVersion,
              ]
            : [
                householdId,
                item.id,
                this.text(payload.name, "cleaning task name", 240),
                this.nullableText(payload.location, "cleaning location", 500),
              ],
        );
        break;
      case "annual-cost":
        result = await client.query(
          encrypted
            ? `update annual_costs set name = '[Zaszyfrowany koszt]', default_amount = null,
                encrypted_payload = $3, encryption_version = $4 where household_id = $1 and id = $2`
            : `update annual_costs set name = $3, default_amount = $4,
                encrypted_payload = null, encryption_version = null where household_id = $1 and id = $2`,
          encrypted
            ? [
                householdId,
                item.id,
                item.encryptedPayload,
                item.encryptionVersion,
              ]
            : [
                householdId,
                item.id,
                this.text(payload.name, "annual cost name", 240),
                this.nullableMoney(
                  payload.defaultAmount,
                  "annual cost amount",
                  0,
                ),
              ],
        );
        break;
      case "annual-cost-history":
        result = await client.query(
          encrypted
            ? `update annual_cost_history ach set amount = null, encrypted_payload = $3,
                encryption_version = $4 where ach.id = $2 and exists (
                  select 1 from annual_costs ac
                  where ac.id = ach.annual_cost_id and ac.household_id = $1
                )`
            : `update annual_cost_history ach set amount = $3, encrypted_payload = null,
                encryption_version = null where ach.id = $2 and exists (
                  select 1 from annual_costs ac
                  where ac.id = ach.annual_cost_id and ac.household_id = $1
                )`,
          encrypted
            ? [
                householdId,
                item.id,
                item.encryptedPayload,
                item.encryptionVersion,
              ]
            : [
                householdId,
                item.id,
                this.nullableMoney(
                  payload.amount,
                  "annual cost history amount",
                  0,
                ),
              ],
        );
        break;
      case "data-entry":
        result = await client.query(
          encrypted
            ? `update data_entries set title = '[Zaszyfrowane dane]', value = '',
                encrypted_payload = $3, encryption_version = $4 where household_id = $1 and id = $2`
            : `update data_entries set title = $3, value = $4,
                encrypted_payload = null, encryption_version = null where household_id = $1 and id = $2`,
          encrypted
            ? [
                householdId,
                item.id,
                item.encryptedPayload,
                item.encryptionVersion,
              ]
            : [
                householdId,
                item.id,
                this.text(payload.title, "data entry title", 240),
                this.string(payload.value, "data entry value", 20000),
              ],
        );
        break;
      case "attachment":
        result = await client.query(
          encrypted
            ? `update attachments set file_name = '[Zaszyfrowany plik]', caption = '',
                encrypted_payload = $3, encryption_version = $4 where household_id = $1 and id = $2`
            : `update attachments set file_name = $3, caption = $4,
                encrypted_payload = null, encryption_version = null where household_id = $1 and id = $2`,
          encrypted
            ? [
                householdId,
                item.id,
                item.encryptedPayload,
                item.encryptionVersion,
              ]
            : [
                householdId,
                item.id,
                this.text(payload.fileName, "attachment file name", 500),
                this.string(payload.caption, "attachment caption", 5000),
              ],
        );
        break;
    }

    if (result.rowCount !== 1) {
      throw new BadRequestException(
        "Encryption migration item does not belong to this household",
      );
    }
  }

  private async assertModuleState(
    client: PoolClient,
    householdId: string,
    module: EncryptableModuleKey,
    encrypted: boolean,
    keyVersion: number,
  ): Promise<void> {
    const invalidCondition = encrypted
      ? "encryption_version is distinct from $2"
      : "encrypted_payload is not null";
    const query = this.moduleStateQuery(module, invalidCondition);
    const result = await client.query<{ invalid_count: number }>(
      query,
      encrypted ? [householdId, keyVersion] : [householdId],
    );

    if (Number(result.rows[0]?.invalid_count ?? 0) > 0) {
      throw new BadRequestException(
        `All ${module} records must be migrated before changing encryption settings`,
      );
    }
  }

  private moduleStateQuery(
    module: EncryptableModuleKey,
    condition: string,
  ): string {
    switch (module) {
      case "calendar":
        return `select count(*)::integer as invalid_count from calendar_events
          where household_id = $1 and ${condition}`;
      case "finances":
        return `select coalesce(sum(invalid_count), 0)::integer as invalid_count from (
            select count(*) as invalid_count from budget_categories
              where household_id = $1 and ${condition}
            union all
            select count(*) from budget_items bi join budget_months bm on bm.id = bi.budget_month_id
              where bm.household_id = $1 and bi.${condition}
            union all
            select count(*) from expenses e join budget_items bi on bi.id = e.budget_item_id
              join budget_months bm on bm.id = bi.budget_month_id
              where bm.household_id = $1 and e.${condition}
            union all
            select count(*) from monthly_incomes mi join budget_months bm on bm.id = mi.budget_month_id
              where bm.household_id = $1 and mi.${condition}
            union all
            select count(*) from finance_debts where household_id = $1 and ${condition}
            union all
            select count(*) from finance_debt_payments fdp join finance_debts fd on fd.id = fdp.finance_debt_id
              where fd.household_id = $1 and fdp.${condition}
            union all
            select count(*) from finance_savings_accounts where household_id = $1 and ${condition}
            union all
            select count(*) from finance_savings_transactions fst
              join finance_savings_accounts fsa on fsa.id = fst.savings_account_id
              where fsa.household_id = $1 and fst.${condition}
          ) counts`;
      case "meal_planner":
        return `select coalesce(sum(invalid_count), 0)::integer as invalid_count from (
          select count(*) as invalid_count from meal_plan_entries mpe
            join meal_plan_weeks mpw on mpw.id = mpe.meal_plan_week_id
            where mpw.household_id = $1 and mpe.${condition}
          union all
          select count(*) from meal_ideas where household_id = $1 and ${condition}
        ) counts`;
      case "shopping":
        return `select count(*)::integer as invalid_count from shopping_list_items sli
          join shopping_lists sl on sl.id = sli.shopping_list_id
          where sl.household_id = $1 and sli.${condition}`;
      case "todo":
        return `select count(*)::integer as invalid_count from todo_items
          where household_id = $1 and ${condition}`;
      case "notes":
        return `select count(*)::integer as invalid_count from note_items
          where household_id = $1 and ${condition}`;
      case "cleaning":
        return `select count(*)::integer as invalid_count from cleaning_tasks
          where household_id = $1 and ${condition}`;
      case "annual_costs":
        return `select coalesce(sum(invalid_count), 0)::integer as invalid_count from (
          select count(*) as invalid_count from annual_costs
            where household_id = $1 and ${condition}
          union all
          select count(*) from annual_cost_history ach
            join annual_costs ac on ac.id = ach.annual_cost_id
            where ac.household_id = $1 and ach.${condition}
        ) counts`;
      case "data_entries":
        return `select count(*)::integer as invalid_count from data_entries
          where household_id = $1 and ${condition}`;
      case "attachments":
        return `select count(*)::integer as invalid_count from attachments
          where household_id = $1 and ${condition}`;
    }
  }

  private async recalculatePlaintextSavings(
    client: PoolClient,
    householdId: string,
  ): Promise<void> {
    await client.query(
      `
        update finance_savings_accounts fsa
        set current_amount = coalesce((
          select sum(case fst.direction when 'add' then fst.amount else -fst.amount end)
          from finance_savings_transactions fst
          where fst.savings_account_id = fsa.id
        ), fsa.current_amount)
        where fsa.household_id = $1
      `,
      [householdId],
    );
  }

  private text(value: unknown, label: string, maxLength: number): string {
    if (
      typeof value !== "string" ||
      !value.trim() ||
      value.trim().length > maxLength
    ) {
      throw new BadRequestException(`Invalid ${label}`);
    }

    return value.trim();
  }

  private string(value: unknown, label: string, maxLength: number): string {
    if (typeof value !== "string" || value.length > maxLength) {
      throw new BadRequestException(`Invalid ${label}`);
    }

    return value;
  }

  private nullableText(
    value: unknown,
    label: string,
    maxLength: number,
  ): string | null {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    if (typeof value !== "string" || value.trim().length > maxLength) {
      throw new BadRequestException(`Invalid ${label}`);
    }

    return value.trim() || null;
  }

  private nullableCurrency(value: unknown, label: string): string | null {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    if (typeof value !== "string" || !/^[A-Z]{3}$/.test(value)) {
      throw new BadRequestException(`Invalid ${label}`);
    }

    return value;
  }

  private nullableDateTime(value: unknown, label: string): string | null {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
      throw new BadRequestException(`Invalid ${label}`);
    }

    return new Date(value).toISOString();
  }

  private money(value: unknown, label: string, minimum: number): number {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < minimum
    ) {
      throw new BadRequestException(`Invalid ${label}`);
    }

    return Math.round(value * 100) / 100;
  }

  private nullableMoney(
    value: unknown,
    label: string,
    minimum: number,
  ): number | null {
    return value === null || value === undefined
      ? null
      : this.money(value, label, minimum);
  }

  private nullableDate(value: unknown, label: string): string | null {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(`Invalid ${label}`);
    }

    return value;
  }

  private householdLockKey(householdId: string): string {
    return `homeapp:household-encryption:${householdId}`;
  }

  private unconfiguredSettings(
    householdId: string,
  ): HouseholdEncryptionSettings {
    return {
      configured: false,
      enabledModules: [],
      householdId,
      kdfSalt: null,
      keyVersion: null,
      recoveryWrappedKey: null,
      updatedAt: null,
      wrappedKey: null,
    };
  }

  async isModuleEncrypted(
    householdId: string,
    module: EncryptableModuleKey,
  ): Promise<boolean> {
    return (await this.getModuleEncryptionState(householdId, module)).enabled;
  }

  async getModuleEncryptionState(
    householdId: string,
    module: EncryptableModuleKey,
  ): Promise<{ enabled: boolean; keyVersion: number | null }> {
    const result = await this.database.query<{
      enabled: boolean;
      key_version: number | null;
    }>(
      `
        select ($2 = any(enabled_modules)) as enabled, key_version
        from household_encryption_settings
        where household_id = $1
      `,
      [householdId, module],
    );

    return {
      enabled: result.rows[0]?.enabled ?? false,
      keyVersion: result.rows[0]?.key_version ?? null,
    };
  }
}

interface EncryptionSettingsRow {
  enabled_modules: EncryptableModuleKey[];
  kdf_salt: string;
  key_version: number;
  recovery_wrapped_key: string;
  updated_at: string;
  wrapped_key: string;
}

interface EncryptionExportRow {
  encrypted_payload: string | null;
  encryption_version: number | null;
  entity: EncryptionMigrationEntity;
  id: string;
  plaintext_payload: Record<string, unknown> | null;
  source_revision: string;
}

export interface EncryptionExportItem {
  encryptedPayload: string | null;
  encryptionVersion: number | null;
  entity: EncryptionMigrationEntity;
  id: string;
  plaintextPayload: Record<string, unknown> | null;
  sourceRevision: string;
}

export interface HouseholdEncryptionSettings {
  configured: boolean;
  enabledModules: EncryptableModuleKey[];
  householdId: string;
  kdfSalt: string | null;
  keyVersion: number | null;
  recoveryWrappedKey: string | null;
  updatedAt: string | null;
  wrappedKey: string | null;
}

import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { DatabaseService } from "../database/database.service";
import { RealtimeService } from "../realtime/realtime.service";
import { UpdateHouseholdEncryptionDto } from "./dto/encryption.dto";
import { EncryptionService } from "./encryption.service";

const updatedAt = "2026-07-21T10:00:00.000Z";
const currentSettings = {
  enabled_modules: [] as string[],
  kdf_salt: "a".repeat(32),
  key_version: 1,
  recovery_wrapped_key: "old-recovery",
  updated_at: updatedAt,
  wrapped_key: "old-wrapped",
};

function createService(query: ReturnType<typeof vi.fn>) {
  const client = { query };
  const database = {
    transaction: vi.fn((callback) => callback(client)),
  } as unknown as DatabaseService;
  const realtime = { publish: vi.fn() } as unknown as RealtimeService;

  return new EncryptionService(database, realtime);
}

function settingsDto(overrides: Partial<UpdateHouseholdEncryptionDto> = {}) {
  return {
    enabledModules: [],
    expectedUpdatedAt: updatedAt,
    kdfSalt: currentSettings.kdf_salt,
    keyVersion: 1,
    recoveryWrappedKey: currentSettings.recovery_wrapped_key,
    wrappedKey: currentSettings.wrapped_key,
    ...overrides,
  } satisfies UpdateHouseholdEncryptionDto;
}

describe("EncryptionService migration safety", () => {
  it("rejects stale settings before applying any migrated record", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ ...currentSettings, updated_at: "2026-07-21T11:00:00.000Z" }],
      });
    const service = createService(query);

    await expect(
      service.updateSettings("household-1", "member-1", settingsDto()),
    ).rejects.toThrow("Encryption settings changed");
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("requires a new key version when encryption credentials change", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [currentSettings] });
    const service = createService(query);

    await expect(
      service.updateSettings(
        "household-1",
        "member-1",
        settingsDto({ wrappedKey: "new-wrapped" }),
      ),
    ).rejects.toThrow("requires rotating the data key");
  });

  it("rejects a record changed after it was exported for migration", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [currentSettings] })
      .mockResolvedValueOnce({
        rows: [{ source_revision: "22222222-2222-4222-8222-222222222222" }],
      });
    const service = createService(query);

    await expect(
      service.updateSettings(
        "household-1",
        "member-1",
        settingsDto({
          enabledModules: ["todo"],
          migrationItems: [
            {
              encryptedPayload: "encrypted",
              encryptionVersion: 1,
              entity: "todo-item",
              id: "11111111-1111-4111-8111-111111111111",
              sourceRevision: "33333333-3333-4333-8333-333333333333",
            },
          ],
        }),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(query.mock.calls[2]?.[0]).toContain("for update");
  });

  it("decrypts protected records before removing the household key configuration", async () => {
    const sourceRevision = "33333333-3333-4333-8333-333333333333";
    const query = vi.fn(async (sql: string) => {
      if (
        sql.includes("from household_encryption_settings") &&
        sql.includes("for update")
      ) {
        return {
          rows: [{ ...currentSettings, enabled_modules: ["todo"] }],
          rowCount: 1,
        };
      }

      if (
        sql.includes("select encryption_migration_revision") &&
        sql.includes("from todo_items")
      ) {
        return { rows: [{ source_revision: sourceRevision }], rowCount: 1 };
      }

      if (sql.includes("invalid_count")) {
        return { rows: [{ invalid_count: 0 }], rowCount: 1 };
      }

      return { rows: [], rowCount: 1 };
    });
    const service = createService(query);

    const result = await service.removeSettings("household-1", {
      expectedUpdatedAt: updatedAt,
      keyVersion: 1,
      migrationItems: [
        {
          encryptionVersion: 1,
          entity: "todo-item",
          id: "11111111-1111-4111-8111-111111111111",
          plaintextPayload: {
            description: "Opis",
            title: "Zadanie",
          },
          sourceRevision,
        },
      ],
    });
    const appliedIndex = query.mock.calls.findIndex(([sql]) =>
      String(sql).includes("update todo_items"),
    );
    const deletedIndex = query.mock.calls.findIndex(([sql]) =>
      String(sql).includes("delete from household_encryption_settings"),
    );

    expect(appliedIndex).toBeGreaterThan(-1);
    expect(deletedIndex).toBeGreaterThan(appliedIndex);
    expect(result).toMatchObject({
      configured: false,
      enabledModules: [],
      householdId: "household-1",
      keyVersion: null,
    });
  });

  it("keeps the key configuration when any encrypted record remains", async () => {
    const query = vi.fn(async (sql: string) => {
      if (
        sql.includes("from household_encryption_settings") &&
        sql.includes("for update")
      ) {
        return {
          rows: [{ ...currentSettings, enabled_modules: ["todo"] }],
          rowCount: 1,
        };
      }

      if (sql.includes("from todo_items") && sql.includes("invalid_count")) {
        return { rows: [{ invalid_count: 1 }], rowCount: 1 };
      }

      if (sql.includes("invalid_count")) {
        return { rows: [{ invalid_count: 0 }], rowCount: 1 };
      }

      return { rows: [], rowCount: 1 };
    });
    const service = createService(query);

    await expect(
      service.removeSettings("household-1", {
        expectedUpdatedAt: updatedAt,
        keyVersion: 1,
        migrationItems: [],
      }),
    ).rejects.toThrow("All todo records must be migrated");
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes("delete from household_encryption_settings"),
      ),
    ).toBe(false);
  });
});

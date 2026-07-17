import { describe, expect, it, vi } from "vitest";
import { StartService } from "./start.service";

describe("StartService", () => {
  it("returns the total todo count while limiting the preview to three items", async () => {
    const database = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes("from todo_items")) {
          return Promise.resolve({
            rows: Array.from({ length: 3 }, (_, index) => ({
              created_at: `2026-07-${String(17 - index).padStart(2, "0")}`,
              id: `todo-${index + 1}`,
              owner_member_id: null,
              scope_type: "household",
              sort_order: index,
              title: `Zadanie ${index + 1}`,
              total_count: 8,
            })),
          });
        }

        return Promise.resolve({ rows: [] });
      }),
    };
    const calendarService = {
      listUpcoming: vi.fn().mockResolvedValue([]),
    };
    const service = new StartService(
      database as never,
      calendarService as never,
    );

    const dashboard = await service.getDashboard("household-id");

    expect(dashboard.todoCount).toBe(8);
    expect(dashboard.todoPreview).toHaveLength(3);
  });
});

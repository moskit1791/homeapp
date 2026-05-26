import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationsService } from "./notifications.service";

describe("NotificationsService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not send a household change push when the event type is throttled", async () => {
    const database = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [pushTokenRow()] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(okExpoResponse() as never);
    const service = new NotificationsService(database as never);

    const result = await service.sendHouseholdChangeNotification({
      actorMemberId: "11111111-1111-1111-1111-111111111111",
      eventType: "shopping.changed",
      householdId: "22222222-2222-2222-2222-222222222222",
      resourceId: "item-id",
    });

    expect(result).toEqual({ sent: 0, tickets: [] });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(database.query).toHaveBeenCalledTimes(2);
  });

  it("sends a household change push when the event type is outside the throttle window", async () => {
    const database = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [pushTokenRow()] })
        .mockResolvedValueOnce({ rows: [{ allowed: true }] })
        .mockResolvedValueOnce({ rows: [{ display_name: "Damian" }] }),
    };
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(okExpoResponse() as never);
    const service = new NotificationsService(database as never);

    const result = await service.sendHouseholdChangeNotification({
      actorMemberId: "11111111-1111-1111-1111-111111111111",
      eventType: "shopping.changed",
      householdId: "22222222-2222-2222-2222-222222222222",
      resourceId: "item-id",
    });

    expect(result.sent).toBe(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(database.query).toHaveBeenCalledTimes(3);
  });
});

function pushTokenRow() {
  return {
    created_at: "2026-05-26T18:00:00.000Z",
    device_name: "phone",
    enabled: true,
    expo_push_token: "ExpoPushToken[test-token]",
    household_id: "22222222-2222-2222-2222-222222222222",
    household_member_id: "33333333-3333-3333-3333-333333333333",
    id: "44444444-4444-4444-4444-444444444444",
    last_registered_at: "2026-05-26T18:00:00.000Z",
    platform: "android",
    updated_at: "2026-05-26T18:00:00.000Z",
    user_id: "55555555-5555-5555-5555-555555555555",
  };
}

function okExpoResponse() {
  return {
    json: () => Promise.resolve({ data: [{ status: "ok" }] }),
    ok: true,
  };
}

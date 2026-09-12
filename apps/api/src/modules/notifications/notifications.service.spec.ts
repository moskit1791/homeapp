import { afterEach, describe, expect, it, vi } from "vitest";
import webPush from "web-push";
import { NotificationsService } from "./notifications.service";

vi.mock("web-push", () => ({
  default: {
    sendNotification: vi.fn(),
    setVapidDetails: vi.fn(),
  },
}));

describe("NotificationsService", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("sends one notification through Expo and one through browser Web Push", async () => {
    vi.stubEnv("WEB_PUSH_SUBJECT", "mailto:test@example.test");
    vi.stubEnv("WEB_PUSH_VAPID_PUBLIC_KEY", "public-test-key");
    vi.stubEnv("WEB_PUSH_VAPID_PRIVATE_KEY", "private-test-key");
    const database = {
      query: vi.fn().mockResolvedValue({
        rows: [
          pushTokenRow(),
          {
            auth: "browser-auth-key",
            endpoint: "https://push.example.test/subscription",
            p256dh: "browser-p256dh-key",
            provider: "web_push",
          },
        ],
      }),
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okExpoResponse() as never);
    vi.mocked(webPush.sendNotification).mockResolvedValue({} as never);
    const service = new NotificationsService(database as never);

    const result = await service.sendTestPush(
      { householdId: "household", memberId: "member" } as never,
      {},
    );

    expect(result.sent).toBe(2);
    expect(result.tickets).toHaveLength(2);
    expect(webPush.setVapidDetails).toHaveBeenCalledWith(
      "mailto:test@example.test",
      "public-test-key",
      "private-test-key",
    );
    expect(webPush.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: "https://push.example.test/subscription" }),
      expect.stringContaining('"title":"HomeApp"'),
      { TTL: 3600 },
    );
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

  it.each([
    {
      eventTitle: "Wizyta u lekarza",
      expectedTitle: "Jutro: Wizyta u lekarza",
      reminderOffsetMinutes: 1440,
    },
    {
      eventTitle: "Ginekolog",
      expectedTitle: "Za 30 min: Ginekolog",
      reminderOffsetMinutes: 30,
    },
  ])(
    "sends a relative calendar reminder: $expectedTitle",
    async ({ eventTitle, expectedTitle, reminderOffsetMinutes }) => {
      const database = {
        query: vi.fn().mockResolvedValue({ rows: [pushTokenRow()] }),
      };
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(okExpoResponse() as never);
      const service = new NotificationsService(database as never);

      await service.sendCalendarEventReminder({
        eventDate: "2026-07-18",
        eventTime: "10:30:00",
        householdId: "22222222-2222-2222-2222-222222222222",
        reminderOffsetMinutes,
        title: eventTitle,
      });

      const request = fetchSpy.mock.calls[0]?.[1];
      const messages = JSON.parse(String(request?.body)) as Array<{
        body: string;
        data: { reminderOffsetMinutes: string };
        title: string;
      }>;

      expect(messages[0]).toMatchObject({
        body: "18.07.2026 o 10:30",
        data: { reminderOffsetMinutes: String(reminderOffsetMinutes) },
        title: expectedTitle,
      });
    },
  );
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

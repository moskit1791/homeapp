import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { UsersService } from "../../users/users.service";
import { AuthService } from "../auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

function createContext() {
  const request = {
    headers: { authorization: "Bearer legacy-access-token" },
  };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;

  return { context, request };
}

function createUsersService(sessionVersion: number) {
  return {
    findById: vi.fn().mockResolvedValue({
      accountStatus: "active",
      authProviderUserId: "provider-1",
      email: "user@example.test",
      id: "user-1",
    }),
    getSessionVersion: vi.fn().mockResolvedValue(sessionVersion),
  } as unknown as UsersService;
}

describe("JwtAuthGuard legacy rollout compatibility", () => {
  it("accepts a signed 1.0.0 access token while the account is on generation one", async () => {
    const authService = {
      verifyAccessToken: vi.fn().mockReturnValue({
        sessionVersion: null,
        userId: "user-1",
      }),
    } as unknown as AuthService;
    const { context, request } = createContext();
    const guard = new JwtAuthGuard(authService, createUsersService(1));

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request).toHaveProperty(
      "userContext",
      expect.objectContaining({ userId: "user-1" }),
    );
  });

  it("rejects the same legacy token after the session generation changes", async () => {
    const authService = {
      verifyAccessToken: vi.fn().mockReturnValue({
        sessionVersion: null,
        userId: "user-1",
      }),
    } as unknown as AuthService;
    const { context } = createContext();
    const guard = new JwtAuthGuard(authService, createUsersService(2));

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

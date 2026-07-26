import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { configureApp } from "../../shared/http/configure-app";
import { LegalController } from "./legal.controller";

describe("LegalController", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [LegalController],
    }).compile();

    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("publishes a complete privacy policy without an MVP placeholder", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/legal/privacy")
      .expect(200)
      .expect("Content-Type", /text\/html/);

    expect(response.text).toContain("Polityka prywatności HomeApp");
    expect(response.text).toContain("Import wydatków z powiadomień Androida");
    expect(response.text).toContain("porabkihome.app@gmail.com");
    expect(response.text).not.toContain("roboczy podgląd");
  });

  it("publishes terms and an external account deletion path", async () => {
    const terms = await request(app.getHttpServer())
      .get("/api/legal/terms")
      .expect(200);
    const deletion = await request(app.getHttpServer())
      .get("/api/legal/account-deletion")
      .expect(200);

    expect(terms.text).toContain("Regulamin HomeApp");
    expect(deletion.text).toContain("Dom → Konto → Usuń konto");
    expect(deletion.text).toContain("mailto:porabkihome.app@gmail.com");
  });
});

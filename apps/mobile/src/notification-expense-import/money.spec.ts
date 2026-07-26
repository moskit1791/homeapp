import { parsePositiveMoney, requirePositiveMoney } from "./money";

describe("notification expense money input", () => {
  it("accepts Polish decimal commas and spaces", () => {
    expect(parsePositiveMoney("79,99")).toBe(79.99);
    expect(parsePositiveMoney("1 249,00")).toBe(1249);
  });

  it("rejects zero, negative values and more than two decimal places", () => {
    expect(parsePositiveMoney("0")).toBeNull();
    expect(parsePositiveMoney("-1,00")).toBeNull();
    expect(parsePositiveMoney("12,345")).toBeNull();
  });

  it("throws before an invalid value reaches the API", () => {
    expect(() => requirePositiveMoney("not-a-number")).toThrow(
      "Nieprawidłowa kwota wydatku.",
    );
  });
});

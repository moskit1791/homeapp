import {
  formatSourceAmountCurrency,
  parsePositiveMoney,
  parseSourceAmountCurrency,
  requirePositiveMoney,
} from "./money";

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

  it("combines and parses the source amount with its currency", () => {
    expect(formatSourceAmountCurrency("18.5", "eur")).toBe("18.5 EUR");
    expect(parseSourceAmountCurrency("18,50 eur")).toEqual({
      amount: 18.5,
      amountText: "18.50",
      currency: "EUR",
    });
  });

  it("rejects a combined source value without a valid currency", () => {
    expect(parseSourceAmountCurrency("18,50")).toBeNull();
    expect(parseSourceAmountCurrency("18,50 EURO")).toBeNull();
  });
});

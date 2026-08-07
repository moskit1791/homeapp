package com.homeapp.notificationexpenseimport

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NotificationTransactionParserTest {
  private val parser = UniversalNotificationTransactionParser()

  @Test
  fun parsesSupportedPaymentFormats() {
    val cases = listOf(
      Triple("Zapłacono 79,99 PLN w BIEDRONKA", "79.99", "PLN"),
      Triple("Card payment of EUR 18.50 at REWE", "18.5", "EUR"),
      Triple("Card payment of 18.50 EUR at REWE", "18.5", "EUR"),
      Triple("Kartenzahlung über 12,90 € bei LIDL", "12.9", "EUR"),
      Triple("Pago con tarjeta: 24,50 EUR — MERCADONA", "24.5", "EUR"),
      Triple("Paiement par carte de 31,20 EUR chez CARREFOUR", "31.2", "EUR"),
      Triple("Payment: £14.99 at TESCO", "14.99", "GBP"),
      Triple("Card charged USD 1,249.00 at HOTEL", "1249", "USD"),
      Triple("Płatność kartą 1 249,00 PLN, sprzedawca HOTEL", "1249", "PLN")
    )

    for ((text, amount, currency) in cases) {
      val parsed = parser.parse(NotificationInput(null, text))
      assertEquals(text, amount, parsed?.amount)
      assertEquals(text, currency, parsed?.currency)
      assertEquals(text, "payment", parsed?.transactionType)
    }
  }

  @Test
  fun parsesMbankPaymentNotificationVariants() {
    val cases = listOf(
      NotificationInput("Płatność kartą", "Kwota: 18,50 PLN. Miejsce: REWE"),
      NotificationInput(null, "Zapłaciłeś kartą 45,67 PLN w LIDL"),
      NotificationInput("Transakcja kartą", "Kwota 29,99 PLN. Punkt: ŻABKA"),
      NotificationInput(null, "Pobrano z konta 14,20 PLN, odbiorca ALLEGRO")
    )

    val parsed = cases.map(parser::parse)

    assertEquals(listOf("18.5", "45.67", "29.99", "14.2"), parsed.map { it?.amount })
    assertTrue(parsed.all { it?.currency == "PLN" })
    assertTrue(parsed.all { it?.transactionType == "payment" })
    assertEquals(listOf("REWE", "LIDL", "ŻABKA", "ALLEGRO"), parsed.map { it?.merchant })
  }

  @Test
  fun parsesRealMbankTransferFromAccountNotification() {
    val maskedRecipient = parser.parse(
      NotificationInput("Przelew z konta", "1,00 PLN do ***MALWINKA:* .")
    )
    val namedRecipient = parser.parse(
      NotificationInput("Przelew z konta", "25,40 PLN do JAN KOWALSKI")
    )

    assertEquals("1", maskedRecipient?.amount)
    assertEquals("PLN", maskedRecipient?.currency)
    assertEquals("MALWINKA", maskedRecipient?.merchant)
    assertEquals("transfer_out", maskedRecipient?.transactionType)
    assertEquals("25.4", namedRecipient?.amount)
    assertEquals("JAN KOWALSKI", namedRecipient?.merchant)
    assertEquals("transfer_out", namedRecipient?.transactionType)
  }

  @Test
  fun rejectsDeclinesSecurityCodesBalancesIncomingTransfersAndOffers() {
    val rejected = listOf(
      "Płatność 99,00 PLN została odrzucona",
      "Card payment declined: 10.00 EUR",
      "Twój kod logowania to 123456",
      "Your verification code is 654321",
      "Saldo rachunku: 5 432,10 PLN",
      "Otrzymałeś przelew 200,00 EUR",
      "Oferta kredytu do 20 000 PLN"
    )

    rejected.forEach { text ->
      assertNull(text, parser.parse(NotificationInput(null, text)))
    }
  }

  @Test
  fun neverGuessesAmbiguousOrMissingCurrency() {
    listOf(
      "Payment of $20.00 completed",
      "Purchase for 100 kr",
      "Transaction completed: 12.00"
    ).forEach { text ->
      val parsed = parser.parse(NotificationInput(null, text))
      assertNull(text, parsed?.currency)
      assertTrue(text, parsed?.requiresReview == true)
    }
  }

  @Test
  fun recognizesRefundAsReviewOnly() {
    val parsed = parser.parse(NotificationInput(null, "Refund EUR 12.50 at SHOP"))
    assertEquals("refund", parsed?.transactionType)
    assertTrue(parsed?.requiresReview == true)
  }

  @Test
  fun sanitizesSensitiveIdentifiersAndDropsSecurityCodes() {
    val masked = parser.sanitizeForStorage(
      "Card payment 12.00 EUR at SHOP card 4111 1111 1111 1111"
    )
    assertFalse(masked?.contains("4111 1111 1111 1111") == true)
    assertTrue(masked?.contains("•••• 1111") == true)
    val maskedAccount = parser.sanitizeForStorage(
      "Płatność 12,00 PLN z rachunku PL61 1090 1014 0000 0712 1981 2874"
    )
    assertFalse(maskedAccount?.contains("1090 1014 0000 0712 1981 2874") == true)
    assertTrue(maskedAccount?.contains("•••• 2874") == true)
    assertNull(parser.sanitizeForStorage("Your verification code is 654321"))

    val parsed = parser.parse(
      NotificationInput(null, "Card payment 12.00 EUR at SHOP 4111 1111 1111 1111")
    )
    assertFalse(parsed?.merchant?.contains("4111 1111 1111 1111") == true)
    assertTrue(parsed?.merchant?.contains("•••• 1111") == true)
  }

  @Test
  fun doesNotTreatADateAsAnAmountWithoutCurrency() {
    assertNull(
      parser.parse(NotificationInput(null, "Transaction completed on 2026-07-26"))
    )
  }
}

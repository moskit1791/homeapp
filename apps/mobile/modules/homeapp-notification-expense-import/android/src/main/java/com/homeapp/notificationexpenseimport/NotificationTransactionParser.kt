package com.homeapp.notificationexpenseimport

import java.math.BigDecimal
import java.util.Currency
import java.util.Locale

data class NotificationInput(
  val title: String?,
  val text: String?
)

interface NotificationTransactionParser {
  val id: String
  fun supports(input: NotificationInput): Boolean
  fun parse(input: NotificationInput): ParsedTransaction?
}

class UniversalNotificationTransactionParser : NotificationTransactionParser {
  override val id = "universal-v1"

  companion object {
    const val MIN_CONFIDENCE = 0.62
    private const val NUMBER =
      """(?:\d{1,3}(?:[ .,\u00A0]\d{3})+(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)"""
    private const val ISO_CURRENCY = """(?<![\p{L}])([A-Z]{3})(?![\p{L}])"""
    private const val SYMBOL_CURRENCY = """(€|£|zł|\$|kr)"""

    private val amountWithCurrency = Regex(
      """(?i)(?:(?:$ISO_CURRENCY|$SYMBOL_CURRENCY)\s*($NUMBER)|($NUMBER)\s*(?:$ISO_CURRENCY|$SYMBOL_CURRENCY))"""
    )
    private val amountWithoutCurrency = Regex(
      """(?:\d{1,3}(?:[ .,\u00A0]\d{3})+[.,]\d{2}|\d+[.,]\d{2})"""
    )
    private val rejected = Regex(
      """(?i)\b(odrzucon\p{L}*|declined|abgelehnt|rechazad\p{L}*|refus[eé]\p{L}*|anulowan\p{L}*|cancelled|canceled|""" +
        """kod(?:\s+logowania|\s+autoryzacyjny)?|verification\s+code|login\s+code|otp|pin|hasło|password|""" +
        """saldo|balance|otrzyma(?:łeś|las|no)|received\s+(?:a\s+)?transfer|incoming\s+transfer|""" +
        """oferta|offer|credit\s+offer|przypomnienie|payment\s+due)\b"""
    )
    private val completed = Regex(
      """(?i)(zapłacon|zapłacił\p{L}*|płatno(?:ść|sci)|zakup|obciąż|pobran\p{L}*|wydano|""" +
        """transakcj\p{L}*\s+(?:kart\p{L}*|BLIK)|operacj\p{L}*\s+kart\p{L}*|""" +
        """przelew\s+wychodzący|wypłat[ay]\s+z|""" +
        """card\s+payment|card\s+charged|payment|purchase|charged|outgoing\s+transfer|withdrawal|""" +
        """kartenzahlung|pago\s+con\s+tarjeta|paiement\s+par\s+carte|transaction\s+completed|completed)"""
    )
    private val refund = Regex("""(?i)\b(zwrot|refund|reembolso|remboursement|erstattung)\b""")
    private val transferOut = Regex(
      """(?i)\b(przelew\s+wychodzący|wysłano\s+przelew|outgoing\s+transfer|transfer\s+sent)\b"""
    )
    private val withdrawal = Regex(
      """(?i)\b(wypłat[ay]\s+z|bankomat|withdrawal|cash\s+withdrawal|geldautomat)\b"""
    )
    private val merchantPattern = Regex(
      """(?i)(?:\bat\b|\bw\b|\bbei\b|\bchez\b|sprzedawca|miejsce|punkt|odbiorca|[—–])""" +
        """\s*[:\-]?\s*([\p{L}\p{N}][\p{L}\p{N} .&'_\-]{1,80})"""
    )
    private val securityCode = Regex(
      """(?i)\b(?:otp|pin|kod|code|hasło|password|verification|logowania|autoryzacyjny)\b.{0,30}\b\d{4,8}\b"""
    )
    private val longDigitSequence = Regex("""(?<!\d)(?:\d[ -]?){12,34}(?!\d)""")
  }

  override fun supports(input: NotificationInput): Boolean {
    val text = joined(input)
    return text.isNotBlank() &&
      (completed.containsMatchIn(text) || refund.containsMatchIn(text))
  }

  override fun parse(input: NotificationInput): ParsedTransaction? {
    val text = joined(input).take(2048)
    if (text.isBlank() || rejected.containsMatchIn(text) || securityCode.containsMatchIn(text)) {
      return null
    }
    if (!completed.containsMatchIn(text) && !refund.containsMatchIn(text)) return null

    val withCurrency = amountWithCurrency.find(text)
    val rawAmount: String
    val rawCurrency: String?

    if (withCurrency != null) {
      rawCurrency = withCurrency.groups[1]?.value
        ?: withCurrency.groups[2]?.value
        ?: withCurrency.groups[5]?.value
        ?: withCurrency.groups[6]?.value
      rawAmount = withCurrency.groups[3]?.value ?: withCurrency.groups[4]?.value ?: return null
    } else {
      val withoutCurrency = amountWithoutCurrency.find(text) ?: return null
      rawAmount = withoutCurrency.value
      rawCurrency = null
    }

    val amount = normalizeAmount(rawAmount) ?: return null
    if (amount <= BigDecimal.ZERO) return null
    val currency = normalizeCurrency(rawCurrency)
    val transactionType = when {
      refund.containsMatchIn(text) -> "refund"
      transferOut.containsMatchIn(text) -> "transfer_out"
      withdrawal.containsMatchIn(text) -> "withdrawal"
      else -> "payment"
    }
    val merchant = merchantPattern.find(text)
      ?.groups
      ?.get(1)
      ?.value
      ?.trim(' ', '.', ',', '-', '—', '–')
      ?.takeIf { it.isNotBlank() }
      ?.take(80)
      ?.let(::maskLongDigitSequences)
    val ambiguousCurrency = rawCurrency != null && currency == null
    val confidence = when {
      transactionType == "refund" -> 0.78
      currency != null && merchant != null -> 0.94
      currency != null -> 0.86
      else -> 0.68
    }
    if (confidence < MIN_CONFIDENCE) return null

    return ParsedTransaction(
      amount = amount.stripTrailingZeros().toPlainString(),
      currency = currency,
      merchant = merchant,
      transactionType = transactionType,
      confidence = confidence,
      requiresReview = ambiguousCurrency || currency == null || merchant == null || transactionType == "refund"
    )
  }

  fun sanitizeForStorage(value: String): String? {
    val limited = value.replace(Regex("""[\u0000-\u001F]"""), " ").trim().take(1024)
    if (limited.isBlank() || securityCode.containsMatchIn(limited)) return null

    return maskLongDigitSequences(limited)
  }

  private fun maskLongDigitSequences(value: String): String =
    longDigitSequence.replace(value) { match ->
      val digits = match.value.filter(Char::isDigit)
      "•••• ${digits.takeLast(4)}"
    }

  internal fun normalizeAmount(value: String): BigDecimal? {
    var compact = value.replace(" ", "").replace("\u00A0", "")
    val comma = compact.lastIndexOf(',')
    val dot = compact.lastIndexOf('.')

    compact = when {
      comma >= 0 && dot >= 0 -> {
        val decimal = maxOf(comma, dot)
        compact.substring(0, decimal).replace(",", "").replace(".", "") +
          "." + compact.substring(decimal + 1)
      }
      comma >= 0 -> normalizeSingleSeparator(compact, ',')
      dot >= 0 -> normalizeSingleSeparator(compact, '.')
      else -> compact
    }

    return compact.toBigDecimalOrNull()
  }

  private fun normalizeSingleSeparator(value: String, separator: Char): String {
    val parts = value.split(separator)
    if (parts.size == 2 && parts.last().length == 2) {
      return "${parts.first()}.${parts.last()}"
    }
    if (parts.size > 2 && parts.last().length == 2) {
      return parts.dropLast(1).joinToString("") + "." + parts.last()
    }
    return parts.joinToString("")
  }

  private fun normalizeCurrency(value: String?): String? {
    val token = value?.trim()?.uppercase(Locale.ROOT) ?: return null
    return when (token) {
      "€" -> "EUR"
      "£" -> "GBP"
      "ZŁ" -> "PLN"
      "$", "KR" -> null
      else -> try {
        Currency.getInstance(token).currencyCode
      } catch (_: IllegalArgumentException) {
        null
      }
    }
  }

  private fun joined(input: NotificationInput): String =
    listOfNotNull(input.title, input.text).joinToString(" ").replace(Regex("""\s+"""), " ").trim()
}

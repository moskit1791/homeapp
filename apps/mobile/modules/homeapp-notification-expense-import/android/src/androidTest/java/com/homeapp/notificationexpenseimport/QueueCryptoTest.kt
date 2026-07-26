package com.homeapp.notificationexpenseimport

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class QueueCryptoTest {
  private val crypto = QueueCrypto()

  @After
  fun cleanup() {
    crypto.deleteKeys()
  }

  @Test
  fun encryptsWithUniqueNonceAndAuthenticatedAad() {
    crypto.deleteKeys()
    val plaintext = "Card payment EUR 18.50 at REWE".toByteArray()
    val first = crypto.encrypt("candidate-one", 1, plaintext)
    val second = crypto.encrypt("candidate-two", 1, plaintext)

    assertFalse(first.nonce.contentEquals(second.nonce))
    assertFalse(first.ciphertext.toString(Charsets.UTF_8).contains("REWE"))
    assertArrayEquals(
      plaintext,
      crypto.decrypt("candidate-one", 1, first.nonce, first.ciphertext)
    )
    assertThrows(QueueKeyUnavailableException::class.java) {
      crypto.decrypt("different-id", 1, first.nonce, first.ciphertext)
    }
  }

  @Test
  fun rejectsModifiedCiphertext() {
    crypto.deleteKeys()
    val encrypted = crypto.encrypt("candidate", 1, "79.99 PLN".toByteArray())
    val modified = encrypted.ciphertext.copyOf()
    modified[modified.lastIndex] = (modified.last().toInt() xor 1).toByte()

    assertThrows(QueueKeyUnavailableException::class.java) {
      crypto.decrypt("candidate", 1, encrypted.nonce, modified)
    }
  }
}

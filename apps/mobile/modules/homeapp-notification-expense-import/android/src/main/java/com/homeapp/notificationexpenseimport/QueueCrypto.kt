package com.homeapp.notificationexpenseimport

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.Mac
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

data class EncryptedValue(
  val nonce: ByteArray,
  val ciphertext: ByteArray
)

class QueueKeyUnavailableException(cause: Throwable) :
  Exception("Local notification queue key is unavailable", cause)

class QueueCrypto {
  companion object {
    private const val AES_ALIAS = "homeapp.notification-import.queue-aes.v1"
    private const val HMAC_ALIAS = "homeapp.notification-import.index-hmac.v1"
    private const val KEYSTORE = "AndroidKeyStore"
    private val KEY_LOCK = Any()
  }

  fun encrypt(id: String, schemaVersion: Int, plaintext: ByteArray): EncryptedValue {
    return guarded {
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.ENCRYPT_MODE, getOrCreateAesKey())
      cipher.updateAAD(aad(id, schemaVersion))
      EncryptedValue(cipher.iv, cipher.doFinal(plaintext))
    }
  }

  fun decrypt(
    id: String,
    schemaVersion: Int,
    nonce: ByteArray,
    ciphertext: ByteArray
  ): ByteArray {
    return guarded {
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE, getOrCreateAesKey(), GCMParameterSpec(128, nonce))
      cipher.updateAAD(aad(id, schemaVersion))
      cipher.doFinal(ciphertext)
    }
  }

  fun index(value: String): String {
    return guarded {
      val mac = Mac.getInstance("HmacSHA256")
      mac.init(getOrCreateHmacKey())
      mac.doFinal(value.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
    }
  }

  fun keysAvailable(): Boolean {
    return try {
      getOrCreateAesKey()
      getOrCreateHmacKey()
      true
    } catch (_: QueueKeyUnavailableException) {
      false
    }
  }

  fun keysPresent(): Boolean {
    return try {
      val keyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }
      keyStore.containsAlias(AES_ALIAS) && keyStore.containsAlias(HMAC_ALIAS)
    } catch (_: Throwable) {
      false
    }
  }

  fun deleteKeys() {
    val keyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }
    if (keyStore.containsAlias(AES_ALIAS)) keyStore.deleteEntry(AES_ALIAS)
    if (keyStore.containsAlias(HMAC_ALIAS)) keyStore.deleteEntry(HMAC_ALIAS)
  }

  internal fun aad(id: String, schemaVersion: Int): ByteArray =
    "homeapp:notification-import:v1:$id:$schemaVersion".toByteArray(Charsets.UTF_8)

  private fun getOrCreateAesKey(): SecretKey = synchronized(KEY_LOCK) {
    val keyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }
    (keyStore.getKey(AES_ALIAS, null) as? SecretKey)?.let { return@synchronized it }

    val builder = KeyGenParameterSpec.Builder(
      AES_ALIAS,
      KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
    )
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setKeySize(256)
      .setRandomizedEncryptionRequired(true)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      builder.setUnlockedDeviceRequired(true)
    }

    KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE).run {
      init(builder.build())
      generateKey()
    }
  }

  private fun getOrCreateHmacKey(): SecretKey = synchronized(KEY_LOCK) {
    val keyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }
    (keyStore.getKey(HMAC_ALIAS, null) as? SecretKey)?.let { return@synchronized it }

    KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_HMAC_SHA256, KEYSTORE).run {
      init(
        KeyGenParameterSpec.Builder(
          HMAC_ALIAS,
          KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
        )
          .setDigests(KeyProperties.DIGEST_SHA256)
          .setKeySize(256)
          .build()
      )
      generateKey()
    }
  }

  private inline fun <T> guarded(block: () -> T): T {
    try {
      return block()
    } catch (error: Throwable) {
      if (
        error is AEADBadTagException ||
        error is KeyPermanentlyInvalidatedException ||
        error is java.security.UnrecoverableKeyException ||
        error.cause is KeyPermanentlyInvalidatedException ||
        error.cause is java.security.UnrecoverableKeyException
      ) {
        throw QueueKeyUnavailableException(error)
      }

      throw error
    }
  }
}

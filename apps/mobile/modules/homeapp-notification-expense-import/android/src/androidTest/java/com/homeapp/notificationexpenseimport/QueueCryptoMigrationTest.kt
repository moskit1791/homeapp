package com.homeapp.notificationexpenseimport

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import org.junit.After
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class QueueCryptoMigrationTest {
  private val context = ApplicationProvider.getApplicationContext<Context>()
  private val crypto = QueueCrypto()

  @Before
  fun setup() {
    NotificationImportDatabase.closeForReset()
    context.deleteDatabase(NotificationImportDatabase.DATABASE_NAME)
    context.getSharedPreferences(CRYPTO_PREFS, Context.MODE_PRIVATE).edit().clear().commit()
    crypto.deleteKeys()
  }

  @After
  fun cleanup() {
    NotificationImportDatabase.closeForReset()
    context.deleteDatabase(NotificationImportDatabase.DATABASE_NAME)
    context.getSharedPreferences(CRYPTO_PREFS, Context.MODE_PRIVATE).edit().clear().commit()
    crypto.deleteKeys()
  }

  @Test
  fun migratesLegacyQueueCiphertextToBackgroundSafeKey() {
    val legacyKey = KeyGenerator.getInstance(
      KeyProperties.KEY_ALGORITHM_AES,
      ANDROID_KEYSTORE
    ).run {
      init(
        KeyGenParameterSpec.Builder(
          LEGACY_AES_ALIAS,
          KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
          .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
          .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
          .setKeySize(256)
          .build()
      )
      generateKey()
    }
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, legacyKey)
    cipher.updateAAD(crypto.aad("1", 1))
    val json = ImportSettings(featureEnabled = true).toJson().toString().toByteArray()
    val encrypted = cipher.doFinal(json)
    NotificationImportDatabase.get(context).dao().saveState(
      NotificationImportStateEntity(
        schemaVersion = 1,
        nonce = cipher.iv,
        ciphertext = encrypted,
        pendingCount = 0,
        updatedAt = System.currentTimeMillis()
      )
    )

    val repository = NotificationImportRepository(context)

    assertTrue(repository.getSettings().featureEnabled)
    assertTrue(crypto.keysAvailable())
    assertFalse(crypto.legacyAesKeyPresent())
  }

  @Test
  fun clearsOnlyUnreadableLocalQueueWhenLegacyKeyIsGone() {
    NotificationImportDatabase.get(context).dao().saveState(
      NotificationImportStateEntity(
        schemaVersion = 1,
        nonce = ByteArray(12) { 1 },
        ciphertext = ByteArray(32) { 2 },
        pendingCount = 4,
        updatedAt = System.currentTimeMillis()
      )
    )

    val repository = NotificationImportRepository(context)

    assertFalse(repository.getSettings().featureEnabled)
    assertTrue(repository.storageState()["state"] == "available")
    assertTrue(crypto.keysAvailable())
  }

  private companion object {
    const val ANDROID_KEYSTORE = "AndroidKeyStore"
    const val CRYPTO_PREFS = "homeapp.notification-import.crypto"
    const val LEGACY_AES_ALIAS = "homeapp.notification-import.queue-aes.v1"
  }
}

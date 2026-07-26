package com.homeapp.notificationexpenseimport

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class NotificationImportDatabaseMigrationTest {
  private val context = ApplicationProvider.getApplicationContext<Context>()
  private val databaseName = "notification-import-migration-test.db"

  @Before
  fun before() {
    context.deleteDatabase(databaseName)
  }

  @After
  fun after() {
    NotificationImportDatabase.closeForReset()
    context.deleteDatabase(databaseName)
  }

  @Test
  fun migratesVersionOneWithoutDeletingRowsAndScopesDeduplication() {
    context.openOrCreateDatabase(databaseName, Context.MODE_PRIVATE, null).use { database ->
      database.execSQL(
        """
          create table notification_sources (
            id text not null primary key,
            packageIndex text not null,
            schemaVersion integer not null,
            nonce blob not null,
            ciphertext blob not null,
            createdAt integer not null,
            updatedAt integer not null
          )
        """.trimIndent()
      )
      database.execSQL(
        "create unique index index_notification_sources_packageIndex on notification_sources(packageIndex)"
      )
      database.execSQL(
        """
          insert into notification_sources (
            id, packageIndex, schemaVersion, nonce, ciphertext, createdAt, updatedAt
          ) values ('legacy-source', 'legacy-package', 1, x'01', x'02', 1, 1)
        """.trimIndent()
      )
      database.execSQL(
        """
          create table pending_notification_transactions (
            id text not null primary key,
            notificationKeyIndex text,
            fingerprintIndex text not null,
            profileIndex text not null,
            householdIndex text not null,
            status text not null,
            schemaVersion integer not null,
            nonce blob not null,
            ciphertext blob not null,
            receivedAt integer not null,
            createdAt integer not null,
            updatedAt integer not null
          )
        """.trimIndent()
      )
      database.execSQL(
        "create unique index index_pending_notification_transactions_notificationKeyIndex on pending_notification_transactions(notificationKeyIndex)"
      )
      database.execSQL(
        "create unique index index_pending_notification_transactions_fingerprintIndex on pending_notification_transactions(fingerprintIndex)"
      )
      database.execSQL(
        "create index index_pending_notification_transactions_status_profileIndex_householdIndex on pending_notification_transactions(status, profileIndex, householdIndex)"
      )
      database.execSQL(
        """
          create table notification_import_state (
            id integer not null primary key,
            schemaVersion integer not null,
            nonce blob not null,
            ciphertext blob not null,
            pendingCount integer not null,
            updatedAt integer not null
          )
        """.trimIndent()
      )
      database.execSQL(
        """
          insert into pending_notification_transactions (
            id, notificationKeyIndex, fingerprintIndex, profileIndex, householdIndex,
            status, schemaVersion, nonce, ciphertext, receivedAt, createdAt, updatedAt
          ) values ('one', null, 'fingerprint', 'profile', 'household', 'pending', 1, x'01', x'02', 1, 1, 1)
        """.trimIndent()
      )
      database.version = 1
    }

    val migrated = Room.databaseBuilder(
      context,
      NotificationImportDatabase::class.java,
      databaseName
    )
      .addMigrations(
        NotificationImportDatabase.MIGRATION_1_2,
        NotificationImportDatabase.MIGRATION_2_3,
        NotificationImportDatabase.MIGRATION_3_4
      )
      .allowMainThreadQueries()
      .build()

    assertNotNull(migrated.dao().findPendingById("one"))
    assertEquals(1, migrated.dao().adoptLegacySources("profile", "household"))
    assertEquals(
      "legacy-source",
      migrated.dao().listSources("profile", "household").single().id
    )
    migrated.openHelper.writableDatabase.execSQL(
      """
        insert into pending_notification_transactions (
          id, notificationKeyIndex, fingerprintIndex, profileIndex, householdIndex,
          status, schemaVersion, nonce, ciphertext, receivedAt, rawTextExpiresAt,
          createdAt, updatedAt
        ) values (
          'two', null, 'fingerprint', 'other-profile', 'other-household',
          'pending', 1, x'03', x'04', 2, null, 2, 2
        )
      """.trimIndent()
    )
    assertEquals(
      "one",
      migrated.dao().findDuplicate("profile", "household", null, "fingerprint")?.id
    )
    assertEquals(
      "two",
      migrated.dao()
        .findDuplicate("other-profile", "other-household", null, "fingerprint")
        ?.id
    )
    assertNull(
      migrated.dao().findDuplicate("missing-profile", "missing-household", null, "fingerprint")
    )
    val imported = requireNotNull(migrated.dao().findPendingById("one")).copy(
      notificationKeyIndex = "stable-notification",
      status = "imported"
    )
    migrated.dao().updatePending(imported)
    assertEquals(
      "one",
      migrated.dao()
        .findDuplicate("profile", "household", "stable-notification", "changed-fingerprint")
        ?.id
    )
    migrated.dao().insertSource(
      NotificationSourceEntity(
        id = "source-one",
        packageIndex = "same-package",
        profileIndex = "profile",
        householdIndex = "household",
        schemaVersion = 1,
        nonce = byteArrayOf(1),
        ciphertext = byteArrayOf(2),
        createdAt = 1,
        updatedAt = 1
      )
    )
    migrated.dao().insertSource(
      NotificationSourceEntity(
        id = "source-two",
        packageIndex = "same-package",
        profileIndex = "other-profile",
        householdIndex = "other-household",
        schemaVersion = 1,
        nonce = byteArrayOf(3),
        ciphertext = byteArrayOf(4),
        createdAt = 2,
        updatedAt = 2
      )
    )
    assertEquals(2, migrated.dao().listSources("profile", "household").size)
    assertEquals(
      1,
      migrated.dao().listSources("other-profile", "other-household").size
    )
    migrated.close()
  }
}

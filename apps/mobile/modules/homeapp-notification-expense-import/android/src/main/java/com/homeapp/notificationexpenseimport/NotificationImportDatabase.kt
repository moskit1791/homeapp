package com.homeapp.notificationexpenseimport

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Index
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.Update
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Entity(
  tableName = "notification_sources",
  indices = [
    Index(
      value = ["profileIndex", "householdIndex", "packageIndex"],
      unique = true
    )
  ]
)
data class NotificationSourceEntity(
  @androidx.room.PrimaryKey val id: String,
  val packageIndex: String,
  val profileIndex: String?,
  val householdIndex: String?,
  val schemaVersion: Int,
  val nonce: ByteArray,
  val ciphertext: ByteArray,
  val createdAt: Long,
  val updatedAt: Long
)

@Entity(
  tableName = "pending_notification_transactions",
  indices = [
    Index(
      value = ["profileIndex", "householdIndex", "notificationKeyIndex"],
      unique = true
    ),
    Index(
      value = ["profileIndex", "householdIndex", "fingerprintIndex"],
      unique = true
    ),
    Index(value = ["status", "profileIndex", "householdIndex"])
  ]
)
data class PendingTransactionEntity(
  @androidx.room.PrimaryKey val id: String,
  val notificationKeyIndex: String?,
  val fingerprintIndex: String,
  val profileIndex: String,
  val householdIndex: String,
  val status: String,
  val schemaVersion: Int,
  val nonce: ByteArray,
  val ciphertext: ByteArray,
  val receivedAt: Long,
  val rawTextExpiresAt: Long?,
  val createdAt: Long,
  val updatedAt: Long
)

@Entity(tableName = "notification_import_state")
data class NotificationImportStateEntity(
  @androidx.room.PrimaryKey val id: Int = 1,
  val schemaVersion: Int,
  val nonce: ByteArray,
  val ciphertext: ByteArray,
  val pendingCount: Int,
  val updatedAt: Long
)

@Dao
interface NotificationImportDao {
  @Query("select * from notification_sources")
  fun listAllSources(): List<NotificationSourceEntity>

  @Query(
    """
      select * from notification_sources
      where profileIndex = :profileIndex
        and householdIndex = :householdIndex
      order by updatedAt desc
    """
  )
  fun listSources(
    profileIndex: String,
    householdIndex: String
  ): List<NotificationSourceEntity>

  @Query(
    """
      select * from notification_sources
      where profileIndex = :profileIndex
        and householdIndex = :householdIndex
        and packageIndex = :packageIndex
      limit 1
    """
  )
  fun findSource(
    profileIndex: String,
    householdIndex: String,
    packageIndex: String
  ): NotificationSourceEntity?

  @Query(
    """
      update notification_sources
      set profileIndex = :profileIndex,
          householdIndex = :householdIndex
      where profileIndex is null
        or householdIndex is null
    """
  )
  fun adoptLegacySources(profileIndex: String, householdIndex: String): Int

  @Insert(onConflict = OnConflictStrategy.ABORT)
  fun insertSource(entity: NotificationSourceEntity)

  @Update
  fun updateSource(entity: NotificationSourceEntity)

  @Query("select * from pending_notification_transactions")
  fun listAllTransactions(): List<PendingTransactionEntity>

  @Query(
    """
      select * from pending_notification_transactions
      where status = 'pending'
        and profileIndex = :profileIndex
        and householdIndex = :householdIndex
      order by receivedAt desc
    """
  )
  fun listPending(profileIndex: String, householdIndex: String): List<PendingTransactionEntity>

  @Query("select * from pending_notification_transactions where id = :id limit 1")
  fun findPendingById(id: String): PendingTransactionEntity?

  @Query(
    """
      select * from pending_notification_transactions
      where profileIndex = :profileIndex
        and householdIndex = :householdIndex
        and (
          (:notificationKeyIndex is not null and notificationKeyIndex = :notificationKeyIndex)
          or fingerprintIndex = :fingerprintIndex
        )
      limit 1
    """
  )
  fun findDuplicate(
    profileIndex: String,
    householdIndex: String,
    notificationKeyIndex: String?,
    fingerprintIndex: String
  ): PendingTransactionEntity?

  @Insert(onConflict = OnConflictStrategy.ABORT)
  fun insertPending(entity: PendingTransactionEntity)

  @Update
  fun updatePending(entity: PendingTransactionEntity)

  @Query(
    """
      delete from pending_notification_transactions
      where (status = 'pending' and createdAt < :pendingCutoff)
         or (status != 'pending' and updatedAt < :tombstoneCutoff)
    """
  )
  fun deleteExpired(pendingCutoff: Long, tombstoneCutoff: Long): Int

  @Query(
    """
      select * from pending_notification_transactions
      where rawTextExpiresAt is not null
        and rawTextExpiresAt < :now
    """
  )
  fun listWithExpiredRawText(now: Long): List<PendingTransactionEntity>

  @Query("delete from pending_notification_transactions")
  fun clearPending(): Int

  @Query("delete from notification_sources")
  fun clearSources(): Int

  @Query("delete from notification_import_state")
  fun clearState(): Int

  @Query(
    """
      select
        (select count(*) from notification_sources) +
        (select count(*) from pending_notification_transactions) +
        (select count(*) from notification_import_state)
    """
  )
  fun encryptedRecordCount(): Int

  @Query("select * from notification_import_state where id = 1 limit 1")
  fun getState(): NotificationImportStateEntity?

  @Insert(onConflict = OnConflictStrategy.REPLACE)
  fun saveState(entity: NotificationImportStateEntity)
}

@Database(
  entities = [
    NotificationSourceEntity::class,
    PendingTransactionEntity::class,
    NotificationImportStateEntity::class
  ],
  version = 4,
  exportSchema = true
)
abstract class NotificationImportDatabase : RoomDatabase() {
  abstract fun dao(): NotificationImportDao

  companion object {
    const val DATABASE_NAME = "homeapp_notification_expense_import.db"

    val MIGRATION_1_2 = object : Migration(1, 2) {
      override fun migrate(database: SupportSQLiteDatabase) {
        database.execSQL(
          "alter table pending_notification_transactions add column rawTextExpiresAt integer"
        )
      }
    }

    val MIGRATION_2_3 = object : Migration(2, 3) {
      override fun migrate(database: SupportSQLiteDatabase) {
        database.execSQL(
          "drop index if exists index_pending_notification_transactions_notificationKeyIndex"
        )
        database.execSQL(
          "drop index if exists index_pending_notification_transactions_fingerprintIndex"
        )
        database.execSQL(
          """
            create unique index if not exists
              index_pending_notification_transactions_profileIndex_householdIndex_notificationKeyIndex
            on pending_notification_transactions(profileIndex, householdIndex, notificationKeyIndex)
          """.trimIndent()
        )
        database.execSQL(
          """
            create unique index if not exists
              index_pending_notification_transactions_profileIndex_householdIndex_fingerprintIndex
            on pending_notification_transactions(profileIndex, householdIndex, fingerprintIndex)
          """.trimIndent()
        )
      }
    }

    val MIGRATION_3_4 = object : Migration(3, 4) {
      override fun migrate(database: SupportSQLiteDatabase) {
        database.execSQL(
          "alter table notification_sources add column profileIndex text"
        )
        database.execSQL(
          "alter table notification_sources add column householdIndex text"
        )
        database.execSQL(
          "drop index if exists index_notification_sources_packageIndex"
        )
        database.execSQL(
          """
            create unique index
              index_notification_sources_profileIndex_householdIndex_packageIndex
            on notification_sources(profileIndex, householdIndex, packageIndex)
          """.trimIndent()
        )
      }
    }

    @Volatile
    private var instance: NotificationImportDatabase? = null

    fun get(context: Context): NotificationImportDatabase =
      instance ?: synchronized(this) {
        instance ?: Room.databaseBuilder(
          context.applicationContext,
          NotificationImportDatabase::class.java,
          DATABASE_NAME
        )
          .addMigrations(MIGRATION_1_2, MIGRATION_2_3, MIGRATION_3_4)
          .build()
          .also { instance = it }
      }

    fun closeForReset() {
      synchronized(this) {
        instance?.close()
        instance = null
      }
    }
  }
}

package com.portal.online.data.local

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "pegawai_prefs")

class SessionManager(private val context: Context) {
    companion object {
        val KEY_USER_JSON = stringPreferencesKey("pegawai_session")
        val KEY_PENDING_RESET = stringPreferencesKey("pending_reset_id")
    }

    val userSession: Flow<String?> = context.dataStore.data.map { pref ->
        pref[KEY_USER_JSON]
    }

    suspend fun saveSession(sessionJson: String) {
        context.dataStore.edit { it[KEY_USER_JSON] = sessionJson }
    }

    suspend fun clearSession() {
        context.dataStore.edit { it.clear() }
    }
}

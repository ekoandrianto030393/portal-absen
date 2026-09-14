package com.portal.online

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.portal.online.data.model.PegawaiSession
import com.portal.online.ui.auth.LoginScreen
import com.portal.online.ui.dashboard.DashboardScreen

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    var currentSession by remember { mutableStateOf<PegawaiSession?>(null) }

                    if (currentSession == null) {
                        LoginScreen(
                            onLoginSuccess = { session ->
                                currentSession = session
                            }
                        )
                    } else {
                        DashboardScreen(
                            namaPegawai = currentSession?.nama ?: "Pegawai",
                            idKaryawan = currentSession?.idKaryawan ?: "-",
                            onLogout = {
                                currentSession = null
                            }
                        )
                    }
                }
            }
        }
    }
}

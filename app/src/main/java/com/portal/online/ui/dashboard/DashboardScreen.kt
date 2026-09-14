package com.portal.online.ui.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    namaPegawai: String,
    idKaryawan: String,
    onLogout: () -> Unit
) {
    var currentTime by remember { mutableStateOf("") }
    var greetingText by remember { mutableStateOf("") }

    LaunchedEffect(Unit) {
        while (true) {
            val now = Calendar.getInstance()
            val hour = now.get(Calendar.HOUR_OF_DAY)
            greetingText = when (hour) {
                in 5..10 -> "Selamat Pagi 🌅"
                in 11..14 -> "Selamat Siang ☀️"
                in 15..17 -> "Selamat Sore 🌇"
                else -> "Selamat Malam 🌙"
            }
            val fmt = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
            currentTime = fmt.format(now.time)
            delay(1000)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Portal Pegawai Native", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF0F766E),
                    titleContentColor = Color.White
                )
            )
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF0D9488))
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Text(text = "$greetingText,", color = Color.White.copy(alpha = 0.8f), fontSize = 16.sp)
                        Text(text = namaPegawai, color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                        Text(text = "ID: $idKaryawan", color = Color.White.copy(alpha = 0.7f), fontSize = 14.sp)

                        Spacer(modifier = Modifier.height(16.dp))

                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(Color.Black.copy(alpha = 0.15f), RoundedCornerShape(12.dp))
                                .padding(12.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = currentTime,
                                color = Color.White,
                                fontSize = 32.sp,
                                fontWeight = FontWeight.ExtraBold
                            )
                        }
                    }
                }
            }

            item {
                Text(text = "Status Presensi Hari Ini", fontSize = 18.sp, fontWeight = FontWeight.Bold)
            }

            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Card(
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFF1F5F9))
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text("Jam Masuk", fontSize = 12.sp, color = Color.Gray)
                            Text("-- : --", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFF0F766E))
                        }
                    }

                    Card(
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFF1F5F9))
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text("Jam Keluar", fontSize = 12.sp, color = Color.Gray)
                            Text("-- : --", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFF0F766E))
                        }
                    }
                }
            }

            item {
                Spacer(modifier = Modifier.height(24.dp))
                OutlinedButton(
                    onClick = onLogout,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Logout dari Portal", color = Color.Red)
                }
            }
        }
    }
}

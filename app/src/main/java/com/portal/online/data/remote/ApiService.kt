package com.portal.online.data.remote

import com.portal.online.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface ApiService {
    @POST("api/pegawai/login")
    suspend fun login(@Body request: LoginRequest): Response<ApiResponse>

    @POST("api/pegawai/register")
    suspend fun register(@Body request: RegisterRequest): Response<ApiResponse>

    @POST("api/pegawai/lupa-password")
    suspend fun ajukanLupaPassword(@Body body: Map<String, String>): Response<ApiResponse>

    @GET("api/pegawai/lupa-password/status/{id}")
    suspend fun checkStatusPassword(@Path("id") idKaryawan: String): Response<Map<String, Any>>

    @GET("api/pegawai/dashboard/today/{id}")
    suspend fun getDashboardToday(@Path("id") idKaryawan: String): Response<Map<String, Any>>

    @GET("api/absensi/history/{id}")
    suspend fun getHistory(@Path("id") idKaryawan: String, @Query("periode") periode: String? = null): Response<List<AbsensiItem>>
}

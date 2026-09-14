package com.portal.online.data.model

import com.google.gson.annotations.SerializedName

data class PegawaiSession(
    @SerializedName("id_karyawan") val idKaryawan: String,
    @SerializedName("nama") val nama: String,
    @SerializedName("jabatan") val jabatan: String? = null,
    @SerializedName("divisi") val divisi: String? = null,
    @SerializedName("foto") val foto: String? = null
)

data class LoginRequest(
    val username: String,
    val password: String
)

data class RegisterRequest(
    @SerializedName("id_karyawan") val idKaryawan: String,
    val nama: String,
    val username: String,
    val password: String
)

data class ApiResponse(
    val success: Boolean,
    val message: String,
    val data: PegawaiSession? = null
)

data class AbsensiItem(
    val id: Int,
    @SerializedName("id_karyawan") val idKaryawan: String,
    val tanggal: String,
    @SerializedName("jam_masuk") val jamMasuk: String?,
    @SerializedName("jam_keluar") val jamKeluar: String?,
    val status: String?,
    val keterangan: String?
)

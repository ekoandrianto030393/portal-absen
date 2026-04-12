import React, { useEffect, useState, useRef, useCallback } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, SafeAreaView, Image, Animated, StatusBar, Dimensions, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';

// GANTI INI DENGAN URL NGROK ANDA
const BASE_URL = 'https://abcd-123.ngrok-free.app'; 
const API_URL = `${BASE_URL}/api/karyawan/descriptors`;
const IDENTIFY_URL = `${BASE_URL}/api/identify-face`;
const APP_SECRET = 'WANA_SECURE_2024_KEY'; // Kunci Rahasia Anda

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function App() {
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [employeeMap, setEmployeeMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);
  const [matchedUser, setMatchedUser] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('MENCARI TARGET...');
  const [locationStatus, setLocationStatus] = useState('WAITING GPS...');
  const [sysPulse] = useState(new Animated.Value(1));
  const [currentTime, setCurrentTime] = useState(new Date());
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    requestPermission();
    requestLocationPermission();
    fetchEmployees();
    
    // Update jam setiap detik
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    // Animasi denyut sistem (Heartbeat)
    Animated.loop(
      Animated.sequence([
        Animated.timing(sysPulse, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
        Animated.timing(sysPulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();

    return () => clearInterval(timer);
  }, []);

  const requestLocationPermission = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setLocationStatus('GPS DENIED');
      Alert.alert("Izin Diperlukan", "Aplikasi membutuhkan akses lokasi untuk verifikasi kehadiran.");
      return;
    }
    setLocationStatus('GPS ACTIVE');
  };

  const fetchEmployees = async () => {
    try {
      const [resEmp, resConfig] = await Promise.all([
        fetch(API_URL),
        fetch(`${BASE_URL}/api/config`)
      ]);
      const json = await resEmp.json();
      const configJson = await resConfig.json();
      
      if (configJson.success) setConfig(configJson.config);

      const map = {};
      json.descriptors.forEach(emp => {
        map[emp.id_karyawan] = emp;
      });
      setEmployeeMap(map);
    } catch (err) {
      setStatusMsg("SERVER OFFLINE");
    } finally {
      setLoading(false);
    }
  };

  // Animasi garis scan saat sedang memproses
  useEffect(() => {
    if (isProcessing) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
          Animated.timing(scanLineAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      scanLineAnim.stopAnimation();
    }
  }, [isProcessing]);

  const scanLineTranslateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCREEN_WIDTH * 0.8], // Dinamis mengikuti tinggi kotak HUD
  });

  // Helper hitung jarak (Haversine)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // in metres
  };

  const identifyFace = useCallback(async () => {
    if (isProcessing || !cameraRef.current) return;
    setIsProcessing(true);
    setStatusMsg("MENGIDENTIFIKASI...");

    try {
      // --- VERIFIKASI LOKASI ---
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      
      // Deteksi GPS Palsu (Hanya Android yang mendukung properti 'mocked' secara native di Expo)
      if (location.mocked) {
        setStatusMsg("GPS PALSU TERDETEKSI!");
        Alert.alert("Kecurangan Terdeteksi", "Dilarang menggunakan aplikasi Fake GPS!");
        setIsProcessing(false);
        return;
      }

      if (config) {
        const distance = calculateDistance(
          location.coords.latitude, 
          location.coords.longitude, 
          config.office_lat, 
          config.office_lon
        );

        if (distance > config.office_radius) {
          setStatusMsg("DI LUAR RADIUS KANTOR");
          Alert.alert("Lokasi Salah", `Anda berada ${Math.round(distance)}m dari kantor. Batas maksimal ${config.office_radius}m.`);
          setIsProcessing(false);
          return;
        }
      }

      // 1. Ambil foto menggunakan Expo Camera
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        base64: false,
      });

      const formData = new FormData();
      formData.append('photo', {
        uri: photo.uri,
        type: 'image/jpeg',
        name: 'scan.jpg',
      });

      const res = await fetch(IDENTIFY_URL, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          'X-App-Secret': APP_SECRET, // Kirim kunci rahasia ke server
        },
      });

      const result = await res.json();
      
      if (result.success) {
        setMatchedUser(employeeMap[result.id_karyawan] || { nama: result.nama });
        setStatusMsg(result.message.toUpperCase()); // Menampilkan pesan dari server
        setTimeout(() => {
          setMatchedUser(null);
          setIsProcessing(false);
          setStatusMsg("MENCARI TARGET...");
        }, 5000);
      } else {
        setStatusMsg(result.message?.toUpperCase() || "TARGET TIDAK DIKENAL");
        setTimeout(() => setIsProcessing(false), 2000);
      }
    } catch (e) {
      // Log detail error ke console untuk debugging
      console.log("Network Error:", e.message);
      if (e.message.includes("Network request failed")) {
        setStatusMsg("FIREWALL BLOCKED / OFFLINE");
      } else {
        setStatusMsg("ERROR TRANSMISI");
      }
      setIsProcessing(false);
    }
  }, [isProcessing, employeeMap]);

  // Handler deteksi wajah bawaan Expo
  const handleFacesDetected = useCallback(({ faces }) => {
    if (faces.length > 0 && !isProcessing) {
      // Jika lebar wajah > 150 (berarti user sudah cukup dekat)
      if (faces[0].bounds.size.width > 150) {
        identifyFace();
      }
    }
  }, [isProcessing, identifyFace]);

  if (!permission) return <View />;
  if (!permission.granted) return <SafeAreaView style={styles.centered}><Text>Izin Kamera Diperlukan</Text></SafeAreaView>;

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* BACKGROUND SENSOR LAYER */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="front"
        onFacesDetected={handleFacesDetected}
        faceDetectorSettings={{
          mode: 'fast',
          detectLandmarks: 'none',
          runClassifications: 'none',
          minDetectionInterval: 500,
          tracking: true,
        }}
      />

      {/* 1. LAYER 1: HUD HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>AETHER_CORE</Text>
          <Text style={styles.headerSub}>SECURE_LINK // V.4.5</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.headerTime}>[ {currentTime.toLocaleTimeString('id-ID', { hour12: false })} ]</Text>
          <Text style={styles.headerDate}>
            {currentTime.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
          </Text>
        </View>
      </View>

      {/* 2. LAYER 2: SCANNER FRAME (PUSHED HIGHER) */}
      <View style={[styles.hudBracket, isProcessing && styles.hudProcessing]} pointerEvents="none">
        {/* Siku Taktis */}
        <View style={[styles.corner, styles.topL, styles.glow, isProcessing && styles.cornerActive]} />
        <View style={[styles.corner, styles.topR, styles.glow, isProcessing && styles.cornerActive]} />
        <View style={[styles.corner, styles.botL, styles.glow, isProcessing && styles.cornerActive]} />
        <View style={[styles.corner, styles.botR, styles.glow, isProcessing && styles.cornerActive]} />
        
        {isProcessing && (
          <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanLineTranslateY }] }]} />
        )}
      </View>

      {/* 3. LAYER 3: READOUT (FLOATING TOP) */}
      <View style={styles.sidePanel}>
        <Text style={styles.panelTitle}>:: SYSTEM_SCAN_READOUT</Text>
        
        <View style={styles.avatarContainer}>
          {matchedUser?.foto ? (
            <Image 
              source={{ uri: `data:image/jpeg;base64,${matchedUser.foto}` }} 
              style={styles.avatar} 
            />
          ) : (
            <View style={styles.avatarPlaceholder} />
          )}
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.label}>IDENTITY</Text>
          <Text style={styles.value}>{matchedUser ? matchedUser.nama : '...'}</Text>
          
          <Text style={[styles.label, {marginTop: 8}]}>POSITION</Text>
          <Text style={styles.valueGold}>{matchedUser ? matchedUser.jabatan : '...'}</Text>

          <Text style={[styles.label, {marginTop: 8}]}>AUTH_STATUS</Text>
          <Text style={matchedUser ? styles.statusActive : styles.statusLocked}>
            {matchedUser ? '>> AUTHORIZED' : '>> STANDBY'}
          </Text>
        </View>
      </View>

      {/* 4. SYSTEM STATUS */}
      <View style={styles.sysCorner}>
        <Text style={styles.sysText}>DATABASE // {loading ? 'SYNCING' : 'ONLINE'}</Text>
        <Text style={[styles.sysText, {color: locationStatus === 'GPS ACTIVE' ? '#00FF7F' : '#FF0055'}]}>LOCATION // {locationStatus}</Text>
      </View>

      {/* 5. FOOTER FEEDBACK */}
      <View style={styles.bottomBar}>
        <Text style={[styles.statusText, isProcessing && {color: '#FFD700'}]}>{statusMsg}</Text>
        {isProcessing && <ActivityIndicator color="#00FFFF" style={{marginLeft: 10}} size="small" />}
      </View>

      {/* 6. Overlay Sukses */}
      {matchedUser && (
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <Animated.View style={{ transform: [{ scale: sysPulse }] }}>
              <Text style={styles.successTitle}>ACCESS GRANTED</Text>
            </Animated.View>
            <View style={styles.divider} />
            <Text style={styles.successName}>{matchedUser.nama.toUpperCase()}</Text>
            <Text style={styles.successTime}>{new Date().toLocaleTimeString('id-ID')} // VERIFIED</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingTop: 50, paddingHorizontal: 20, paddingBottom: 15,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', borderBottomWidth: 1, borderBottomColor: 'rgba(0,255,255,0.3)'
  },
  headerTitle: { color: '#00FFFF', fontSize: 20, fontWeight: '900', letterSpacing: 3 },
  headerSub: { color: '#008888', fontSize: 10, fontWeight: 'bold', marginTop: -4 },
  headerRight: { alignItems: 'flex-end' },
  headerTime: { color: '#00FFFF', fontSize: 16, fontWeight: 'bold', fontFamily: 'monospace' },
  headerDate: { color: '#008888', fontSize: 10, fontWeight: 'bold' },
  
  hudBracket: {
    position: 'absolute', 
    top: SCREEN_HEIGHT * 0.18, // Geser lebih ke atas agar tidak tertutup tangan
    alignSelf: 'center',
    width: SCREEN_WIDTH * 0.8, 
    height: SCREEN_WIDTH * 0.8,
    borderWidth: 1, borderColor: 'rgba(0, 255, 255, 0.4)',
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 255, 255, 0.05)'
  },
  corner: { position: 'absolute', width: 45, height: 45, borderColor: '#00FFFF', borderWidth: 5, opacity: 0.8 },
  glow: { shadowColor: '#00FFFF', shadowRadius: 15, shadowOpacity: 0.8, elevation: 10 },
  cornerActive: { borderColor: '#00FF7F', shadowColor: '#00FF7F', opacity: 1 },
  topL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  topR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  botL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  botR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  
  hudProcessing: { borderColor: 'rgba(0, 255, 255, 0.5)', shadowColor: '#00FFFF', shadowRadius: 20, shadowOpacity: 0.8 },
  scanLine: {
    width: '100%',
    height: 6,
    backgroundColor: '#00FFFF',
    shadowBlur: 20,
    shadowColor: '#00FFFF',
    shadowOpacity: 0.8,
  },
  
  sidePanel: {
    position: 'absolute', left: 20, top: 110, width: 150,
    backgroundColor: 'rgba(0, 15, 25, 0.85)', padding: 12,
    borderLeftWidth: 3, borderLeftColor: '#00FFFF',
    borderWidth: 1, borderColor: 'rgba(0,255,255,0.1)',
    borderRadius: 4,
  },
  panelTitle: { color: '#00FFFF', fontSize: 8, fontWeight: 'bold', marginBottom: 10, opacity: 0.6, letterSpacing: 1 },
  avatarContainer: { width: 60, height: 60, alignSelf: 'center', borderRadius: 2, overflow: 'hidden', borderWidth: 1, borderColor: '#00FFFF', marginBottom: 12 },
  avatar: { width: '100%', height: '100%' },
  avatarPlaceholder: { width: '100%', height: '100%', backgroundColor: '#1a1a1a' },
  infoBox: { alignItems: 'flex-start' },
  label: { color: '#008888', fontSize: 7, fontWeight: 'bold', letterSpacing: 1 },
  value: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  valueGold: { color: '#FFD700', fontSize: 10, fontWeight: 'bold' },
  statusLocked: { color: '#FF0055', fontSize: 11, fontWeight: 'bold', marginTop: 4 },
  statusActive: { color: '#00FF7F', fontSize: 11, fontWeight: 'bold', marginTop: 4 },
  
  sysCorner: { position: 'absolute', right: 20, top: 110, alignItems: 'flex-end' },
  sysText: { color: 'rgba(0,255,255,0.3)', fontSize: 8, fontWeight: 'bold', fontFamily: 'monospace' },
  
  bottomBar: {
    position: 'absolute', bottom: 40, left: 20, right: 20,
    backgroundColor: 'rgba(0,10,15,0.9)', padding: 15, borderRadius: 4,
    borderWidth: 1, borderColor: 'rgba(0,255,255,0.2)', flexDirection: 'row', justifyContent: 'center'
  },
  statusText: { color: '#00FFFF', fontWeight: 'bold', letterSpacing: 4, fontSize: 12 },
  
  successOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  successCard: { 
    width: '85%', padding: 30, borderLeftWidth: 5, borderLeftColor: '#00FF7F', 
    backgroundColor: '#051015', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(0,255,127,0.3)',
    shadowColor: '#00FF7F', shadowRadius: 30, shadowOpacity: 0.4
  },
  successTitle: { color: '#00FF7F', fontSize: 28, fontWeight: 'black', letterSpacing: 6 },
  divider: { width: '100%', height: 1, backgroundColor: 'rgba(0,255,127,0.2)', marginVertical: 20 },
  successName: { color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'center', letterSpacing: 2 },
  successTime: { color: '#00FF7F', fontSize: 12, marginTop: 8, fontFamily: 'monospace', opacity: 0.6 }
});
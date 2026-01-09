import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  ScrollView, useWindowDimensions, Image, Modal, Animated, Alert, Platform, ImageBackground 
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera'; 
import { Feather } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { captureRef } from 'react-native-view-shot';
import QRCode from 'react-native-qrcode-svg';

const LAYOUT_CONFIGS = {
  STRIP_2x6_3: { label: '2x6 Strip (3 Photos)', width: 220, height: 600, photoCount: 3, columns: 1, type: 'strip' },
  STRIP_2x6_4: { label: '2x6 Strip (4 Photos)', width: 220, height: 750, photoCount: 4, columns: 1, type: 'strip' },
  GRID_4x6_6: { label: '4x6 Grid (6 Photos)', width: 400, height: 600, photoCount: 6, columns: 2, type: 'grid' },
  POSTCARD_4x6: { label: '4x6 Postcard', width: 450, height: 320, photoCount: 2, columns: 1, type: 'landscape' },
};

const GRAIN_URL = 'https://www.transparenttextures.com/patterns/film-grain.png';

export default function EnhancedBrutalistBooth() {
  const { width } = useWindowDimensions();
  const isDesktop = width > 900;

  const [permission, requestPermission] = useCameraPermissions();
  const [libPermission, requestLibPermission] = MediaLibrary.usePermissions();
  const cameraRef = useRef<any>(null);
  const viewShotRef = useRef<any>(null);

  const [selectedLayout, setSelectedLayout] = useState('GRID_4x6_6');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [captures, setCaptures] = useState<any[]>([]);
  const [selectedCapture, setSelectedCapture] = useState<any | null>(null);
  const [userName, setUserName] = useState('LESTER');
  const [customFileName, setCustomFileName] = useState('');
  const [eventDate] = useState('09/01/2026');

  const [isCapturing, setIsCapturing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [tempImages, setTempImages] = useState<string[]>([]);
  const flashOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!permission) requestPermission();
    if (!libPermission) requestLibPermission();
  }, []);

  const triggerFlash = () => {
    Animated.sequence([
      Animated.timing(flashOpacity, { toValue: 1, duration: 50, useNativeDriver: true }),
      Animated.timing(flashOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  };

  const startSession = async () => {
    if (!userName) return Alert.alert("ERROR", "NAME_REQUIRED");
    
    setIsCameraActive(true);
    setIsCapturing(true);
    const sessionImages: string[] = [];
    const config = LAYOUT_CONFIGS[selectedLayout as keyof typeof LAYOUT_CONFIGS];

    for (let i = 0; i < config.photoCount; i++) {
      for (let t = 3; t > 0; t--) {
        setCountdown(t);
        await new Promise(r => setTimeout(r, 800));
      }
      setCountdown(null);
      if (cameraRef.current) {
        triggerFlash();
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
        sessionImages.push(photo.uri);
        setTempImages([...sessionImages]);
      }
      await new Promise(r => setTimeout(r, 600));
    }

    const newStrip = {
      id: Math.random().toString(36).substr(2, 6).toUpperCase(),
      userName: userName.toUpperCase(),
      images: sessionImages,
      layout: selectedLayout,
      date: eventDate
    };

    setCaptures([newStrip, ...captures]);
    setIsCapturing(false);
    setIsCameraActive(false);
    setTempImages([]);
    setCustomFileName(`${userName}_${newStrip.id}`);
    setSelectedCapture(newStrip);
  };

  const saveAndShare = async () => {
    try {
      const uri = await captureRef(viewShotRef, { format: 'png', quality: 1 });
      const finalFileName = customFileName.trim() || `Booth_${selectedCapture.id}`;
      const newUri = `${FileSystem.cacheDirectory}${finalFileName}.png`;

      await FileSystem.moveAsync({ from: uri, to: newUri });

      if (Platform.OS !== 'web') {
        const asset = await MediaLibrary.createAssetAsync(newUri);
        await MediaLibrary.createAlbumAsync("NoirBooth", asset, false);
        await Sharing.shareAsync(newUri);
      } else {
        Alert.alert("SUCCESS", `Saved as ${finalFileName}.png`);
      }
    } catch (e) { Alert.alert("SAVE_ERROR", "FAILED"); }
  };

  return (
    <View style={styles.container}>
      {/* Sidebar Controls */}
      <View style={[styles.sidebar, isDesktop ? styles.sidebarDesktop : styles.sidebarMobile]}>
        <Text style={styles.brand}>NOIR_SYSTEM_v2</Text>
        <View style={styles.controlsSection}>
          <TextInput 
            style={styles.input} 
            placeholder="GUEST_NAME" 
            placeholderTextColor="#444" 
            value={userName} 
            onChangeText={setUserName} 
          />
          <Text style={styles.label}>[ SELECT_LAYOUT ]</Text>
          <View style={styles.layoutPicker}>
            {Object.keys(LAYOUT_CONFIGS).map((key) => (
              <TouchableOpacity 
                key={key} 
                style={[styles.layoutBtn, selectedLayout === key && styles.layoutBtnActive]}
                onPress={() => setSelectedLayout(key)}
              >
                <Text style={[styles.layoutBtnText, selectedLayout === key && styles.layoutBtnTextActive]}>
                  {LAYOUT_CONFIGS[key as keyof typeof LAYOUT_CONFIGS].label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.captureBtn} onPress={startSession} disabled={isCapturing}>
            <Text style={styles.captureBtnText}>START_BOOTH</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Archive Grid */}
      <ScrollView contentContainerStyle={styles.gallery}>
        <Text style={styles.sectionTitle}>ARCHIVE_MEMORIES</Text>
        <View style={styles.grid}>
          {captures.map(item => (
            <TouchableOpacity key={item.id} style={styles.card} onPress={() => setSelectedCapture(item)}>
              <ImageBackground source={{ uri: item.images[0] }} style={styles.cardImg} resizeMode="cover">
                <Image source={{ uri: GRAIN_URL }} style={styles.grainOverlay} />
              </ImageBackground>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{item.userName}</Text>
                <Text style={styles.cardMeta}>{item.id} // {item.layout}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Result Preview Modal */}
      <Modal visible={!!selectedCapture} transparent animationType="fade">
        <View style={styles.resultOverlay}>
          {/* Close Button (X) */}
          <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedCapture(null)}>
            <Feather name="x" size={32} color="white" />
          </TouchableOpacity>

          {selectedCapture && (
            <ScrollView contentContainerStyle={styles.resultContent}>
              <View 
                ref={viewShotRef} 
                collapsable={false} 
                style={[styles.strip, { width: LAYOUT_CONFIGS[selectedCapture.layout as keyof typeof LAYOUT_CONFIGS].width }]}
              >
                <View style={[
                  styles.stripMain, 
                  LAYOUT_CONFIGS[selectedCapture.layout as keyof typeof LAYOUT_CONFIGS].columns > 1 && styles.gridFlow
                ]}>
                  {selectedCapture.images.map((img: any, idx: number) => (
                    <View key={idx} style={[
                        styles.photoContainer,
                        { width: LAYOUT_CONFIGS[selectedCapture.layout as keyof typeof LAYOUT_CONFIGS].columns > 1 ? '48.5%' : '100%' }
                    ]}>
                        <ImageBackground 
                        source={{ uri: img }} 
                        style={styles.stripPhoto}
                        resizeMode="cover"
                        >
                        <Image source={{ uri: GRAIN_URL }} style={styles.grainOverlay} />
                        </ImageBackground>
                    </View>
                  ))}
                </View>
                <View style={styles.stripFooter}>
                    <View style={styles.footerBranding}>
                        <Text style={styles.footerName}>{selectedCapture.userName}</Text>
                        <View style={styles.footerLine} />
                        <Text style={styles.footerMeta}>{selectedCapture.date} // {selectedCapture.id}</Text>
                    </View>
                    <View style={styles.qrInside}>
                        <QRCode value={`https://booth.noir/${selectedCapture.id}`} size={40} backgroundColor="transparent" color="white" />
                    </View>
                </View>
              </View>

              <View style={styles.actionPanel}>
                <Text style={styles.label}>[ CUSTOM_FILENAME ]</Text>
                <TextInput 
                    style={styles.fileNameInput}
                    value={customFileName}
                    onChangeText={setCustomFileName}
                    placeholder="ENTER_FILENAME"
                    placeholderTextColor="#666"
                />
                <TouchableOpacity style={styles.saveAction} onPress={saveAndShare}>
                    <Feather name="download" size={20} color="black" />
                    <Text style={styles.saveActionText}>GENERATE LIVE QR & SAVE</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Camera Interface */}
      <Modal visible={isCameraActive} transparent>
        <View style={styles.cameraModal}>
          <CameraView style={styles.camera} ref={cameraRef} facing="front">
            <View style={styles.cameraHUD}>
              {countdown && <Text style={styles.countdownText}>{countdown}</Text>}
              <View style={styles.hudFooter}>
                <Text style={styles.hudText}>SHOT {tempImages.length + 1} OF {LAYOUT_CONFIGS[selectedLayout as keyof typeof LAYOUT_CONFIGS].photoCount}</Text>
              </View>
            </View>
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'white', opacity: flashOpacity }]} pointerEvents="none" />
          </CameraView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF', flexDirection: Platform.OS === 'web' ? 'row' : 'column' },
  sidebar: { backgroundColor: '#000', padding: 25 },
  sidebarDesktop: { width: 300, height: '100%' },
  sidebarMobile: { width: '100%' },
  brand: { color: '#FFF', fontWeight: '900', fontSize: 20, letterSpacing: -1 },
  controlsSection: { marginTop: 30, gap: 15 },
  input: { borderBottomWidth: 2, borderColor: '#333', color: '#FFF', padding: 10, fontSize: 16, fontWeight: 'bold' },
  label: { color: '#666', fontSize: 10, fontWeight: 'bold', marginVertical: 8 },
  layoutPicker: { gap: 8 },
  layoutBtn: { borderWidth: 1, borderColor: '#333', padding: 10 },
  layoutBtnActive: { backgroundColor: '#FFF' },
  layoutBtnText: { color: '#666', fontSize: 11, fontWeight: 'bold' },
  layoutBtnTextActive: { color: '#000' },
  captureBtn: { backgroundColor: '#FFF', padding: 18, marginTop: 15, alignItems: 'center' },
  captureBtnText: { fontWeight: '900', letterSpacing: 1 },
  gallery: { padding: 30 },
  sectionTitle: { fontWeight: '900', fontSize: 32, letterSpacing: -1, marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15 },
  card: { width: 180, borderWidth: 2, borderColor: '#000', marginBottom: 15 },
  cardImg: { width: '100%', height: 200, backgroundColor: '#EEE' },
  cardInfo: { padding: 8, backgroundColor: '#000' },
  cardName: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  cardMeta: { color: '#666', fontSize: 8 },
  resultOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.98)', justifyContent: 'center', position: 'relative' },
  // New style for the close button
  closeBtn: { position: 'absolute', top: 50, right: 30, zIndex: 10, padding: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 50 },
  resultContent: { alignItems: 'center', paddingVertical: 80 }, // Added padding top so content doesn't overlap 'X'
  strip: { backgroundColor: '#000', padding: 15, borderWidth: 1, borderColor: '#333' },
  stripMain: { gap: 10 },
  gridFlow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  photoContainer: { height: 140, backgroundColor: '#111', overflow: 'hidden' },
  stripPhoto: { width: '100%', height: '100%' },
  grainOverlay: { ...StyleSheet.absoluteFillObject, opacity: 0.35 },
  stripFooter: { marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 5 },
  footerBranding: { flex: 1 },
  footerName: { color: 'white', fontSize: 24, fontWeight: '300', fontFamily: Platform.OS === 'ios' ? 'Snell Roundhand' : 'serif' },
  footerLine: { width: 30, height: 1, backgroundColor: '#444', marginVertical: 6 },
  footerMeta: { color: '#555', fontSize: 8, letterSpacing: 1, fontWeight: 'bold' },
  qrInside: { padding: 5, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4 },
  actionPanel: { width: 300, marginTop: 30 },
  fileNameInput: { backgroundColor: '#111', color: '#FFF', padding: 15, fontSize: 14, fontWeight: 'bold', borderWidth: 1, borderColor: '#333' },
  saveAction: { marginTop: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', padding: 18, gap: 10 },
  saveActionText: { fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  cameraModal: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  cameraHUD: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  countdownText: { fontSize: 120, fontWeight: '900', color: '#FFF' },
  hudFooter: { position: 'absolute', bottom: 40, backgroundColor: '#000', padding: 10 },
  hudText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 }
});
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  ScrollView, useWindowDimensions, Image, Modal, Animated, 
  Alert, Platform, ImageBackground, ActivityIndicator
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Feather } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { captureRef } from 'react-native-view-shot';
import QRCode from 'react-native-qrcode-svg';

// --- CONFIGURATIONS ---
const LAYOUT_CONFIGS = {
  STRIP_2x6_3: { label: '2x6 Strip (3 Photos)', width: 220, height: 660, photoCount: 3, columns: 1 },
  STRIP_2x6_4: { label: '2x6 Strip (4 Photos)', width: 220, height: 850, photoCount: 4, columns: 1 },
  GRID_4x6_6: { label: '4x6 Grid (6 Photos)', width: 400, height: 600, photoCount: 6, columns: 2 },
  POSTCARD_4x6: { label: '4x6 Postcard', width: 400, height: 400, photoCount: 2, columns: 2 },
};

const GRAIN_URL = 'https://www.transparenttextures.com/patterns/film-grain.png';

// --- MINI PREVIEW CARD ---
const ArchiveCard = ({ item, onPress }: { item: any, onPress: () => void }) => {
  const config = LAYOUT_CONFIGS[item.layout as keyof typeof LAYOUT_CONFIGS];
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={[styles.miniStrip, { aspectRatio: config.width / config.height }]}>
        <View style={[styles.miniStripMain, config.columns > 1 && styles.gridFlow]}>
          {item.images.map((img: string, idx: number) => (
            <View key={idx} style={[styles.miniPhotoContainer, { width: config.columns > 1 ? '47%' : '100%' }]}>
              <Image source={{ uri: img }} style={styles.fullImg} resizeMode="cover" />
            </View>
          ))}
        </View>
        <View style={styles.miniFooter}>
             <Text style={styles.miniFooterText} numberOfLines={1}>{item.userName}</Text>
             <Text style={styles.miniFooterId}>{item.id}</Text>
        </View>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{item.userName}</Text>
        <Text style={styles.cardMeta}>{item.layout}</Text>
      </View>
    </TouchableOpacity>
  );
};

export default function EnhancedBrutalistBooth() {
  const { width } = useWindowDimensions();
  const isDesktop = width > 900;

  // Permissions & Refs
  const [permission, requestPermission] = useCameraPermissions();
  const [libPermission, requestLibPermission] = MediaLibrary.usePermissions();
  const cameraRef = useRef<any>(null);
  const viewShotRef = useRef<any>(null);
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const countdownAnim = useRef(new Animated.Value(0)).current;

  // App State
  const [selectedLayout, setSelectedLayout] = useState('GRID_4x6_6');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [captures, setCaptures] = useState<any[]>([]);
  const [selectedCapture, setSelectedCapture] = useState<any | null>(null);
  const [userName, setUserName] = useState('GUEST');
  const [customFileName, setCustomFileName] = useState('');
  
  // Interaction State
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSaving, setIsSaving] = useState(false); 
  const [countdown, setCountdown] = useState<number | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(3);
  const [tempImages, setTempImages] = useState<string[]>([]);
  const [mirror, setMirror] = useState<boolean>(true);
  // Web Camera State
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Cleanup webcam on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // Web Camera Functions
  const startWebCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: 640, height: 480 } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      Alert.alert("CAMERA ERROR", "Could not access camera. Please allow camera permissions.");
      setIsCameraActive(false);
      setIsCapturing(false);
    }
  };

  const captureWebPhoto = async (): Promise<string> => {
    return new Promise((resolve) => {
      if (!videoRef.current || !canvasRef.current) {
        resolve('');
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        resolve('');
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      
      resolve(canvas.toDataURL('image/png'));
    });
  };

  const runWebSession = async () => {
    await startWebCamera();
    await new Promise(r => setTimeout(r, 500)); // Wait for camera to start

    const sessionImages: string[] = [];
    const config = LAYOUT_CONFIGS[selectedLayout as keyof typeof LAYOUT_CONFIGS];

    for (let i = 0; i < config.photoCount; i++) {
      for (let t = countdownSeconds; t > 0; t--) {
        setCountdown(t);
        animateCountdown();
        await new Promise(r => setTimeout(r, 800));
      }
      setCountdown(null);
      
      triggerFlash();
      const photoData = await captureWebPhoto();
      if (photoData) {
        sessionImages.push(photoData);
        setTempImages([...sessionImages]);
      }
      
      await new Promise(r => setTimeout(r, 600));
    }

    // Stop camera
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    const newStrip = {
      id: Math.random().toString(36).substr(2, 5).toUpperCase(),
      userName: userName.toUpperCase(),
      images: sessionImages,
      layout: selectedLayout,
      date: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
    };

    setCaptures([newStrip, ...captures]);
    setIsCapturing(false);
    setIsCameraActive(false);
    setTempImages([]);
    setSelectedCapture(newStrip);
  };

  useEffect(() => {
    if (isCameraActive && Platform.OS === 'web') {
      runWebSession();
    }
  }, [isCameraActive]);

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

  const animateCountdown = () => {
    countdownAnim.setValue(0);
    Animated.sequence([
      Animated.timing(countdownAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(countdownAnim, { toValue: 0, duration: 450, useNativeDriver: true }),
    ]).start();
  };

  const startSession = async () => {
    if (!userName.trim()) return Alert.alert("ERROR", "Please enter your name");
    
    // WEB: Use webcam with getUserMedia
    if (Platform.OS === 'web') {
      setIsCameraActive(true);
      setIsCapturing(true);
      return;
    }
    
    // MOBILE: Use actual camera
    setIsCameraActive(true);
    setIsCapturing(true);
    const sessionImages: string[] = [];
    const config = LAYOUT_CONFIGS[selectedLayout as keyof typeof LAYOUT_CONFIGS];

    for (let i = 0; i < config.photoCount; i++) {
      for (let t = countdownSeconds; t > 0; t--) {
        setCountdown(t);
        animateCountdown();
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
      id: Math.random().toString(36).substr(2, 5).toUpperCase(),
      userName: userName.toUpperCase(),
      images: sessionImages,
      layout: selectedLayout,
      date: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
    };

    setCaptures([newStrip, ...captures]);
    setIsCapturing(false);
    setIsCameraActive(false);
    setTempImages([]);
    setSelectedCapture(newStrip);
  };

  // --- CROSS-PLATFORM SAVE LOGIC ---
  const saveAndShare = async () => {
    if (!selectedCapture || isSaving) return;

    setIsSaving(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 150));

      const baseName = customFileName.trim().replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const finalFileName = (baseName || `Booth_${selectedCapture.id}`) + ".png";

      if (Platform.OS === 'web') {
        // WEB DOWNLOAD - Use html2canvas
        const html2canvas = (await import('html2canvas')).default;
        const element = viewShotRef.current;
        
        if (!element) throw new Error('View not found');
        
        const canvas = await html2canvas(element, {
          backgroundColor: '#000000',
          scale: 2,
          logging: false,
        });
        
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = finalFileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 'image/png');
        
        Alert.alert('SUCCESS', 'Download started! Check your Downloads folder.');
        setIsSaving(false);
        return;
      }

      // MOBILE - Use react-native-view-shot
      const uri = await captureRef(viewShotRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile'
      });

      console.log('✅ Captured URI:', uri);

      // Normalize file URI
      let fileUri = uri;

      if (uri.startsWith('data:')) {
        const base64 = uri.split(',')[1];
        fileUri = `${FileSystem.cacheDirectory}${finalFileName}`;
        await FileSystem.writeAsStringAsync(fileUri, base64, { 
          encoding: FileSystem.EncodingType.Base64 
        });
        console.log('✅ Converted data URI to file:', fileUri);
      } else if (uri.startsWith('file:') || uri.startsWith('/')) {
        const dest = `${FileSystem.cacheDirectory}${finalFileName}`;
        try {
          await FileSystem.copyAsync({ from: uri, to: dest });
          fileUri = dest;
          console.log('✅ Copied to cache:', fileUri);
        } catch (copyErr) {
          console.log('⚠️ Copy failed, using original:', copyErr);
          fileUri = uri;
        }
      } else if (uri.startsWith('content:')) {
        const dest = `${FileSystem.cacheDirectory}${finalFileName}`;
        try {
          await FileSystem.copyAsync({ from: uri, to: dest });
          fileUri = dest;
          console.log('✅ Copied content URI to cache:', fileUri);
        } catch (copyErr) {
          console.log('⚠️ Content copy failed, using original:', copyErr);
          fileUri = uri;
        }
      }

      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('PERMISSION DENIED', 'Gallery access is required to save photos.');
        setIsSaving(false);
        return;
      }

      console.log('✅ Gallery permission granted');

      let asset;
      if (Platform.OS === 'android' && FileSystem.getContentUriAsync) {
        try {
          const contentUri = await FileSystem.getContentUriAsync(fileUri);
          asset = await MediaLibrary.createAssetAsync(contentUri);
          console.log('✅ Asset created via content URI');
        } catch (err) {
          console.log('⚠️ Content URI failed, using direct path:', err);
          asset = await MediaLibrary.createAssetAsync(fileUri);
        }
      } else {
        asset = await MediaLibrary.createAssetAsync(fileUri);
      }

      console.log('✅ Asset created:', asset.id);

      const albumName = 'NoirBooth';
      try {
        const album = await MediaLibrary.getAlbumAsync(albumName);
        if (album) {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
          console.log('✅ Added to existing album');
        } else {
          await MediaLibrary.createAlbumAsync(albumName, asset, false);
          console.log('✅ Created new album');
        }
      } catch (albumError) {
        console.log('⚠️ Album operation skipped:', albumError);
      }

      Alert.alert('SUCCESS', `Photo saved to gallery!\n\n${finalFileName}`);

      try {
        if (await Sharing.isAvailableAsync()) {
          const shouldShare = await new Promise((resolve) => {
            Alert.alert(
              'Share Photo',
              'Would you like to share this photo?',
              [
                { text: 'Not Now', onPress: () => resolve(false), style: 'cancel' },
                { text: 'Share', onPress: () => resolve(true) }
              ]
            );
          });
          
          if (shouldShare) {
            await Sharing.shareAsync(asset.uri || fileUri, { 
              mimeType: 'image/png', 
              dialogTitle: 'Share your photo booth strip' 
            });
          }
        }
      } catch (shareError) {  
        console.log('⚠️ Share skipped:', shareError);
      }

    } catch (e: any) {
      console.error('❌ Save error:', e);
      Alert.alert(
        'SAVE ERROR', 
        `Failed to save image.\n\nError: ${e.message || 'Unknown error'}\n\nTip: ${Platform.OS === 'web' ? 'Make sure pop-ups are enabled' : 'Check permissions in Settings'}`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const currentConfig = LAYOUT_CONFIGS[selectedLayout as keyof typeof LAYOUT_CONFIGS];

  return (
    <View style={[styles.container, { flexDirection: isDesktop ? 'row' : 'column' }]}> 
      {/* SIDEBAR */}
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
          <View style={styles.controlColumn}>
            <TouchableOpacity style={styles.toggleBtn} onPress={() => setMirror(m => !m)}>
              <Text style={styles.toggleText}>INVERT: {mirror ? 'ON' : 'OFF'}</Text>
            </TouchableOpacity>
            <View style={{ height: 10 }} />
            <View style={{ flexDirection: 'column' }}>
              <Text style={styles.toggleText}>TIMER</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                {[1,3,5].map((v) => (
                  <TouchableOpacity
                    key={v}
                    onPress={() => setCountdownSeconds(v)}
                    style={[styles.presetBtn, countdownSeconds === v && styles.presetBtnActive]}
                  >
                    <Text style={[styles.presetText, countdownSeconds === v && styles.presetTextActive]}>{v}s</Text>
                  </TouchableOpacity>
                ))}
                <View style={{ width: 8 }} />
                <TextInput
                  style={styles.timerInput}
                  value={String(countdownSeconds)}
                  onChangeText={(v) => {
                    const n = parseInt(v || '0', 10);
                    if (Number.isNaN(n)) return;
                    setCountdownSeconds(Math.max(1, Math.min(9, n)));
                  }}
                  keyboardType="numeric"
                  maxLength={1}
                />
              </View>
            </View>
          </View>
          <TouchableOpacity 
            style={[styles.captureBtn, isCapturing && styles.captureBtnDisabled]} 
            onPress={startSession} 
            disabled={isCapturing}
          >
            <Text style={styles.captureBtnText}>
              {isCapturing ? 'SESSION_ACTIVE...' : 'START_BOOTH'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* GALLERY GRID */}
      <ScrollView contentContainerStyle={styles.gallery}>
        <Text style={styles.sectionTitle}>ARCHIVE_MEMORIES</Text>
        {captures.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="camera" size={64} color="#CCC" />
            <Text style={styles.emptyText}>No photos yet</Text>
            <Text style={styles.emptySubtext}>
              Start a booth session to capture memories
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {captures.map(item => (
              <ArchiveCard key={item.id} item={item} onPress={() => setSelectedCapture(item)} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* RESULT MODAL */}
      <Modal visible={!!selectedCapture} transparent animationType="fade">
        <View style={styles.resultOverlay}>
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
                        <ImageBackground source={{ uri: img }} style={styles.fullImg} resizeMode="cover">
                            <Image source={{ uri: GRAIN_URL }} style={styles.grainOverlay} />
                        </ImageBackground>
                    </View>
                  ))}
                </View>
                <View style={styles.stripFooter}>
                    <View style={styles.footerBranding}>
                        <Text style={styles.footerName}>{selectedCapture.userName}</Text>
                        <Text style={styles.footerMeta}>{selectedCapture.date} // {selectedCapture.id}</Text>
                    </View>
                    <View style={styles.qrInside}>
                        <QRCode value={`https://noir.booth/${selectedCapture.id}`} size={45} backgroundColor="white" color="black" />
                    </View>
                </View>
              </View>

              <View style={styles.actionPanel}>
                <Text style={styles.inputLabel}>CUSTOM FILE NAME (OPTIONAL):</Text>
                <TextInput
                    style={styles.fileNameInput}
                    value={customFileName}
                    onChangeText={setCustomFileName}
                    placeholder="e.g. birthday_2026"
                    placeholderTextColor="#666"
                    autoCapitalize="none"
                />
                <TouchableOpacity 
                    style={[styles.saveAction, isSaving && styles.saveActionDisabled]} 
                    onPress={saveAndShare}
                    disabled={isSaving}
                >
                    {isSaving ? (
                        <>
                            <ActivityIndicator color="black" />
                            <Text style={styles.saveActionText}>SAVING...</Text>
                        </>
                    ) : (
                        <>
                            <Feather name="download" size={20} color="black" />
                            <Text style={styles.saveActionText}>SAVE TO DEVICE</Text>
                        </>
                    )}
                </TouchableOpacity>
                <Text style={styles.helpText}>
                  {Platform.OS === 'web' ? 'Downloads to your Downloads folder' : 'Saves to your Photos app'}
                </Text>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* CAMERA UI - Mobile Only */}
      {Platform.OS !== 'web' && (
        <Modal visible={isCameraActive} transparent>
          <View style={styles.cameraModal}>
            <View style={styles.cameraInner}>
              <View style={[styles.cameraWrapper, { flex: isDesktop ? 1 : 0.7, height: isDesktop ? '100%' : 420 }]}>
                <CameraView
                  style={[styles.camera, { transform: [{ scaleX: mirror ? -1 : 1 }] }]}
                  ref={cameraRef}
                  facing="front"
                >
                  <View style={styles.cameraHUD}>
                    <View style={styles.hudFooter}>
                      <Text style={styles.hudText}>
                        FRAME {tempImages.length + 1} / {LAYOUT_CONFIGS[selectedLayout as keyof typeof LAYOUT_CONFIGS].photoCount}
                      </Text>
                    </View>
                  </View>
                  <Animated.View 
                    style={[StyleSheet.absoluteFill, { backgroundColor: 'white', opacity: flashOpacity }]} 
                    pointerEvents="none" 
                  />
                </CameraView>
              </View>

              <View style={[
                styles.previewWrapper,
                isDesktop ? styles.previewSidebar : (currentConfig.photoCount === 3 ? styles.previewSidebarSmall : {})
              ]}>
                <Text style={styles.previewLabel}>PREVIEW</Text>
                <View style={[
                  styles.previewStrip,
                  (isDesktop || currentConfig.photoCount === 3) ? { flexDirection: 'column', alignItems: 'flex-start' } : (currentConfig.photoCount === 6 ? styles.previewStripTop : {})
                ]}>
                  {Array.from({ length: currentConfig.photoCount }).map((_, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.previewPhotoContainer,
                        (isDesktop || currentConfig.photoCount === 3) ? styles.previewThumbContainer : (currentConfig.photoCount === 6 && !isDesktop) ? styles.previewPhotoSmall : { width: currentConfig.columns > 1 ? '48%' : '100%' }
                      ]}
                    >
                      {tempImages[idx] ? (
                        <ImageBackground source={{ uri: tempImages[idx] }} style={styles.previewPhoto} resizeMode="cover">
                          <Image source={{ uri: GRAIN_URL }} style={styles.grainOverlay} />
                        </ImageBackground>
                      ) : (
                        <View style={styles.previewPlaceholder}>
                          <Text style={styles.previewIndex}>{idx + 1}</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {countdown !== null && (
              <Animated.View style={[styles.countdownOverlay, { opacity: countdownAnim }]} pointerEvents="none">
                <Animated.View style={[styles.countdownBadge, { transform: [{ scale: countdownAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }] }>
                  <Animated.Text style={styles.countdownText}>{countdown}</Animated.Text>
                </Animated.View>
              </Animated.View>
            )}
          </View>
        </Modal>
      )}

      {/* CAMERA UI - Web */}
      {Platform.OS === 'web' && (
        <Modal visible={isCameraActive} transparent>
          <View style={styles.cameraModal}>
            <View style={[styles.cameraInner, { flexDirection: isDesktop ? 'row' : 'column' }]}>
              {/* On desktop show preview left, camera right */}
              <View style={[styles.previewWrapper, isDesktop ? styles.previewSidebar : {} ] }>
                <Text style={styles.previewLabel}>PREVIEW</Text>
                <View style={styles.previewStrip}>
                  {Array.from({ length: currentConfig.photoCount }).map((_, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.previewPhotoContainer,
                        isDesktop ? styles.previewThumbContainer : { width: currentConfig.columns > 1 ? '48%' : '10%' }
                      ]}
                    >
                      {tempImages[idx] ? (
                        <ImageBackground source={{ uri: tempImages[idx] }} style={styles.previewPhoto} resizeMode="cover">
                          <Image source={{ uri: GRAIN_URL }} style={styles.grainOverlay} />
                        </ImageBackground>
                      ) : (
                        <View style={styles.previewPlaceholder}>
                          <Text style={styles.previewIndex}>{idx + 1}</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              </View>

              <View style={[styles.cameraWrapper, { flex: isDesktop ? 0.65 : 1, height: isDesktop ? '100%' : 320 }] }>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: `scaleX(${mirror ? -1 : 1})`
                  }}
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                <View style={styles.cameraHUD}>
                  <View style={styles.hudFooter}>
                    <Text style={styles.hudText}>
                      FRAME {tempImages.length + 1} / {currentConfig.photoCount}
                    </Text>
                  </View>
                </View>
                <Animated.View 
                  style={[StyleSheet.absoluteFill, { backgroundColor: 'white', opacity: flashOpacity }]} 
                  pointerEvents="none" 
                />
              </View>
            </View>

            {countdown !== null && (
              <Animated.View style={[styles.countdownOverlay, { opacity: countdownAnim }]} pointerEvents="none">
                <Animated.View style={[styles.countdownBadge, { transform: [{ scale: countdownAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }] }>
                  <Animated.Text style={styles.countdownText}>{countdown}</Animated.Text>
                </Animated.View>
              </Animated.View>
            )}
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  sidebar: { backgroundColor: '#000', padding: 25 },
  sidebarDesktop: { width: 320, height: '100%' },
  sidebarMobile: { width: '100%' },
  brand: { color: '#FFF', fontWeight: '900', fontSize: 24, letterSpacing: -1 },
  webNotice: { color: '#FF6B00', fontSize: 11, marginTop: 10, fontWeight: 'bold' },
  controlsSection: { marginTop: 20, gap: 10 },
  input: { borderBottomWidth: 2, borderColor: '#444', color: '#FFF', padding: 12, fontSize: 16, fontWeight: 'bold' },
  label: { color: '#888', fontSize: 10, fontWeight: 'bold', marginTop: 10 },
  layoutPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  layoutBtn: { borderWidth: 1, borderColor: '#333', padding: 10, width: '48%' },
  layoutBtnActive: { backgroundColor: '#FFF' },
  layoutBtnText: { color: '#888', fontSize: 10, fontWeight: 'bold' },
  layoutBtnTextActive: { color: '#000' },
  captureBtn: { backgroundColor: '#FFF', padding: 20, marginTop: 15, alignItems: 'center' },
  captureBtnDisabled: { opacity: 0.5 },
  captureBtnText: { fontWeight: '900', fontSize: 14 },
  
  gallery: { padding: 30 },
  sectionTitle: { fontWeight: '900', fontSize: 32, letterSpacing: -1, marginBottom: 25 },
  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#666', fontSize: 18, fontWeight: 'bold', marginTop: 20 },
  emptySubtext: { color: '#999', fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  
  card: { width: 170, marginBottom: 20 },
  miniStrip: { backgroundColor: '#000', padding: 8, overflow: 'hidden', justifyContent: 'space-between' },
  miniStripMain: { flex: 1, gap: 4 },
  gridFlow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  miniPhotoContainer: { aspectRatio: 1, backgroundColor: '#111' },
  miniFooter: { marginTop: 6, borderTopWidth: 1, borderColor: '#333', paddingTop: 4 },
  miniFooterText: { color: '#FFF', fontSize: 9, fontWeight: 'bold' },
  miniFooterId: { color: '#666', fontSize: 5, marginTop: 1 },
  cardInfo: { marginTop: 8 },
  cardName: { fontWeight: 'bold', fontSize: 13, textTransform: 'uppercase' },
  cardMeta: { color: '#AAA', fontSize: 9, marginTop: 2 },

  resultOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.98)' },
  closeBtn: { position: 'absolute', top: 40, right: 30, zIndex: 10 },
  resultContent: { alignItems: 'center', paddingVertical: 80 },
  strip: { backgroundColor: '#000', padding: 20 },
  stripMain: { gap: 10 },
  photoContainer: { aspectRatio: 1, backgroundColor: '#111', overflow: 'hidden' },
  fullImg: { width: '100%', height: '100%' },
  grainOverlay: { ...StyleSheet.absoluteFillObject, opacity: 0.3 },
  stripFooter: { marginTop: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerBranding: { flex: 1 },
  footerName: { color: 'white', fontSize: 28, fontWeight: '300', textTransform: 'uppercase' },
  footerMeta: { color: '#444', fontSize: 9, fontWeight: 'bold', marginTop: 4 },
  qrInside: { padding: 5, backgroundColor: 'white' },

  actionPanel: { width: 300, marginTop: 30 },
  inputLabel: { color: '#FFF', fontSize: 10, fontWeight: 'bold', marginBottom: 5 },
  fileNameInput: { backgroundColor: '#111', color: '#FFF', padding: 15, fontSize: 14, borderWidth: 1, borderColor: '#333', marginBottom: 10 },
  saveAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', padding: 20, minHeight: 60, gap: 10 },
  saveActionDisabled: { opacity: 0.6 },
  saveActionText: { fontWeight: '900', fontSize: 13 },
  helpText: { color: '#666', fontSize: 11, textAlign: 'center', marginTop: 10 },

  cameraModal: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  cameraInner: { flex: 1, flexDirection: Platform.OS === 'web' ? 'row' : 'column' },
  cameraWrapper: { flex: Platform.OS === 'web' ? 0.65 : 1, overflow: 'hidden'},
  cameraWrapperWeb: { flex: Platform.OS === 'web' ? 0.65 : 1, overflow: 'hidden', marginRight: 400 },
  previewWrapper: { flex: Platform.OS === 'web' ? 0.35 : 0.35, padding: 12, backgroundColor: '#000' },
  previewSidebar: { width: 220, padding: 12, backgroundColor: '#000', alignItems: 'flex-start' },
  previewSidebarSmall: { width: 96, padding: 10, backgroundColor: '#000', alignItems: 'flex-start' },
  previewLabel: { color: '#999', fontSize: 10, fontWeight: '700', marginBottom: 8 },
  previewStrip: { flex: 1, flexDirection: Platform.OS === 'web' ? 'column' : 'row', flexWrap: Platform.OS === 'web' ? 'nowrap' : 'wrap', gap: 8, justifyContent: 'center', alignItems: 'center' },
  previewPhotoContainer: { width: Platform.OS === 'web' ? '100%' : '48%', aspectRatio: 1, marginBottom: 8 },
  previewStack: { flexDirection: 'column', alignItems: 'flex-start' },
  previewStackItem: { width: '100%', aspectRatio: 1, marginBottom: 10 },
  previewThumbContainer: { width: 56, height: 56, marginBottom: 10, borderWidth: 1, borderColor: '#222', overflow: 'hidden', justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' },
  previewPhoto: { width: '100%', height: '100%' },
  previewPlaceholder: { ...StyleSheet.absoluteFillObject, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  previewIndex: { color: '#666', fontSize: 20, fontWeight: '900' },
  cameraHUD: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  countdownOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
  countdownBadge: { backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 24, paddingVertical: 8, borderRadius: 12, minWidth: 110, alignItems: 'center', justifyContent: 'center' },
  countdownText: { fontSize: 120, fontWeight: '900', color: '#FFF', textAlign: 'center' },
  hudFooter: { position: 'absolute', bottom: 50, backgroundColor: '#000', padding: 15 },
  hudText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 }
 ,
  controlRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  controlColumn: { flexDirection: 'column', alignItems: 'flex-start', marginTop: 8 },
  toggleBtn: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#111', borderWidth: 1, borderColor: '#333' },
  toggleText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
  timerGroup: { alignItems: 'center' },
  timerInput: { backgroundColor: '#111', color: '#FFF', padding: 8, width: 48, textAlign: 'center', borderWidth: 1, borderColor: '#333', marginTop: 4 },
  presetBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#111', borderWidth: 1, borderColor: '#333', marginRight: 8, borderRadius: 6 },
  presetBtnActive: { backgroundColor: '#FFF', borderColor: '#FFF' },
  presetText: { color: '#FFF', fontWeight: '700' },
  presetTextActive: { color: '#000' }
});
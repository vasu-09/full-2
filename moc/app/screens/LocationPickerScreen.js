// screens/LocationPickerScreen.js
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import MapView from 'react-native-maps';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function LocationPickerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const mapRef = useRef(null);

  const [region, setRegion] = useState(null);
  
  const [isFullScreen, setIsFullScreen] = useState(false);

  
  // 1️⃣ Get last‑known (fast) or current location
 useEffect(() => {
  (async () => {
    // 1️⃣ Ask for permission up front
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Location permission not granted');
      return;
    }

    try {
      // 2️⃣ Get a fresh position (with a 10s timeout)
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        maximumAge: 0,
        timeout: 10000,       // 10 seconds max wait
      });

      setRegion({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    } catch (err) {
      console.error('Failed to get location:', err);
      // optionally set a fallback region here
    }
  })();
}, []);


  if (!region) {
    return (
      <SafeAreaView style={styles.loader}>
        <Text>Loading map…</Text>
      </SafeAreaView>
    );
  }

  // Helpers to send back
  const sendCurrent = () => {
    const url = `https://maps.google.com/?q=${region.latitude},${region.longitude}`;
    router.replace({
      pathname: '/screens/ChatDetailScreen',
      params: { location: JSON.stringify({ coords: region, url }) },
    });
  };
  

  // Center back on current coords
  const centerMap = () => {
    if (mapRef.current) {
      mapRef.current.animateToRegion(region, 500);
    }
  };

  // map height: half or full
  const mapHeight = isFullScreen
    ? Dimensions.get('window').height - insets.top
    : Dimensions.get('window').height * 0.5;

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          onPress={() => setIsFullScreen(f => !f)}
          style={styles.fullscreenBtn}
        >
          <Icon
            name={isFullScreen ? 'fullscreen-exit' : 'fullscreen'}
            size={24}
            color="#fff"
          />
        </TouchableOpacity>

        <Text style={styles.title}>send location</Text>

        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconBtn}
        >
          <Icon name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* MAP */}
      <View style={[styles.mapContainer, { height: mapHeight }]}>
        <MapView
          ref={mapRef}
         style={StyleSheet.absoluteFill}
         initialRegion={region}
         onRegionChangeComplete={r => setRegion(r)}
         showsUserLocation
         showsMyLocationButton={false}
          liteMode={false}
        />
        {/* Center Marker */}
        <View style={styles.markerFixed}>
          <Icon name="place" size={40} color="red" />
        </View>
        {/* Locate Button */}
        <TouchableOpacity
          style={styles.locateBtn}
          onPress={centerMap}
        >
          <Icon name="my-location" size={24} color="#1f6ea7" />
        </TouchableOpacity>
      </View>

      {/* OPTIONS */}
      <View style={styles.options}>
        

        <TouchableOpacity style={styles.optionRow} onPress={sendCurrent}>
          <Icon name="radio-button-checked" size={24} color="#1f6ea7" />
          <Text style={styles.optionText}>Send your current location</Text>
        </TouchableOpacity>
      </View>

    
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    height: 56,
    backgroundColor: '#1f6ea7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  fullscreenBtn: { padding: 8 },
  title: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    fontWeight: '600',
  },
  iconBtn: { padding: 8 },

  mapContainer: {
    width: '100%',
    backgroundColor: '#eee',
  },
  markerFixed: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -40,
  },
  locateBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 24,
    elevation: 3,
  },

  options: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: '#ddd',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  optionText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },

  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    paddingTop: 16,
    paddingBottom: 62,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  modalTitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 12,
    color: '#333',
  },
  previewRow: {
    fontSize: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewText: {
    fontSize: 24,
    marginHorizontal: 4,
    color: '#000',          // ensure the colon is black
  },
  unit: {
    fontSize: 16,
    marginLeft: 8,
    color: '#333',
  },
  okBtn: {
    marginTop: 16,
    alignSelf: 'center',
    backgroundColor: '#1f6ea7',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 24,
  },
  okText: {
    color: '#fff',
    fontSize: 16,
  },
});

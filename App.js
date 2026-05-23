import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  Button,
  ActivityIndicator,
  FlatList,
  StyleSheet,
} from 'react-native';
import * as Location from 'expo-location';

// Weather code -> readable label
function weatherLabel(code) {
  if (code === 0) return 'Clear sky';
  if (code <= 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code <= 67) return 'Rain / Drizzle';
  if (code <= 77) return 'Snow';
  if (code <= 99) return 'Thunderstorm';
  return 'Unknown';
}

export default function App() {
  const [coords, setCoords] = useState(null);
  const [weather, setWeather] = useState(null);
  const [places, setPlaces] = useState([]);

  const [loading, setLoading] = useState(false);
  const [permError, setPermError] = useState('');
  const [wError, setWError] = useState('');
  const [pError, setPError] = useState('');

  // 1. Read device location
  async function readLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('denied');
    }
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return pos.coords;
  }

  // 2. Fetch current weather from Open-Meteo
  async function fetchWeather(lat, lon) {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}` +
      `&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code` +
      `&timezone=auto`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather API error');
    const data = await res.json();
    if (!data.current) throw new Error('No weather data');
    return data.current;
  }

  // 3. Fetch nearby Wikipedia articles
  async function fetchPlaces(lat, lon) {
    const url =
      `https://en.wikipedia.org/w/api.php` +
      `?action=query` +
      `&list=geosearch` +
      `&gscoord=${lat}|${lon}` +
      `&gsradius=10000` +
      `&gslimit=20` +
      `&format=json` +
      `&origin=*`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Wikipedia API error');
    const data = await res.json();
    return data.query?.geosearch || [];
  }

  // Main handler: location -> weather + places in parallel
  async function handleFetch() {
    setLoading(true);
    setCoords(null);
    setWeather(null);
    setPlaces([]);
    setPermError('');
    setWError('');
    setPError('');

    try {
      const c = await readLocation();
      setCoords(c);

      const [w, p] = await Promise.allSettled([
        fetchWeather(c.latitude, c.longitude),
        fetchPlaces(c.latitude, c.longitude),
      ]);

      if (w.status === 'fulfilled') setWeather(w.value);
      else setWError('Could not load weather data.');

      if (p.status === 'fulfilled') setPlaces(p.value);
      else setPError('Could not load nearby places.');

    } catch (err) {
      if (err.message === 'denied') {
        setPermError('Location permission was denied.');
      } else {
        setPermError('Could not read device location.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>

        <Text style={s.appTitle}>Location + Weather + Places</Text>
        <Button title="Get my location" onPress={handleFetch} />

        {loading && (
          <View style={s.center}>
            <ActivityIndicator size="large" style={{ marginTop: 24 }} />
            <Text style={s.muted}>Loading...</Text>
          </View>
        )}

        {permError !== '' && <Text style={s.error}>{permError}</Text>}

        {/* Section 1: Location */}
        {coords && (
          <View style={s.card}>
            <Text style={s.sectionTitle}>My Location</Text>
            <Row label="Latitude"  value={coords.latitude.toFixed(6)} />
            <Row label="Longitude" value={coords.longitude.toFixed(6)} />
            <Row label="Accuracy"  value={`${Math.round(coords.accuracy)} m`} />
          </View>
        )}

        {/* Section 2: Weather */}
        {coords && (
          <View style={s.card}>
            <Text style={s.sectionTitle}>Current Weather</Text>
            {wError !== '' && <Text style={s.error}>{wError}</Text>}
            {weather && (
              <>
                <Row label="Condition"
                     value={weatherLabel(weather.weather_code)} />
                <Row label="Temperature"
                     value={`${weather.temperature_2m} °C`} />
                <Row label="Humidity"
                     value={`${weather.relative_humidity_2m} %`} />
                <Row label="Wind speed"
                     value={`${weather.wind_speed_10m} km/h`} />
              </>
            )}
          </View>
        )}

        {/* Section 3: Nearby Wikipedia articles */}
        {coords && (
          <View style={s.card}>
            <Text style={s.sectionTitle}>Nearby Wikipedia Articles</Text>
            {pError !== '' && <Text style={s.error}>{pError}</Text>}
            {places.length === 0 && pError === '' && !loading && (
              <Text style={s.muted}>No nearby articles found.</Text>
            )}
            <FlatList
              data={places}
              keyExtractor={(item) => String(item.pageid)}
              scrollEnabled={false}
              renderItem={({ item, index }) => (
                <View style={s.placeItem}>
                  <Text style={s.placeIndex}>{index + 1}</Text>
                  <View style={s.placeInfo}>
                    <Text style={s.placeTitle}>{item.title}</Text>
                    <Text style={s.placeMeta}>
                      {item.dist} m away · {item.lat.toFixed(4)}, {item.lon.toFixed(4)}
                    </Text>
                  </View>
                </View>
              )}
            />
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    color: '#111',
  },
  center: {
    alignItems: 'center',
    marginTop: 12,
  },
  muted: {
    marginTop: 8,
    color: '#888',
    fontSize: 14,
  },
  error: {
    marginTop: 12,
    color: '#cc0000',
    fontSize: 14,
  },
  card: {
    marginTop: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
    color: '#333',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  label: {
    fontSize: 14,
    color: '#555',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  placeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  placeIndex: {
    width: 24,
    fontSize: 13,
    color: '#aaa',
    marginTop: 2,
  },
  placeInfo: {
    flex: 1,
  },
  placeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
  },
  placeMeta: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
});

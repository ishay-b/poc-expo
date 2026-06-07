import { useState, useRef } from 'react';
import { Platform, StyleSheet, View, ActivityIndicator, Text, TouchableOpacity, TextInput, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewErrorEvent } from 'react-native-webview/lib/WebViewTypes';
import { File, Paths } from 'expo-file-system';
import Constants from 'expo-constants';

const CONFIG_FILENAME = 'config.json';
const DEFAULT_URL = (Constants.expoConfig?.extra?.url as string | undefined) || 'https://google.com';

interface AppConfig {
  url: string;
}

function readConfig(): string {
  if (Platform.OS === 'web') {
    try {
      const raw = localStorage.getItem('appConfig');
      if (raw) {
        const config: AppConfig = JSON.parse(raw);
        if (typeof config.url === 'string' && config.url.length > 0) return config.url;
      }
    } catch {}
    return DEFAULT_URL;
  }
  const file = new File(Paths.document, CONFIG_FILENAME);
  if (file.exists) {
    try {
      const raw = file.textSync();
      console.log('[config] file contents:', raw);
      const config: AppConfig = JSON.parse(raw);
      if (typeof config.url === 'string' && config.url.length > 0) {
        console.log('[config] loading URL:', config.url);
        return config.url;
      }
    } catch (e) {
      console.log('[config] parse error:', e);
    }
  } else {
    console.log('[config] no config file found, using default');
  }
  const defaultConfig: AppConfig = { url: DEFAULT_URL };
  file.create();
  file.write(JSON.stringify(defaultConfig, null, 2));
  return DEFAULT_URL;
}

function writeConfig(url: string) {
  if (Platform.OS === 'web') {
    localStorage.setItem('appConfig', JSON.stringify({ url }));
    return;
  }
  const file = new File(Paths.document, CONFIG_FILENAME);
  if (!file.exists) file.create();
  file.write(JSON.stringify({ url }, null, 2));
}

export default function HomeScreen() {
  const [url, setUrl] = useState<string>(readConfig);
  const [error, setError] = useState<string | null>(null);
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const webViewRef = useRef<WebView>(null);

  function handleError(event: WebViewErrorEvent) {
    const { code, description } = event.nativeEvent;
    setError(`שגיאת חיבור (${code})\n${description}`);
  }

  function handleRetry() {
    setError(null);
    webViewRef.current?.reload();
  }

  function handleChangeUrl() {
    setUrlInput(url);
    setEditingUrl(true);
  }

  function handleSaveUrl() {
    const trimmed = urlInput.trim();
    if (!trimmed.startsWith('http')) {
      Alert.alert('כתובת לא תקינה', 'הכתובת חייבת להתחיל ב-http:// או https://');
      return;
    }
    writeConfig(trimmed);
    setUrl(trimmed);
    setEditingUrl(false);
    setError(null);
  }

  if (editingUrl) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>שנה כתובת שרת</Text>
        <TextInput
          style={styles.urlInput}
          value={urlInput}
          onChangeText={setUrlInput}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="https://..."
        />
        <View style={styles.row}>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setEditingUrl(false)}>
            <Text style={styles.secondaryText}>ביטול</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.retryButton} onPress={handleSaveUrl}>
            <Text style={styles.retryText}>שמור וטען</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>לא ניתן לטעון את הדף</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <Text style={styles.debugUrl}>URL: {url}</Text>
        {error.includes('SSL') || error.includes('certificate') ? (
          <Text style={styles.sslHint}>
            אם השרת משתמש בתעודת SSL פרטית, יש להתקין אותה במכשיר דרך הגדרות &gt; אבטחה &gt; התקן תעודה
          </Text>
        ) : null}
        <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
          <Text style={styles.retryText}>נסה שוב</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleChangeUrl}>
          <Text style={styles.secondaryText}>שנה כתובת</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View style={styles.webview}>
        {/* @ts-ignore - iframe is a valid web element */}
        <iframe
          src={url}
          style={{ flex: 1, border: 'none', width: '100%', height: '100%' }}
          title="app-frame"
        />
        <TouchableOpacity style={styles.webChangeUrl} onPress={handleChangeUrl}>
          <Text style={styles.webChangeUrlText}>שנה כתובת</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <WebView
      ref={webViewRef}
      style={styles.webview}
      source={{ uri: url }}
      renderLoading={() => (
        <View style={styles.loader}>
          <ActivityIndicator size="large" />
        </View>
      )}
      startInLoadingState
      onError={handleError}
      onHttpError={(event) => {
        const { statusCode } = event.nativeEvent;
        if (statusCode >= 500) {
          setError(`שגיאת שרת (${statusCode})`);
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  debugUrl: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
  },
  sslHint: {
    fontSize: 13,
    color: '#444',
    textAlign: 'center',
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 8,
  },
  urlInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#E5E5EA',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  secondaryText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  webChangeUrl: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  webChangeUrlText: {
    color: '#fff',
    fontSize: 14,
  },
});

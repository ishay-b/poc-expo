import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const PUSH_TOKEN_STORAGE_KEY = 'push_token';

// קובע איך האפליקציה תתנהג כשמגיעה התראה בזמן שהאפליקציה פתוחה (foreground):
// shouldShowAlert – תציג את ה-banner של ההתראה
// shouldPlaySound – תנגן צליל
// shouldSetBadge – לא תעדכן את המספר על האייקון
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// onNotificationTapped – callback אופציונלי שיופעל כשמשתמש לוחץ על התראה.
// אם ה-data של ההתראה מכיל url – יועבר ה-url ל-callback (לניווט ב-WebView).
export function usePushNotifications(onNotificationTapped?: (url: string) => void) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // שלב 1: מקבל token (מה-AsyncStorage אם קיים, אחרת מ-Expo)
    registerForPushNotificationsAsync().then(token => {
      if (token) setExpoPushToken(token);
    });

    // שלב 2: מאזין ללחיצות על התראות (גם כשהאפליקציה ברקע/סגורה)
    // כשמשתמש לוחץ על התראה – בודק אם יש url ב-data ומפעיל את ה-callback
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const url = response.notification.request.content.data?.url as string | undefined;
      if (url && onNotificationTapped) {
        onNotificationTapped(url);
      }
    });

    // ניקוי ה-listener כשהקומפוננטה מתפרקת
    return () => {
      responseListener.current?.remove();
    };
  }, []);

  // מחזיר את ה-token כדי שניתן להזריק אותו ל-WebView
  return { expoPushToken };
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  // push notifications לא רלוונטי לדפדפן
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;

  // אם כבר קיבלנו token בעבר – מחזיר אותו מיידית בלי לפנות לשרתי Expo
  const cached = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  if (cached) {
    console.log('[push] token from cache:', cached);
    return cached;
  }

  // יוצר notification channel באנדרואיד – ערוץ שדרכו כל ההתראות של האפליקציה יישלחו.
  // MAX importance = מופיע כ-heads-up (banner צף) עם צליל ורטט
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  // בודק אם כבר יש הרשאה, ואם לא – מבקש מהמשתמש
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.warn('[push] permission not granted');
    return null;
  }

  // projectId מגיע מ-app.json → extra.eas.projectId
  // הוא מזהה את האפליקציה שלנו בשרתי Expo
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.warn('[push] projectId missing from app config');
    return null;
  }

  try {
    // מקבל מ-Expo token ייחודי למכשיר הזה + לאפליקציה הזו.
    // נראה כך: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
    // השרת שלנו ישתמש בו כדי לשלוח התראות למכשיר הספציפי
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    console.log('[push] token (new):', token);

    // שומר ב-AsyncStorage כדי שבפתיחות הבאות לא יהיה צורך לפנות לשרתי Expo
    await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
    return token;
  } catch (e) {
    console.warn('[push] failed to get token:', e);
    return null;
  }
}

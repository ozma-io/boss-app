import 'expo-router/entry';
import messaging from '@react-native-firebase/messaging';

// Register background handler for FCM
// This will be called when app is in background or killed state
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('Message handled in the background!', remoteMessage);
  // Background messages are automatically shown by the OS
  // No need to show notification manually
});


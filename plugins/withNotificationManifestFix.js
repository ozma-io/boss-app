const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin to fix Android manifest conflict between expo-notifications and @react-native-firebase/messaging
 * Both packages define com.google.firebase.messaging.default_notification_color meta-data
 * This plugin adds tools:replace attribute to use our app's value instead of the library's default
 * 
 * Uses both withAndroidManifest (for tools namespace) and withDangerousMod (for meta-data modification)
 * because meta-data is added AFTER withAndroidManifest mods run
 * Must be placed AFTER expo-notifications in the plugins array
 */
function withNotificationManifestFix(config) {
  // Step 1: Add tools namespace using withAndroidManifest
  config = withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;

    // Add tools namespace to manifest root if not present
    if (!androidManifest.manifest.$) {
      androidManifest.manifest.$ = {};
    }
    
    if (!androidManifest.manifest.$['xmlns:tools']) {
      androidManifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    return config;
  });

  // Step 2: Add tools:replace to meta-data using dangerousMod (runs after all withAndroidManifest)
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const manifestPath = path.join(
        config.modRequest.platformProjectRoot,
        'app/src/main/AndroidManifest.xml'
      );
      
      if (!fs.existsSync(manifestPath)) {
        return config;
      }

      let contents = fs.readFileSync(manifestPath, 'utf-8');

      // Add tools:replace to notification color meta-data
      // This tells Android to use our app's color value instead of the library's default
      contents = contents.replace(
        /(<meta-data\s+android:name="com\.google\.firebase\.messaging\.default_notification_color"\s+android:resource="@color\/notification_icon_color")(\/?>)/,
        '$1 tools:replace="android:resource"$2'
      );

      fs.writeFileSync(manifestPath, contents);

      return config;
    },
  ]);

  return config;
}

module.exports = withNotificationManifestFix;


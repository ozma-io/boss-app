const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin to automatically modify iOS Podfile for Firebase compatibility.
 * 
 * This plugin adds:
 * 1. Explicit Firebase pods with modular_headers enabled
 * 2. Post-install script to enable DEFINES_MODULE for Firebase dependencies
 * 
 * These modifications are required for Swift Firebase pods to work properly
 * with React Native as static libraries.
 */
const withFirebasePodfile = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf-8');

      // Add explicit Firebase pods with modular_headers after config = use_native_modules!
      const firebasePodsSnippet = `
  # Enable modular headers for Firebase dependencies
  # Required for Swift Firebase pods to work as static libraries
  pod 'FirebaseCore', :modular_headers => true
  pod 'FirebaseABTesting', :modular_headers => true
  pod 'FirebaseInstallations', :modular_headers => true
  pod 'GoogleUtilities', :modular_headers => true
`;

      // Only add if not already present
      if (!contents.includes("pod 'FirebaseCore', :modular_headers => true")) {
        // Insert after use_native_modules! line
        contents = contents.replace(
          /config = use_native_modules!\(.*?\)/s,
          (match) => `${match}\n  ${firebasePodsSnippet.trim()}`
        );
      }

      // Add post_install modifications for Firebase modular headers
      const postInstallSnippet = `
    # Enable modular headers for Firebase pods and their dependencies
    # Required for Swift Firebase pods to work with React Native
    firebase_dependencies = [
      'Firebase',
      'Google',
      'nanopb',
      'leveldb-library',
      'Promises'
    ]
    
    installer.pods_project.targets.each do |target|
      should_enable_modular = firebase_dependencies.any? { |dep| target.name.start_with?(dep) }
      
      if should_enable_modular
        target.build_configurations.each do |config|
          config.build_settings['DEFINES_MODULE'] = 'YES'
        end
      end
    end
`;

      // Only add if not already present
      if (!contents.includes("config.build_settings['DEFINES_MODULE'] = 'YES'")) {
        // Insert after react_native_post_install call, before the closing 'end'
        contents = contents.replace(
          /(react_native_post_install\([^)]+\s+\))/s,
          (match) => `${match}\n    ${postInstallSnippet.trim()}`
        );
      }

      fs.writeFileSync(podfilePath, contents);
      return config;
    },
  ]);
};

module.exports = withFirebasePodfile;


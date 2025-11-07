import React from 'react';
import { StyleSheet } from 'react-native';

import { ExternalLink } from './ExternalLink';
import { MonoText } from './StyledText';
import { Text, View } from './Themed';

import Colors from '@/constants/Colors';

export default function EditScreenInfo({ path, testID }: { path: string; testID?: string }) {
  return (
    <View testID={testID || 'edit-screen-info'}>
      <View style={styles.getStartedContainer} testID={testID ? `${testID}-get-started-container` : 'edit-screen-info-get-started-container'}>
        <Text
          style={styles.getStartedText}
          lightColor="rgba(0,0,0,0.8)"
          darkColor="rgba(255,255,255,0.8)"
          testID={testID ? `${testID}-instruction-text` : 'edit-screen-info-instruction-text'}>
          Open up the code for this screen:
        </Text>

        <View
          style={[styles.codeHighlightContainer, styles.homeScreenFilename]}
          darkColor="rgba(255,255,255,0.05)"
          lightColor="rgba(0,0,0,0.05)"
          testID={testID ? `${testID}-code-highlight` : 'edit-screen-info-code-highlight'}>
          <MonoText testID={testID ? `${testID}-path-text` : 'edit-screen-info-path-text'}>{path}</MonoText>
        </View>

        <Text
          style={styles.getStartedText}
          lightColor="rgba(0,0,0,0.8)"
          darkColor="rgba(255,255,255,0.8)"
          testID={testID ? `${testID}-update-text` : 'edit-screen-info-update-text'}>
          Change any of the text, save the file, and your app will automatically update.
        </Text>
      </View>

      <View style={styles.helpContainer} testID={testID ? `${testID}-help-container` : 'edit-screen-info-help-container'}>
        <ExternalLink
          style={styles.helpLink}
          href="https://docs.expo.io/get-started/create-a-new-app/#opening-the-app-on-your-phonetablet"
          testID={testID ? `${testID}-help-link` : 'edit-screen-info-help-link'}>
          <Text style={styles.helpLinkText} lightColor={Colors.light.tint} testID={testID ? `${testID}-help-link-text` : 'edit-screen-info-help-link-text'}>
            Tap here if your app doesn't automatically update after making changes
          </Text>
        </ExternalLink>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  getStartedContainer: {
    alignItems: 'center',
    marginHorizontal: 50,
  },
  homeScreenFilename: {
    marginVertical: 7,
  },
  codeHighlightContainer: {
    borderRadius: 3,
    paddingHorizontal: 4,
  },
  getStartedText: {
    fontSize: 17,
    lineHeight: 24,
    textAlign: 'center',
  },
  helpContainer: {
    marginTop: 15,
    marginHorizontal: 20,
    alignItems: 'center',
  },
  helpLink: {
    paddingVertical: 15,
  },
  helpLinkText: {
    textAlign: 'center',
  },
});

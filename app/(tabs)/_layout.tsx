import { BriefcaseIcon } from '@/components/icons/BriefcaseIcon';
import { ProfileIcon } from '@/components/icons/ProfileIcon';
import { TimelineIcon } from '@/components/icons/TimelineIcon';
import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        tabBarItemStyle: styles.tabBarItem,
        tabBarIconStyle: styles.tabBarIconStyle,
      }}>
      <Tabs.Screen
        name="about-boss"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItem}>
              <BriefcaseIcon color="#000000" opacity={focused ? 1 : 0.5} />
              <Text style={[styles.tabLabel, { opacity: focused ? 1 : 0.5 }]}>
                Boss
              </Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="timeline"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItem}>
              <TimelineIcon color="#000000" opacity={focused ? 1 : 0.5} />
              <Text style={[styles.tabLabel, { opacity: focused ? 1 : 0.5 }]}>
                Timeline
              </Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItem}>
              <ProfileIcon color="#000000" opacity={focused ? 1 : 0.5} />
              <Text style={[styles.tabLabel, { opacity: focused ? 1 : 0.5 }]}>
                Profile
              </Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 90,
    paddingTop: 0,
    paddingBottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  tabBarItem: {
    paddingTop: 0,
  },
  tabBarIconStyle: {
    height: 78,
    width: 80,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 12,
    height: 78,
    width: 80,
  },
  tabLabel: {
    marginTop: 8,
    fontSize: 12,
    color: '#000000',
    fontFamily: 'Manrope-Regular',
  },
});

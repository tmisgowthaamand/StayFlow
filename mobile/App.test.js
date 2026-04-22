import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.text}>✅ Expo is Working!</Text>
      <Text style={styles.subtext}>If you see this, the connection is successful.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#7C3AED',
    marginBottom: 10,
  },
  subtext: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
  },
});

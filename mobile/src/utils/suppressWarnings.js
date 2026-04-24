// Suppress expo-notifications Expo Go SDK 53+ warning
// This file must be imported BEFORE expo-notifications
const _originalConsoleError = console.error;
console.error = (...args) => {
  const msg = typeof args[0] === 'string' ? args[0] : '';
  if (msg.includes('expo-notifications') && msg.includes('Expo Go')) return;
  _originalConsoleError(...args);
};

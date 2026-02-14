import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, Typography, BorderRadius, Gradients, Shadows } from '../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Lock, User, ArrowRight, Zap } from 'lucide-react-native';
import { useLanguage } from '../context/LanguageContext';

const Login = () => {
    const navigation = useNavigation();
    const { t } = useLanguage();
    const [username, setUsername] = useState('admin');
    const [password, setPassword] = useState('admin');
    const [loading, setLoading] = useState(false);

    const handleLogin = () => {
        if (!username || !password) {
            Alert.alert(t('error'), t('invalid_credentials'));
            return;
        }

        setLoading(true);
        // Check for stored password, default to 'admin'
        setTimeout(async () => {
            setLoading(false);
            try {
                const storedPassword = await AsyncStorage.getItem('userPassword') || 'admin';
                const storedUsername = await AsyncStorage.getItem('userLoginName') || 'admin';

                if (username.trim() === storedUsername && password.trim() === storedPassword) {
                    await AsyncStorage.setItem('userToken', 'dummy-auth-token');
                    navigation.replace('Main');
                } else {
                    Alert.alert(t('login_failed'), t('invalid_credentials'));
                }
            } catch (e) {
                Alert.alert("Error", "Failed to access login data");
            }
        }, 1500);
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
            <LinearGradient colors={[Colors.background, '#0f172a']} style={styles.gradient}>
                <View style={styles.content}>
                    <View style={styles.header}>
                        <View style={styles.logoContainer}>
                            <Image
                                source={require('../../assets/icon.png')}
                                style={styles.brandImage}
                                resizeMode="contain"
                            />
                            <View style={styles.logoOverlay}>
                                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.3)']} style={styles.logoShadow} />
                            </View>
                        </View>
                        <View style={styles.titleWrapper}>
                            <Text style={styles.title}>{t('welcome_back')}</Text>
                            <View style={styles.brandBadge}>
                                <Text style={styles.brandBadgeText}>Official Brand</Text>
                            </View>
                        </View>
                        <Text style={styles.subtitle}>{t('sign_in_subtitle')}</Text>
                    </View>

                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>{t('username')}</Text>
                            <View style={styles.inputContainer}>
                                <User size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder={t('username')}
                                    placeholderTextColor={Colors.textMuted}
                                    value={username}
                                    onChangeText={setUsername}
                                    autoCapitalize="none"
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>{t('password')}</Text>
                            <View style={styles.inputContainer}>
                                <Lock size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder={t('password')}
                                    placeholderTextColor={Colors.textMuted}
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry
                                />
                            </View>
                        </View>

                        <TouchableOpacity onPress={handleLogin} disabled={loading} activeOpacity={0.8} style={styles.loginBtnWrapper}>
                            <LinearGradient colors={Gradients.primary} style={styles.loginBtn}>
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <>
                                        <Text style={styles.btnText}>{t('sign_in')}</Text>
                                        <ArrowRight size={20} color="#fff" />
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </LinearGradient>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    gradient: { flex: 1, justifyContent: 'center', padding: Spacing.xl },
    content: { width: '100%', maxWidth: 400, alignSelf: 'center' },

    header: { alignItems: 'center', marginBottom: 40 },
    logoContainer: {
        width: 100,
        height: 100,
        borderRadius: 30,
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 15,
        marginBottom: 25,
        position: 'relative',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        ...Shadows.glow(Colors.primary, 0.3)
    },
    brandImage: {
        width: '100%',
        height: '100%',
    },
    logoOverlay: { ...StyleSheet.absoluteFillObject },
    logoShadow: { flex: 1 },
    titleWrapper: { alignItems: 'center', marginBottom: 5 },
    brandBadge: {
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        marginTop: 4,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    brandBadgeText: {
        ...Typography.tiny,
        color: '#10b981',
        fontWeight: '900',
        fontSize: 10,
        letterSpacing: 1,
        textTransform: 'uppercase'
    },
    title: { ...Typography.h1, color: Colors.text, marginBottom: 2, textAlign: 'center' },
    subtitle: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },

    form: { gap: 20 },
    inputGroup: { gap: 8 },
    label: { ...Typography.tiny, color: Colors.textMuted, marginLeft: 4 },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.backgroundAlt,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        height: 56,
        paddingHorizontal: 16
    },
    inputIcon: { marginRight: 12 },
    input: { flex: 1, color: Colors.text, ...Typography.body, height: '100%' },

    loginBtnWrapper: { marginTop: 10, ...Shadows.glow(Colors.primary, 0.4) },
    loginBtn: {
        height: 56,
        borderRadius: BorderRadius.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12
    },
    btnText: { ...Typography.bodyBold, color: '#fff', fontSize: 16 },

    footer: { alignItems: 'center', marginTop: 30 },
    footerText: { ...Typography.tiny, color: Colors.textMuted, opacity: 0.6 }
});

export default Login;

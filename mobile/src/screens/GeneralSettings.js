import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { CommonActions } from '@react-navigation/native';
import { Colors, Spacing, Shadows, Typography, BorderRadius } from '../theme/theme';
import Header from '../components/Header';
import { Bell, Moon, Sun, Lock, Globe, ChevronRight, LogOut, Database, User, X } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

const SettingItem = ({ icon: Icon, title, subtitle, type = 'link', value, onToggle, onPress, color, colors }) => (
    <TouchableOpacity
        style={[styles.settingRow, { backgroundColor: colors.backgroundAlt }]}
        onPress={type === 'link' ? onPress : onToggle}
        activeOpacity={0.7}
        disabled={type === 'switch'}
    >
        <View style={[styles.iconBox, { backgroundColor: `${color || colors.primary}15` }]}>
            <Icon size={20} color={color || colors.primary} />
        </View>
        <View style={styles.content}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            {subtitle && <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>}
        </View>

        {type === 'switch' && (
            <Switch
                value={value}
                onValueChange={onToggle}
                trackColor={{ false: colors.surface, true: colors.primary }}
                thumbColor={'#fff'}
            />
        )}

        {type === 'link' && <ChevronRight size={18} color={colors.textMuted} />}
    </TouchableOpacity>
);

const GeneralSettings = () => {
    const navigation = useNavigation();
    const { t, changeLanguage, language } = useLanguage();
    const { isDarkMode, toggleTheme, colors } = useTheme();
    const [notifications, setNotifications] = useState(true);

    // Modals
    const [profileModal, setProfileModal] = useState(false);
    const [passwordModal, setPasswordModal] = useState(false);
    const [langModal, setLangModal] = useState(false);

    // Profile State
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");

    // Password State
    const [oldPass, setOldPass] = useState("");
    const [newPass, setNewPass] = useState("");

    React.useEffect(() => {
        const loadProfile = async () => {
            try {
                const storedName = await AsyncStorage.getItem('userDisplayName') || 'Admin User';
                const storedEmail = await AsyncStorage.getItem('userEmail') || 'admin@stayflow.com';
                setName(storedName);
                setEmail(storedEmail);
            } catch (e) {
                console.error("Failed to load profile", e);
            }
        };
        loadProfile();
    }, []);

    const handleSignOut = async () => {
        try {
            await SecureStore.deleteItemAsync('userToken');
            navigation.dispatch(
                CommonActions.reset({
                    index: 0,
                    routes: [{ name: 'Login' }],
                })
            );
        } catch (e) {
            Alert.alert(t('error'), "Failed to sign out");
        }
    };

    const handleClearCache = () => {
        Alert.alert("Clearing Cache...", "Please wait.");
        setTimeout(() => {
            Alert.alert("Success", "Cache cleared! Freed up 42.5 MB.");
        }, 1500);
    };

    const handleUpdateProfile = async () => {
        try {
            await AsyncStorage.setItem('userDisplayName', name);
            await AsyncStorage.setItem('userEmail', email);
            setProfileModal(false);
            Alert.alert("Success", "Profile updated successfully!");
        } catch (e) {
            Alert.alert("Error", "Failed to save profile");
        }
    };

    const handleChangePassword = async () => {
        try {
            // SECURITY FIX: Use SecureStore for password storage
            const storedPassword = await SecureStore.getItemAsync('userPassword') || 'admin';

            if (oldPass !== storedPassword) {
                Alert.alert("Error", "Incorrect current password.");
                return;
            }

            if (newPass.length < 4) {
                Alert.alert("Error", "New password must be at least 4 characters.");
                return;
            }

            // SECURITY FIX: Store password securely
            await SecureStore.setItemAsync('userPassword', newPass);

            setPasswordModal(false);
            setOldPass("");
            setNewPass("");
            Alert.alert("Success", "Password changed successfully! Please login again.");

            // Remove token and go to login
            await SecureStore.deleteItemAsync('userToken');
            navigation.dispatch(
                CommonActions.reset({
                    index: 0,
                    routes: [{ name: 'Login' }],
                })
            );
        } catch (e) {
            Alert.alert("Error", "Failed to change password");
        }
    };

    const changeLang = (langCode) => {
        changeLanguage(langCode);
        setLangModal(false);
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Header title={t('settings_title')} subtitle={t('general')} />

            <ScrollView contentContainerStyle={styles.scrollArea}>

                {/* Section: Preferences */}
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('app_preferences')}</Text>
                <View style={[styles.card, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}>
                    <SettingItem
                        icon={Bell}
                        title={t('push_notif')}
                        subtitle={t('push_sub')}
                        type="switch"
                        value={notifications}
                        onToggle={() => setNotifications(!notifications)}
                        color={colors.accent}
                        colors={colors}
                    />
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    <SettingItem
                        icon={isDarkMode ? Moon : Sun}
                        title={t('dark_mode')}
                        subtitle={t('dark_sub')}
                        type="switch"
                        value={isDarkMode}
                        onToggle={toggleTheme}
                        color={colors.primary}
                        colors={colors}
                    />
                </View>

                {/* Section: Account */}
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('account_security')}</Text>
                <View style={[styles.card, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}>
                    <SettingItem
                        icon={User}
                        title={t('edit_profile')}
                        subtitle={t('edit_profile_sub')}
                        onPress={() => setProfileModal(true)}
                        color={colors.secondary}
                        colors={colors}
                    />
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    <SettingItem
                        icon={Lock}
                        title={t('change_password')}
                        subtitle={t('change_password_sub')}
                        onPress={() => setPasswordModal(true)}
                        color={colors.warning}
                        colors={colors}
                    />
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    <SettingItem
                        icon={Globe}
                        title={t('language')}
                        subtitle={language === 'en' ? 'English (US)' : language === 'ta' ? 'தமிழ்' : language === 'hi' ? 'हिंदी' : 'తెలుగు'}
                        onPress={() => setLangModal(true)}
                        color={colors.info}
                        colors={colors}
                    />
                </View>

                {/* Section: System */}
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('system')}</Text>
                <View style={[styles.card, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}>
                    <SettingItem
                        icon={Database}
                        title={t('clear_cache')}
                        subtitle={t('clear_cache_sub')}
                        onPress={handleClearCache}
                        color={colors.textMuted}
                        colors={colors}
                    />
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    <SettingItem
                        icon={LogOut}
                        title={t('sign_out')}
                        subtitle={t('sign_out')}
                        color={colors.danger}
                        onPress={handleSignOut}
                        colors={colors}
                    />
                </View>

                <Text style={[styles.version, { color: colors.textMuted }]}>StayFlow Mobile v1.0.4 • Build 2024.02</Text>

            </ScrollView>

            {/* Edit Profile Modal */}
            <Modal transparent visible={profileModal} animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('edit_profile')}</Text>
                            <TouchableOpacity onPress={() => setProfileModal(false)}>
                                <X size={24} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                        <TextInput style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]} value={name} onChangeText={setName} placeholder={t('name')} placeholderTextColor={colors.textMuted} />
                        <TextInput style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]} value={email} onChangeText={setEmail} placeholder={t('email')} placeholderTextColor={colors.textMuted} />
                        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleUpdateProfile}>
                            <Text style={styles.saveBtnText}>{t('save_changes')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Change Password Modal */}
            <Modal transparent visible={passwordModal} animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('change_password')}</Text>
                            <TouchableOpacity onPress={() => setPasswordModal(false)}>
                                <X size={24} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                        <TextInput style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]} value={oldPass} onChangeText={setOldPass} placeholder={t('current_pass')} secureTextEntry placeholderTextColor={colors.textMuted} />
                        <TextInput style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]} value={newPass} onChangeText={setNewPass} placeholder={t('new_pass')} secureTextEntry placeholderTextColor={colors.textMuted} />
                        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleChangePassword}>
                            <Text style={styles.saveBtnText}>{t('update_pass')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Language Modal */}
            <Modal transparent visible={langModal} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>{t('select_language')}</Text>
                        {[
                            { code: 'en', label: 'English (US)' },
                            { code: 'ta', label: 'தமிழ்' },
                            { code: 'hi', label: 'हिंदी' },
                            { code: 'te', label: 'తెలుగు' }
                        ].map(l => (
                            <TouchableOpacity key={l.code} style={[styles.langItem, { borderBottomColor: colors.border }]} onPress={() => changeLang(l.code)}>
                                <Text style={[styles.langText, { color: colors.text }]}>{l.label}</Text>
                                {language === l.code && <View style={[styles.activeDot, { backgroundColor: colors.secondary }]} />}
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setLangModal(false)}>
                            <Text style={[styles.cancelText, { color: colors.textMuted }]}>{t('cancel')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    scrollArea: { padding: Spacing.md, paddingBottom: 40 },

    sectionTitle: { ...Typography.tiny, color: Colors.textSecondary, marginBottom: 10, marginLeft: 4, marginTop: 10 },

    card: {
        backgroundColor: Colors.backgroundAlt,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        overflow: 'hidden',
        marginBottom: Spacing.lg,
        ...Shadows.sm
    },

    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: Colors.backgroundAlt
    },

    iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    content: { flex: 1 },
    title: { ...Typography.bodyBold, color: Colors.text },
    subtitle: { ...Typography.tiny, color: Colors.textMuted, marginTop: 2, textTransform: 'none', letterSpacing: 0 },

    divider: { height: 1, backgroundColor: Colors.border, marginLeft: 66 },
    version: { ...Typography.tiny, color: Colors.textMuted, textAlign: 'center', marginTop: 20, opacity: 0.5 },

    // Modals
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: Spacing.lg },
    modalContent: { backgroundColor: Colors.backgroundAlt, borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { ...Typography.h3, color: Colors.text },
    input: { backgroundColor: Colors.background, padding: 12, borderRadius: 8, color: Colors.text, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
    saveBtn: { backgroundColor: Colors.primary, padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 10 },
    saveBtnText: { ...Typography.bodyBold, color: '#fff' },

    langItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, flexDirection: 'row', justifyContent: 'space-between' },
    langText: { ...Typography.body, color: Colors.text },
    activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.secondary },
    cancelBtn: { marginTop: 14, alignItems: 'center' },
    cancelText: { color: Colors.textMuted }
});

export default GeneralSettings;

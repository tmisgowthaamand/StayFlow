import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Animated, Easing as RNEasing } from 'react-native';
import { Colors, Spacing, Shadows, Typography, BorderRadius, Gradients } from '../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import { addTenant } from '../api/api';
import { UserPlus, Save, User, Phone, Home } from 'lucide-react-native';
import { useFadeSlideIn, usePressAnimation } from '../utils/animations';
import { notifyNewRegistration } from '../utils/notifications';
import { useLanguage } from '../context/LanguageContext';

const AddTenant = ({ navigation }) => {
    const [formData, setFormData] = useState({ name: '', phone: '', room: '', sharingType: '3', advance: '0', rent: '0' });
    const [loading, setLoading] = useState(false);
    const { t } = useLanguage();

    // Animations
    const cardAnim = useFadeSlideIn(80, 500, 28);
    const { scaleStyle: submitPress, onPressIn: submitIn, onPressOut: submitOut } = usePressAnimation(0.95);

    const handleChange = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));

    const handleSubmit = async () => {
        if (!formData.name || !formData.phone || !formData.room || !formData.rent) {
            Alert.alert(t('error'), t('incomplete_form'));
            return;
        }
        try {
            setLoading(true);
            await addTenant({ ...formData, monthlyRent: formData.rent });
            await notifyNewRegistration(formData.name, formData.room, formData.phone);
            Alert.alert(t('success'), `${formData.name} ${t('resident_added')} ${formData.room}`, [
                { text: t('view_residents'), onPress: () => navigation.navigate('Residents') }
            ]);
        } catch (e) {
            Alert.alert(t('error'), t('failed_register'));
        } finally { setLoading(false); }
    };

    const renderField = (label, key, options = {}) => (
        <View style={[styles.fieldGroup, options.halfWidth && { flex: 1 }]}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <View style={styles.inputContainer}>
                {options.icon && <View style={styles.fieldIcon}>{options.icon}</View>}
                <TextInput
                    style={[styles.textInput, options.icon && { paddingLeft: 44 }]}
                    placeholder={options.placeholder}
                    placeholderTextColor={Colors.textMuted}
                    keyboardType={options.keyboard || 'default'}
                    value={formData[key]}
                    onChangeText={(t) => handleChange(key, t)}
                    maxLength={options.maxLength}
                />
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <Header title={t('new_resident')} />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scrollArea} showsVerticalScrollIndicator={false}>
                    <Animated.View style={[styles.formCard, cardAnim]}>
                        <View style={styles.cardHeader}>
                            <LinearGradient colors={Gradients.secondary} style={styles.iconBox}>
                                <UserPlus color="#fff" size={22} />
                            </LinearGradient>
                            <View>
                                <Text style={styles.cardTitle}>{t('registration')}</Text>
                                <Text style={styles.cardInfo}>{t('onboard_resident')}</Text>
                            </View>
                        </View>

                        {renderField(t('full_name').toUpperCase(), 'name', { icon: <User size={16} color={Colors.primary} />, placeholder: t('name_placeholder') })}
                        {renderField(t('whatsapp_number').toUpperCase(), 'phone', { keyboard: 'phone-pad', maxLength: 10, icon: <Phone size={16} color={Colors.primary} />, placeholder: t('phone_placeholder') })}

                        <View style={styles.inputRow}>
                            {renderField(t('room_number').toUpperCase(), 'room', { halfWidth: true, icon: <Home size={16} color={Colors.primary} />, placeholder: '101' })}
                            <View style={{ width: 12 }} />
                            {renderField(t('sharing').toUpperCase(), 'sharingType', { halfWidth: true, keyboard: 'numeric', placeholder: t('beds') })}
                        </View>

                        <View style={styles.inputRow}>
                            {renderField(t('monthly_rent').toUpperCase(), 'rent', { halfWidth: true, keyboard: 'numeric', placeholder: t('amount') })}
                            <View style={{ width: 12 }} />
                            {renderField(t('advance_paid').toUpperCase(), 'advance', { halfWidth: true, keyboard: 'numeric', placeholder: t('amount') })}
                        </View>

                        <Animated.View style={[submitPress, { marginTop: 12 }]}>
                            <TouchableOpacity onPress={handleSubmit} disabled={loading} onPressIn={submitIn} onPressOut={submitOut} activeOpacity={1}>
                                <LinearGradient colors={Gradients.secondary} style={styles.registerBtn}>
                                    {loading ? <ActivityIndicator color="#fff" /> : (
                                        <>
                                            <Save color="#fff" size={18} />
                                            <Text style={styles.registerBtnText}>{t('complete_registration')}</Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </Animated.View>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    scrollArea: { padding: Spacing.md },
    formCard: {
        backgroundColor: Colors.backgroundAlt,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        ...Shadows.md
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 28, gap: 16 },
    iconBox: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    cardTitle: { ...Typography.h3, color: Colors.text, fontSize: 22 },
    cardInfo: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 2 },

    fieldGroup: { marginBottom: 20 },
    fieldLabel: { ...Typography.tiny, color: Colors.textSecondary, marginBottom: 8, letterSpacing: 1, fontWeight: '800' },
    inputContainer: { position: 'relative' },
    fieldIcon: { position: 'absolute', left: 14, top: 0, bottom: 0, justifyContent: 'center', zIndex: 1 },
    textInput: {
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        ...Typography.body,
        color: Colors.text,
        fontSize: 15
    },
    inputRow: { flexDirection: 'row' },
    registerBtn: { borderRadius: BorderRadius.md, padding: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8, gap: 10, ...Shadows.glow(Colors.secondary, 0.2) },
    registerBtnText: { color: '#fff', ...Typography.bodyBold, fontSize: 16, letterSpacing: 0.5 },
});

export default AddTenant;

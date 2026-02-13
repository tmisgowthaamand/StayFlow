import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Animated, Easing as RNEasing } from 'react-native';
import { Colors, Spacing, Shadows, Typography, BorderRadius, Gradients } from '../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import { updateTenant } from '../api/api';
import { Save, User, Phone, Home, Zap } from 'lucide-react-native';
import { useFadeSlideIn, usePressAnimation } from '../utils/animations';
import { useLanguage } from '../context/LanguageContext';

const EditTenant = ({ route, navigation }) => {
    const { tenant } = route.params;
    const { t } = useLanguage();
    const [formData, setFormData] = useState({
        name: tenant.Name, phone: tenant.Phone, room: (tenant.Room || '').toString(),
        sharingType: (tenant['Sharing Type'] || '').toString(),
        rent: (tenant['Monthly Rent'] || '0').toString().replace(/[^\d.]/g, ''),
        eb: (tenant['EB Amount'] || '0').toString().replace(/[^\d.]/g, ''),
        status: tenant.Status === 'PAID' || tenant.Status === 'VALID' ? 'PAID' : 'PENDING',
        location: tenant.Location || 'Main Branch'
    });
    const [loading, setLoading] = useState(false);

    // Animations
    const cardAnim = useFadeSlideIn(80, 500, 28);
    const { scaleStyle: submitPress, onPressIn: submitIn, onPressOut: submitOut } = usePressAnimation(0.95);

    const handleChange = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));

    const handleSubmit = async () => {
        try {
            setLoading(true);
            await updateTenant({ oldPhone: tenant.Phone, oldName: tenant.Name, name: formData.name, phone: formData.phone, room: formData.room, rent: formData.rent, eb: formData.eb, sharingType: formData.sharingType, location: formData.location, status: formData.status });
            Alert.alert(t('details_updated'), t('profile_synced', { name: formData.name }), [{ text: t('done'), onPress: () => navigation.goBack() }]);
        } catch (e) { Alert.alert(t('error'), t('profile_update_failed')); }
        finally { setLoading(false); }
    };

    const renderField = (label, key, options = {}) => (
        <View style={[styles.fieldGroup, options.halfWidth && { flex: 1 }]}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <View style={styles.inputBox}>
                {options.icon && <View style={styles.fieldIcon}>{options.icon}</View>}
                <TextInput
                    style={[styles.textInput, options.icon && { paddingLeft: 44 }]}
                    value={formData[key]}
                    onChangeText={t => handleChange(key, t)}
                    keyboardType={options.keyboard || 'default'}
                    maxLength={options.maxLength}
                    placeholderTextColor={Colors.textMuted}
                    placeholder={options.placeholder}
                />
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <Header title={t('edit_profile')} />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scrollArea} showsVerticalScrollIndicator={false}>
                    <Animated.View style={[styles.editCard, cardAnim]}>
                        <View style={styles.cardHeader}>
                            <LinearGradient colors={Gradients.primary} style={styles.iconBox}>
                                <User color="#fff" size={24} />
                            </LinearGradient>
                            <View>
                                <Text style={styles.cardTitle}>{t('resident_profile')}</Text>
                                <Text style={styles.cardInfo}>{t('update_records')} {tenant.Name}</Text>
                            </View>
                        </View>

                        {renderField(t('full_name').toUpperCase(), 'name', { icon: <User size={16} color={Colors.primary} /> })}
                        {renderField(t('phone_number').toUpperCase(), 'phone', { keyboard: 'phone-pad', maxLength: 10, icon: <Phone size={16} color={Colors.primary} /> })}

                        <View style={styles.inputRow}>
                            {renderField(t('room').toUpperCase(), 'room', { halfWidth: true, icon: <Home size={16} color={Colors.primary} /> })}
                            <View style={{ width: 12 }} />
                            {renderField(t('sharing').toUpperCase(), 'sharingType', { halfWidth: true, keyboard: 'numeric' })}
                        </View>

                        <View style={styles.inputRow}>
                            {renderField(t('monthly_rent').toUpperCase(), 'rent', { halfWidth: true, keyboard: 'numeric' })}
                            <View style={{ width: 12 }} />
                            {renderField(t('eb_due').toUpperCase(), 'eb', { halfWidth: true, keyboard: 'numeric', icon: <Zap size={16} color={Colors.primary} /> })}
                        </View>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>{t('ledger_status').toUpperCase()}</Text>
                            <View style={styles.toggleRow}>
                                <TouchableOpacity
                                    style={[styles.toggleBtn, formData.status === 'PAID' && styles.togglePaid]}
                                    onPress={() => handleChange('status', 'PAID')}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[styles.toggleText, formData.status === 'PAID' && { color: Colors.secondaryLight }]}>{t('paid')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.toggleBtn, formData.status === 'PENDING' && styles.togglePending]}
                                    onPress={() => handleChange('status', 'PENDING')}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[styles.toggleText, formData.status === 'PENDING' && { color: Colors.danger }]}>{t('pending')}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <Animated.View style={[submitPress, { marginTop: 12 }]}>
                            <TouchableOpacity onPress={handleSubmit} disabled={loading} onPressIn={submitIn} onPressOut={submitOut} activeOpacity={1}>
                                <LinearGradient colors={Gradients.primary} style={styles.saveBtn}>
                                    {loading ? <ActivityIndicator color="#fff" /> : (
                                        <>
                                            <Save color="#fff" size={20} />
                                            <Text style={styles.saveBtnText}>{t('save_synchronize')}</Text>
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
    editCard: {
        backgroundColor: Colors.backgroundAlt,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        ...Shadows.md
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 32, gap: 16 },
    iconBox: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    cardTitle: { ...Typography.h3, color: Colors.text, fontSize: 22 },
    cardInfo: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 2 },

    fieldGroup: { marginBottom: 22 },
    fieldLabel: { ...Typography.tiny, color: Colors.textSecondary, marginBottom: 10, letterSpacing: 1, fontWeight: '800' },
    inputBox: { position: 'relative' },
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

    toggleRow: { flexDirection: 'row', gap: 12 },
    toggleBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.surface },
    togglePaid: { backgroundColor: Colors.successBg, borderColor: Colors.secondaryLight },
    togglePending: { backgroundColor: Colors.dangerBg, borderColor: Colors.danger },
    toggleText: { ...Typography.bodyBold, color: Colors.textMuted, fontSize: 13, letterSpacing: 1 },

    saveBtn: { borderRadius: BorderRadius.md, padding: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8, gap: 12, ...Shadows.glow(Colors.primary, 0.2) },
    saveBtnText: { color: '#fff', ...Typography.bodyBold, fontSize: 16, letterSpacing: 0.5 },
});

export default EditTenant;

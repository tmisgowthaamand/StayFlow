import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Animated, Easing } from 'react-native';
import { Colors, Spacing, Shadows, Typography, BorderRadius, Gradients } from '../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import { updateTenant } from '../api/api';
import { Save, User, Phone, Home, Zap } from 'lucide-react-native';
import { useFadeSlideIn, usePressAnimation } from '../utils/animations';

const EditTenant = ({ route, navigation }) => {
    const { tenant } = route.params;
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

    // Form field entrance animations
    const fieldAnims = useRef(Array.from({ length: 6 }, () => new Animated.Value(0))).current;
    const fieldSlides = useRef(Array.from({ length: 6 }, () => new Animated.Value(16))).current;
    useEffect(() => {
        fieldAnims.forEach((anim, i) => {
            setTimeout(() => {
                Animated.parallel([
                    Animated.timing(anim, { toValue: 1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                    Animated.timing(fieldSlides[i], { toValue: 0, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                ]).start();
            }, 200 + i * 60);
        });
    }, []);

    const handleChange = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));

    const handleSubmit = async () => {
        try {
            setLoading(true);
            await updateTenant({ oldPhone: tenant.Phone, oldName: tenant.Name, name: formData.name, phone: formData.phone, room: formData.room, rent: formData.rent, eb: formData.eb, sharingType: formData.sharingType, location: formData.location, status: formData.status });
            Alert.alert('Success', 'Resident updated!', [{ text: 'OK', onPress: () => navigation.goBack() }]);
        } catch (e) { Alert.alert('Error', 'Failed: ' + (e?.response?.data?.error || e.message)); }
        finally { setLoading(false); }
    };

    const renderField = (label, key, fieldIndex, options = {}) => (
        <Animated.View style={[styles.formGroup, options.halfWidth && { flex: 1 }, { opacity: fieldAnims[fieldIndex], transform: [{ translateY: fieldSlides[fieldIndex] }] }]}>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.inputWrapper}>
                {options.icon && <View style={styles.inputIcon}>{options.icon}</View>}
                <TextInput style={[styles.input, options.icon && { paddingLeft: 40 }]} value={formData[key]} onChangeText={t => handleChange(key, t)} keyboardType={options.keyboard || 'default'} maxLength={options.maxLength} placeholderTextColor={Colors.textMuted} placeholder={options.placeholder} />
            </View>
        </Animated.View>
    );

    return (
        <View style={styles.container}>
            <Header title="Edit Resident" />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <Animated.View style={[styles.card, Shadows.md, cardAnim]}>
                        <View style={styles.headerRow}>
                            <LinearGradient colors={Gradients.primary} style={styles.headerIconBg}>
                                <User color="#fff" size={20} />
                            </LinearGradient>
                            <View>
                                <Text style={styles.cardTitle}>Edit Details</Text>
                                <Text style={styles.cardSubtitle}>{tenant.Name}</Text>
                            </View>
                        </View>

                        {renderField('Full Name', 'name', 0, { icon: <User size={16} color={Colors.textMuted} />, placeholder: 'Full name' })}
                        {renderField('Phone Number', 'phone', 1, { keyboard: 'phone-pad', maxLength: 10, icon: <Phone size={16} color={Colors.textMuted} />, placeholder: '9876543210' })}

                        <View style={styles.row}>
                            {renderField('Room No', 'room', 2, { halfWidth: true, icon: <Home size={16} color={Colors.textMuted} />, placeholder: '101' })}
                            <View style={{ width: Spacing.sm }} />
                            {renderField('Sharing', 'sharingType', 3, { halfWidth: true, keyboard: 'numeric', placeholder: '2' })}
                        </View>
                        <View style={styles.row}>
                            {renderField('Monthly Rent (₹)', 'rent', 4, { halfWidth: true, keyboard: 'numeric', placeholder: '5000' })}
                            <View style={{ width: Spacing.sm }} />
                            {renderField('EB Due (₹)', 'eb', 5, { halfWidth: true, keyboard: 'numeric', icon: <Zap size={16} color={Colors.textMuted} />, placeholder: '0' })}
                        </View>

                        <Animated.View style={{ opacity: fieldAnims[5], transform: [{ translateY: fieldSlides[5] }] }}>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Payment Status</Text>
                                <View style={styles.statusContainer}>
                                    <TouchableOpacity style={[styles.statusOption, formData.status === 'PAID' && styles.statusActivePaid]} onPress={() => handleChange('status', 'PAID')}>
                                        <Text style={[styles.statusOptionText, formData.status === 'PAID' && { color: Colors.success }]}>PAID</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.statusOption, formData.status === 'PENDING' && styles.statusActivePending]} onPress={() => handleChange('status', 'PENDING')}>
                                        <Text style={[styles.statusOptionText, formData.status === 'PENDING' && { color: Colors.danger }]}>PENDING</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </Animated.View>

                        <Animated.View style={submitPress}>
                            <TouchableOpacity onPress={handleSubmit} disabled={loading} onPressIn={submitIn} onPressOut={submitOut} activeOpacity={1}>
                                <LinearGradient colors={Gradients.primary} style={styles.submitButton}>
                                    {loading ? <ActivityIndicator color="#fff" /> : (<><Save color="#fff" size={18} /><Text style={styles.submitButtonText}>Save Changes</Text></>)}
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
    scrollContent: { padding: Spacing.md },
    card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xl, gap: 14 },
    headerIconBg: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    cardTitle: { ...Typography.h3, color: Colors.text },
    cardSubtitle: { ...Typography.caption, color: Colors.primary, marginTop: 2 },
    formGroup: { marginBottom: Spacing.md },
    label: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 6, fontWeight: '600' },
    inputWrapper: { position: 'relative' },
    inputIcon: { position: 'absolute', left: 12, top: 0, bottom: 0, justifyContent: 'center', zIndex: 1 },
    input: { backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm, paddingHorizontal: 14, paddingVertical: 12, ...Typography.body, color: Colors.text },
    row: { flexDirection: 'row' },
    statusContainer: { flexDirection: 'row', gap: 12 },
    statusOption: { flex: 1, padding: 14, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.surfaceElevated },
    statusActivePaid: { backgroundColor: Colors.successBg, borderColor: Colors.success },
    statusActivePending: { backgroundColor: Colors.dangerBg, borderColor: Colors.danger },
    statusOptionText: { ...Typography.bodyBold, color: Colors.textSecondary },
    submitButton: { borderRadius: BorderRadius.md, padding: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: Spacing.sm, gap: 8 },
    submitButtonText: { color: '#fff', ...Typography.bodyBold, fontSize: 16 },
});

export default EditTenant;

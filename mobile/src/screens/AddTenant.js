import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Animated, Easing } from 'react-native';
import { Colors, Spacing, Shadows, Typography, BorderRadius, Gradients } from '../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import { addTenant } from '../api/api';
import { UserPlus, Save, User, Phone, Home } from 'lucide-react-native';
import { useFadeSlideIn, usePressAnimation } from '../utils/animations';
import { notifyNewRegistration } from '../utils/notifications';

const AddTenant = ({ navigation }) => {
    const [formData, setFormData] = useState({ name: '', phone: '', room: '', sharingType: '3', advance: '0', rent: '0' });
    const [loading, setLoading] = useState(false);

    // Animations
    const cardAnim = useFadeSlideIn(80, 500, 28);
    const { scaleStyle: submitPress, onPressIn: submitIn, onPressOut: submitOut } = usePressAnimation(0.95);

    // Cascading field animations
    const fieldAnims = useRef(Array.from({ length: 6 }, () => new Animated.Value(0))).current;
    const fieldSlides = useRef(Array.from({ length: 6 }, () => new Animated.Value(18))).current;
    useEffect(() => {
        fieldAnims.forEach((anim, i) => {
            setTimeout(() => {
                Animated.parallel([
                    Animated.timing(anim, { toValue: 1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                    Animated.timing(fieldSlides[i], { toValue: 0, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                ]).start();
            }, 200 + i * 70);
        });
    }, []);

    const handleChange = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));

    const handleSubmit = async () => {
        if (!formData.name || !formData.phone || !formData.room || !formData.rent) { Alert.alert('Error', 'Please fill all required fields'); return; }
        try {
            setLoading(true);
            await addTenant({ ...formData, monthlyRent: formData.rent });
            await notifyNewRegistration(formData.name, formData.room, formData.phone);
            Alert.alert('Success', 'Resident added!', [{ text: 'OK', onPress: () => { setFormData({ name: '', phone: '', room: '', sharingType: '3', advance: '0', rent: '0' }); navigation.navigate('Residents'); } }]);
        } catch (e) { Alert.alert('Error', 'Failed to add resident.'); console.error(e); }
        finally { setLoading(false); }
    };

    const renderField = (label, key, fieldIndex, options = {}) => (
        <Animated.View style={[styles.formGroup, options.halfWidth && { flex: 1 }, { opacity: fieldAnims[fieldIndex], transform: [{ translateY: fieldSlides[fieldIndex] }] }]}>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.inputWrapper}>
                {options.icon && <View style={styles.inputIcon}>{options.icon}</View>}
                <TextInput style={[styles.input, options.icon && { paddingLeft: 40 }]} placeholder={options.placeholder} placeholderTextColor={Colors.textMuted} keyboardType={options.keyboard || 'default'} value={formData[key]} onChangeText={(t) => handleChange(key, t)} maxLength={options.maxLength} />
            </View>
        </Animated.View>
    );

    return (
        <View style={styles.container}>
            <Header title="Add Resident" />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <Animated.View style={[styles.card, Shadows.md, cardAnim]}>
                        <View style={styles.headerRow}>
                            <LinearGradient colors={Gradients.secondary} style={styles.headerIconBg}>
                                <UserPlus color="#fff" size={20} />
                            </LinearGradient>
                            <View>
                                <Text style={styles.cardTitle}>New Resident</Text>
                                <Text style={styles.cardSubtitle}>Fill in the details below</Text>
                            </View>
                        </View>

                        {renderField('Full Name *', 'name', 0, { icon: <User size={16} color={Colors.textMuted} />, placeholder: 'e.g. John Doe' })}
                        {renderField('Phone Number *', 'phone', 1, { keyboard: 'phone-pad', maxLength: 10, icon: <Phone size={16} color={Colors.textMuted} />, placeholder: 'e.g. 9876543210' })}

                        <View style={styles.row}>
                            {renderField('Room No *', 'room', 2, { halfWidth: true, icon: <Home size={16} color={Colors.textMuted} />, placeholder: '101' })}
                            <View style={{ width: Spacing.sm }} />
                            {renderField('Sharing *', 'sharingType', 3, { halfWidth: true, keyboard: 'numeric', placeholder: '2, 3, 4' })}
                        </View>
                        <View style={styles.row}>
                            {renderField('Monthly Rent *', 'rent', 4, { halfWidth: true, keyboard: 'numeric', placeholder: '5000' })}
                            <View style={{ width: Spacing.sm }} />
                            {renderField('Advance', 'advance', 5, { halfWidth: true, keyboard: 'numeric', placeholder: '2000' })}
                        </View>

                        <Animated.View style={submitPress}>
                            <TouchableOpacity onPress={handleSubmit} disabled={loading} onPressIn={submitIn} onPressOut={submitOut} activeOpacity={1}>
                                <LinearGradient colors={Gradients.secondary} style={styles.submitButton}>
                                    {loading ? <ActivityIndicator color="#fff" /> : (<><Save color="#fff" size={18} /><Text style={styles.submitButtonText}>Register Resident</Text></>)}
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
    cardSubtitle: { ...Typography.caption, color: Colors.secondary, marginTop: 2 },
    formGroup: { marginBottom: Spacing.md },
    label: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 6, fontWeight: '600' },
    inputWrapper: { position: 'relative' },
    inputIcon: { position: 'absolute', left: 12, top: 0, bottom: 0, justifyContent: 'center', zIndex: 1 },
    input: { backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm, paddingHorizontal: 14, paddingVertical: 12, ...Typography.body, color: Colors.text },
    row: { flexDirection: 'row' },
    submitButton: { borderRadius: BorderRadius.md, padding: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: Spacing.sm, gap: 8 },
    submitButtonText: { color: '#fff', ...Typography.bodyBold, fontSize: 16 },
});

export default AddTenant;

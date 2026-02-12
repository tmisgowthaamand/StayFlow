import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Colors, Spacing, Shadows } from '../theme/theme';
import Header from '../components/Header';
import { updateTenant } from '../api/api';
import { Save, User } from 'lucide-react-native';

const EditTenant = ({ route, navigation }) => {
    const { tenant } = route.params;
    const [formData, setFormData] = useState({
        name: tenant.Name,
        phone: tenant.Phone,
        room: (tenant.Room || '').toString(),
        sharingType: (tenant['Sharing Type'] || '').toString(),
        rent: (tenant['Monthly Rent'] || '0').toString().replace(/[^\d.]/g, ''),
        eb: (tenant['EB Amount'] || '0').toString().replace(/[^\d.]/g, ''),
        status: tenant.Status === 'PAID' || tenant.Status === 'VALID' ? 'PAID' : 'PENDING',
        location: tenant.Location || 'Main Branch'
    });
    const [loading, setLoading] = useState(false);

    const handleChange = (key, value) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async () => {
        try {
            setLoading(true);
            const payload = {
                oldPhone: tenant.Phone,
                oldName: tenant.Name,
                name: formData.name,
                phone: formData.phone,
                room: formData.room,
                rent: formData.rent,
                eb: formData.eb,
                sharingType: formData.sharingType,
                location: formData.location,
                status: formData.status
            };
            await updateTenant(payload);
            Alert.alert('Success', 'Resident details updated!', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (error) {
            Alert.alert('Error', 'Failed to update resident: ' + (error?.response?.data?.error || error.message));
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Header title="Edit Resident" />
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={[styles.card, Shadows.md]}>
                        <View style={styles.headerRow}>
                            <User color={Colors.primary} size={24} />
                            <Text style={styles.cardTitle}>Edit Details: {tenant.Name}</Text>
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Full Name</Text>
                            <TextInput style={styles.input} value={formData.name} onChangeText={t => handleChange('name', t)} />
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Phone Number</Text>
                            <TextInput style={styles.input} keyboardType="phone-pad" value={formData.phone} onChangeText={t => handleChange('phone', t)} maxLength={10} />
                        </View>

                        <View style={styles.row}>
                            <View style={[styles.formGroup, { flex: 1, marginRight: Spacing.sm }]}>
                                <Text style={styles.label}>Room No</Text>
                                <TextInput style={styles.input} value={formData.room} onChangeText={t => handleChange('room', t)} />
                            </View>
                            <View style={[styles.formGroup, { flex: 1 }]}>
                                <Text style={styles.label}>Sharing</Text>
                                <TextInput style={styles.input} keyboardType="numeric" value={formData.sharingType} onChangeText={t => handleChange('sharingType', t)} />
                            </View>
                        </View>

                        <View style={styles.row}>
                            <View style={[styles.formGroup, { flex: 1, marginRight: Spacing.sm }]}>
                                <Text style={styles.label}>Monthly Rent (₹)</Text>
                                <TextInput style={styles.input} keyboardType="numeric" value={formData.rent} onChangeText={t => handleChange('rent', t)} />
                            </View>
                            <View style={[styles.formGroup, { flex: 1 }]}>
                                <Text style={styles.label}>EB Due (₹)</Text>
                                <TextInput style={styles.input} keyboardType="numeric" value={formData.eb} onChangeText={t => handleChange('eb', t)} />
                            </View>
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Payment Status</Text>
                            <View style={styles.statusContainer}>
                                <TouchableOpacity
                                    style={[styles.statusOption, formData.status === 'PAID' && styles.statusActive]}
                                    onPress={() => handleChange('status', 'PAID')}
                                >
                                    <Text style={[styles.statusText, formData.status === 'PAID' && styles.statusTextActive]}>PAID</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.statusOption, formData.status === 'PENDING' && styles.statusActiveRed]}
                                    onPress={() => handleChange('status', 'PENDING')}
                                >
                                    <Text style={[styles.statusText, formData.status === 'PENDING' && styles.statusTextActive]}>PENDING</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
                            {loading ? <ActivityIndicator color="#fff" /> : (
                                <>
                                    <Save color="#fff" size={20} style={{ marginRight: 8 }} />
                                    <Text style={styles.submitButtonText}>Save Changes</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    scrollContent: { padding: Spacing.md },
    card: { backgroundColor: Colors.surface, borderRadius: 16, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.lg, gap: 12 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
    formGroup: { marginBottom: Spacing.md },
    label: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
    input: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 12, fontSize: 16, color: Colors.text },
    row: { flexDirection: 'row' },
    submitButton: { backgroundColor: Colors.primary, borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: Spacing.sm },
    submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    statusContainer: { flexDirection: 'row', gap: 12 },
    statusOption: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.background },
    statusActive: { backgroundColor: '#ECFDF5', borderColor: '#059669' },
    statusActiveRed: { backgroundColor: '#FEF2F2', borderColor: '#DC2626' },
    statusText: { fontWeight: 'bold', color: Colors.textSecondary },
    statusTextActive: { color: Colors.text }
});

export default EditTenant;

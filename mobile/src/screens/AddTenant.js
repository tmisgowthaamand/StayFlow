import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Colors, Spacing, Shadows } from '../theme/theme';
import Header from '../components/Header';
import { addTenant } from '../api/api';
import { UserPlus, Save, X } from 'lucide-react-native';

const AddTenant = ({ navigation }) => {
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        room: '',
        sharingType: '3',
        advance: '0',
        rent: '0'
    });
    const [loading, setLoading] = useState(false);

    const handleChange = (key, value) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async () => {
        if (!formData.name || !formData.phone || !formData.room || !formData.rent) {
            Alert.alert('Error', 'Please fill all required fields');
            return;
        }

        try {
            setLoading(true);
            const payload = {
                ...formData,
                monthlyRent: formData.rent
            };
            await addTenant(payload);
            Alert.alert('Success', 'Resident added successfully!', [
                {
                    text: 'OK', onPress: () => {
                        setFormData({
                            name: '',
                            phone: '',
                            room: '',
                            sharingType: '3',
                            advance: '0',
                            rent: '0'
                        });
                        navigation.navigate('Residents');
                    }
                }
            ]);
        } catch (error) {
            Alert.alert('Error', 'Failed to add resident. Please try again.');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Header title="Add Resident" />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={[styles.card, Shadows.md]}>
                        <View style={styles.headerRow}>
                            <UserPlus color={Colors.primary} size={24} />
                            <Text style={styles.cardTitle}>New Resident Details</Text>
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Full Name *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. John Doe"
                                value={formData.name}
                                onChangeText={(t) => handleChange('name', t)}
                            />
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Phone Number *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. 9876543210"
                                keyboardType="phone-pad"
                                value={formData.phone}
                                onChangeText={(t) => handleChange('phone', t)}
                                maxLength={10}
                            />
                        </View>

                        <View style={styles.row}>
                            <View style={[styles.formGroup, { flex: 1, marginRight: Spacing.sm }]}>
                                <Text style={styles.label}>Room No *</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. 101"
                                    value={formData.room}
                                    onChangeText={(t) => handleChange('room', t)}
                                />
                            </View>

                            <View style={[styles.formGroup, { flex: 1 }]}>
                                <Text style={styles.label}>Sharing *</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. 2, 3, 4"
                                    keyboardType="numeric"
                                    value={formData.sharingType}
                                    onChangeText={(t) => handleChange('sharingType', t)}
                                />
                            </View>
                        </View>

                        <View style={styles.row}>
                            <View style={[styles.formGroup, { flex: 1, marginRight: Spacing.sm }]}>
                                <Text style={styles.label}>Monthly Rent *</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. 5000"
                                    keyboardType="numeric"
                                    value={formData.rent}
                                    onChangeText={(t) => handleChange('rent', t)}
                                />
                            </View>

                            <View style={[styles.formGroup, { flex: 1 }]}>
                                <Text style={styles.label}>Advance</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. 2000"
                                    keyboardType="numeric"
                                    value={formData.advance}
                                    onChangeText={(t) => handleChange('advance', t)}
                                />
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.submitButton}
                            onPress={handleSubmit}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Save color="#fff" size={20} style={{ marginRight: 8 }} />
                                    <Text style={styles.submitButtonText}>Register Resident</Text>
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
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    scrollContent: {
        padding: Spacing.md,
    },
    card: {
        backgroundColor: Colors.surface,
        borderRadius: 16,
        padding: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.lg,
        gap: 12
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
    },
    formGroup: {
        marginBottom: Spacing.md,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.textSecondary,
        marginBottom: 6,
    },
    input: {
        backgroundColor: Colors.background,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: Colors.text,
    },
    row: {
        flexDirection: 'row',
    },
    submitButton: {
        backgroundColor: Colors.primary,
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: Spacing.sm,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default AddTenant;

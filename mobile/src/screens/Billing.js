import React, { useEffect, useState, useCallback, useRef, memo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Alert, Animated, Easing, RefreshControl } from 'react-native';
import { Colors, Spacing, Shadows, Typography, BorderRadius, Gradients } from '../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import { getTenants, updateEBBill } from '../api/api';
import { Zap, Save, CheckCircle2, Search } from 'lucide-react-native';
import { usePressAnimation, useFadeSlideIn, SkeletonCard, AnimatedListItem } from '../utils/animations';

const EBItem = memo(({ item, onSave, index }) => {
    const [ebValue, setEbValue] = useState(item['EB Amount']?.toString() || '0');
    const [isChanged, setIsChanged] = useState(false);
    const { scaleStyle, onPressIn, onPressOut } = usePressAnimation(0.98);

    useEffect(() => {
        setEbValue(item['EB Amount']?.toString() || '0');
        setIsChanged(false);
    }, [item]);

    const handleChange = (text) => {
        setEbValue(text);
        setIsChanged(text !== item['EB Amount']?.toString());
    };

    return (
        <AnimatedListItem index={index}>
            <Animated.View style={[styles.card, scaleStyle]} onTouchStart={onPressIn} onTouchEnd={onPressOut} onTouchCancel={onPressOut}>
                <View style={styles.cardContent}>
                    <View style={styles.residentInfo}>
                        <LinearGradient colors={Gradients.purple} style={styles.avatar}>
                            <Text style={styles.avatarText}>{item.Name?.[0]}</Text>
                        </LinearGradient>
                        <View style={styles.infoText}>
                            <Text style={styles.nameText}>{item.Name}</Text>
                            <Text style={styles.roomText}>Room {item.Room}</Text>
                        </View>
                    </View>

                    <View style={[styles.inputWrapper, isChanged && styles.inputWrapperFocused]}>
                        <Text style={styles.currency}>₹</Text>
                        <TextInput
                            style={styles.currencyInput}
                            keyboardType="numeric"
                            value={ebValue}
                            onChangeText={handleChange}
                            placeholderTextColor={Colors.textMuted}
                        />
                        {isChanged && (
                            <TouchableOpacity style={styles.saveBtn} onPress={() => onSave(item, ebValue)}>
                                <LinearGradient colors={Gradients.secondary} style={styles.saveBtnInner}>
                                    <Save size={14} color="#fff" />
                                </LinearGradient>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Animated.View>
        </AnimatedListItem>
    );
});

const Billing = () => {
    const [tenants, setTenants] = useState([]);
    const [filteredTenants, setFilteredTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchTenants = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getTenants();
            const active = data.filter(t => t.Status !== 'VACATED');
            setTenants(active);
            setFilteredTenants(active);
        } catch (error) { console.error(error); }
        finally { setLoading(false); setRefreshing(false); }
    }, []);

    useEffect(() => { fetchTenants(); }, []);

    const onRefresh = () => { setRefreshing(true); fetchTenants(); };

    const handleSearch = (text) => {
        const filtered = tenants.filter(t =>
            t.Name?.toLowerCase().includes(text.toLowerCase()) ||
            t.Room?.toString().includes(text) ||
            t.Phone?.toString().includes(text)
        );
        setFilteredTenants(filtered);
    };

    const handleUpdateEB = async (tenant, amt) => {
        try {
            setLoading(true);
            // Placeholder: Add real API call to update EB bill
            Alert.alert('Success', `EB Bill for ${tenant.Name} updated to ₹${amt}`);
            fetchTenants();
        } catch (e) { Alert.alert('Error', 'Failed to update bill'); }
        finally { setLoading(false); }
    };

    return (
        <View style={styles.container}>
            <Header
                title="Utilities"
                subtitle="Electric Bill"
                onSearchChange={handleSearch}
                placeholder="Search name, room..."
            />

            {loading && !refreshing ? (
                <View style={styles.listArea}><SkeletonCard /><SkeletonCard /></View>
            ) : (
                <FlatList
                    data={filteredTenants}
                    keyExtractor={(it, idx) => idx.toString()}
                    renderItem={({ item, index }) => <EBItem item={item} onSave={handleUpdateEB} index={index} />}
                    contentContainerStyle={styles.listArea}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },

    // Search
    searchSection: { padding: Spacing.md },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.backgroundAlt,
        borderRadius: BorderRadius.md,
        paddingHorizontal: 16,
        height: 52,
        borderWidth: 1,
        borderColor: Colors.border,
        gap: 12
    },
    searchLabel: { ...Typography.bodySmall, color: Colors.textMuted },

    // List
    listArea: { paddingHorizontal: Spacing.md, paddingBottom: 100 },

    // Card
    card: {
        backgroundColor: Colors.backgroundAlt,
        borderRadius: BorderRadius.md,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: Colors.border,
        ...Shadows.sm
    },
    cardContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    residentInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    avatar: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#fff', fontWeight: 'bold' },
    infoText: { flex: 1 },
    nameText: { ...Typography.bodyBold, color: Colors.text },
    roomText: { ...Typography.tiny, color: Colors.textSecondary, textTransform: 'none', marginTop: 2 },

    // Input
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: 8,
        paddingHorizontal: 10,
        height: 40,
        width: 120,
        borderWidth: 1,
        borderColor: Colors.border
    },
    inputWrapperFocused: { borderColor: Colors.secondaryLight },
    currency: { ...Typography.bodyBold, color: Colors.textSecondary, marginRight: 4 },
    currencyInput: { flex: 1, color: Colors.text, ...Typography.bodyBold, fontSize: 14 },
    saveBtn: { marginLeft: 8 },
    saveBtnInner: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
});

export default Billing;

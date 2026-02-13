import React, { useEffect, useState, useCallback, memo, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Alert, RefreshControl, Animated, Easing } from 'react-native';
import { Colors, Spacing, Shadows, Typography, BorderRadius, Gradients } from '../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import { useNavigation } from '@react-navigation/native';
import { getTenants, notifyTenant, markPaidManual, deleteTenant, notifyAll, generateInvoice } from '../api/api';
import { Search, Bell, Phone, CheckCircle, Trash2, Edit, FileText, Send, Zap, MoreVertical, MapPin, Star, Users } from 'lucide-react-native';
import { usePressAnimation, SkeletonCard, AnimatedListItem } from '../utils/animations';

// ─── Premium Resident Card ─────────────────────────────────────
const ResidentItem = memo(({ item, index }) => {
    const isPaid = item.Status === 'PAID' || item.Status === 'VALID';
    const navigation = useNavigation();
    const { scaleStyle, onPressIn, onPressOut } = usePressAnimation(0.98);

    const statusColor = isPaid ? Colors.secondary : item.Status === 'PENDING' ? Colors.warning : Colors.danger;

    return (
        <AnimatedListItem index={index}>
            <Animated.View style={[styles.card, scaleStyle]} onTouchStart={onPressIn} onTouchEnd={onPressOut} onTouchCancel={onPressOut}>
                <View style={styles.cardHeader}>
                    <View style={styles.avatarWrapper}>
                        <LinearGradient colors={isPaid ? Gradients.secondary : Gradients.primary} style={styles.avatarInner}>
                            <Text style={styles.avatarText}>{item.Name?.[0] || '?'}</Text>
                        </LinearGradient>
                        <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
                    </View>

                    <View style={styles.headerText}>
                        <Text style={styles.nameText}>{item.Name}</Text>
                        <View style={styles.metaRow}>
                            <MapPin size={12} color={Colors.textSecondary} />
                            <Text style={styles.metaText}>Room {item.Room}</Text>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.optionsBtn}>
                        <MoreVertical size={20} color={Colors.textMuted} />
                    </TouchableOpacity>
                </View>

                <View style={styles.statsGrid}>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>RENT</Text>
                        <Text style={styles.statValue}>₹{item['Monthly Rent'] || '0'}</Text>
                    </View>
                    <View style={styles.gridDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>PHONE</Text>
                        <Text style={styles.statValue}>{item.Phone || 'N/A'}</Text>
                    </View>
                </View>

                <View style={styles.actionsRow}>
                    <TouchableOpacity style={[styles.btn, styles.secondaryBtn]} onPress={() => navigation.navigate('EditTenant', { tenant: item })}>
                        <Edit size={16} color={Colors.primaryLight} />
                        <Text style={styles.btnTextSecondary}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.btn, styles.primaryBtn]}>
                        <LinearGradient colors={Gradients.cool} style={StyleSheet.absoluteFill} />
                        <Send size={16} color="#fff" />
                        <Text style={styles.btnTextPrimary}>Remind</Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </AnimatedListItem>
    );
});

const Residents = () => {
    const [tenants, setTenants] = useState([]);
    const [filteredTenants, setFilteredTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const navigation = useNavigation();

    const fetchTenants = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getTenants();
            setTenants(data);
            setFilteredTenants(data);
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchTenants(); }, []);

    const handleSearch = (text) => {
        setSearch(text);
        const filtered = tenants.filter(t =>
            t.Name?.toLowerCase().includes(text.toLowerCase()) ||
            t.Room?.toString().includes(text) ||
            t.Phone?.includes(text)
        );
        setFilteredTenants(filtered);
    };

    return (
        <View style={styles.container}>
            <Header
                title="Residents"
                subtitle="Management"
                onSearchChange={handleSearch}
                placeholder="Search name, room, or phone..."
            />

            {loading ? (
                <View style={styles.listArea}><SkeletonCard /><SkeletonCard /></View>
            ) : (
                <FlatList
                    data={filteredTenants}
                    keyExtractor={(it, idx) => idx.toString()}
                    renderItem={({ item, index }) => <ResidentItem item={item} index={index} />}
                    contentContainerStyle={styles.listArea}
                    refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchTenants} tintColor={Colors.primary} />}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Users size={48} color={Colors.textMuted} />
                            <Text style={styles.emptyText}>No residents found</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },

    // Search
    headerSearch: { padding: Spacing.md },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.backgroundAlt,
        borderRadius: BorderRadius.md,
        paddingHorizontal: 16,
        height: 54,
        borderWidth: 1,
        borderColor: Colors.border
    },
    searchInput: { flex: 1, marginLeft: 12, ...Typography.body, color: Colors.text },

    // List
    listArea: { paddingHorizontal: Spacing.md, paddingBottom: 100 },

    // Card
    card: {
        backgroundColor: Colors.backgroundAlt,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Colors.border,
        ...Shadows.sm,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    avatarWrapper: { position: 'relative' },
    avatarInner: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#fff', fontWeight: '900', fontSize: 20 },
    statusIndicator: { position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: Colors.backgroundAlt },
    headerText: { flex: 1, marginLeft: 16 },
    nameText: { ...Typography.h4, color: Colors.text, fontSize: 17 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    metaText: { ...Typography.bodySmall, color: Colors.textSecondary },
    optionsBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

    // Stats Grid
    statsGrid: {
        flexDirection: 'row',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        padding: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: Colors.border
    },
    statItem: { flex: 1, alignItems: 'center' },
    statLabel: { ...Typography.tiny, fontSize: 9, color: Colors.textMuted, marginBottom: 4 },
    statValue: { ...Typography.bodyBold, color: Colors.text, fontSize: 14 },
    gridDivider: { width: 1, height: '60%', backgroundColor: Colors.border, alignSelf: 'center' },

    // Actions
    actionsRow: { flexDirection: 'row', gap: 12 },
    btn: { flex: 1, height: 46, borderRadius: BorderRadius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden' },
    secondaryBtn: { backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: Colors.border },
    primaryBtn: { backgroundColor: Colors.primary },
    btnTextSecondary: { ...Typography.bodyBold, color: Colors.text, fontSize: 14 },
    btnTextPrimary: { ...Typography.bodyBold, color: '#fff', fontSize: 14 },

    emptyContainer: { padding: 40, alignItems: 'center' },
    emptyText: { ...Typography.bodySmall, color: Colors.textMuted, fontStyle: 'italic', marginTop: 12 },
});

export default Residents;

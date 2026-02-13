import React, { useEffect, useState, useCallback, memo, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Alert, RefreshControl, Animated, Easing } from 'react-native';
import { Colors, Spacing, Shadows, Typography, BorderRadius, Gradients } from '../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import { useNavigation } from '@react-navigation/native';
import { getTenants, notifyTenant, markPaidManual, deleteTenant, notifyAll, generateInvoice } from '../api/api';
import { Search, Bell, Phone, CheckCircle, Trash2, Edit, FileText, Send, IndianRupee, Zap } from 'lucide-react-native';
import { usePressAnimation, SkeletonCard } from '../utils/animations';
import { notifyInvoiceSent, notifyPaymentReceived, notifyBulkInvoice } from '../utils/notifications';

// ─── Animated Resident Card ────────────────────────────────────
const ResidentItem = memo(({ item, onNotify, onMarkPaid, onDelete, onViewInvoice, index }) => {
    const isPaid = item.Status === 'PAID' || item.Status === 'VALID';
    const navigation = useNavigation();
    const { scaleStyle, onPressIn, onPressOut } = usePressAnimation(0.97);

    // Entrance animation
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(22)).current;

    useEffect(() => {
        const delay = Math.min(index * 60, 400);
        const timer = setTimeout(() => {
            Animated.parallel([
                Animated.timing(opacity, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                Animated.timing(translateY, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            ]).start();
        }, delay);
        return () => clearTimeout(timer);
    }, []);

    const statusColor = isPaid ? Colors.success : item.Status === 'PENDING' ? Colors.warning : Colors.danger;
    const statusBg = isPaid ? Colors.successBg : item.Status === 'PENDING' ? Colors.warningBg : Colors.dangerBg;

    return (
        <Animated.View
            style={[
                styles.card,
                Shadows.sm,
                scaleStyle,
                { opacity, transform: [...scaleStyle.transform, { translateY }] },
            ]}
            onTouchStart={onPressIn}
            onTouchEnd={onPressOut}
            onTouchCancel={onPressOut}
        >
            <View style={styles.cardHeader}>
                <View style={styles.nameContainer}>
                    <LinearGradient
                        colors={isPaid ? Gradients.secondary : Gradients.accent}
                        style={styles.avatarSmall}
                    >
                        <Text style={styles.avatarChar}>{item.Name?.[0] || '?'}</Text>
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.nameText}>{item.Name}</Text>
                        <Text style={styles.roomText}>Room {item.Room} • {item.Phone}</Text>
                    </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>
                        {item.Status || 'PENDING'}
                    </Text>
                </View>
            </View>

            <View style={styles.breakdownRow}>
                <View style={styles.breakdownItem}>
                    <Text style={styles.breakdownLabel}>Rent</Text>
                    <Text style={styles.breakdownValue}>₹{item['Monthly Rent'] || '0'}</Text>
                </View>
                <View style={styles.breakdownDivider} />
                <View style={styles.breakdownItem}>
                    <Text style={styles.breakdownLabel}>EB</Text>
                    <Text style={styles.breakdownValue}>₹{item['EB Amount'] || '0'}</Text>
                </View>
                <View style={styles.breakdownDivider} />
                <View style={styles.breakdownItem}>
                    <Text style={styles.breakdownLabel}>Total</Text>
                    <Text style={[styles.breakdownValue, { color: Colors.primary, fontWeight: 'bold' }]}>
                        ₹{item['Total Amount'] || '0'}
                    </Text>
                </View>
                {isPaid && (
                    <>
                        <View style={styles.breakdownDivider} />
                        <View style={styles.breakdownItem}>
                            <Text style={styles.breakdownLabel}>Mode</Text>
                            <Text style={[styles.breakdownValue, { color: Colors.success }]}>
                                {item['Payment Mode'] || '-'}
                            </Text>
                        </View>
                    </>
                )}
            </View>

            <View style={styles.cardFooter}>
                <View style={styles.actionButtons}>
                    <ActionBtn bg={Colors.surfaceElevated} icon={<Edit size={16} color={Colors.textSecondary} />} onPress={() => navigation.navigate('EditTenant', { tenant: item })} />
                    <ActionBtn bg={Colors.infoBg} icon={<FileText size={16} color={Colors.info} />} onPress={() => onViewInvoice(item)} />
                    <ActionBtn bg="rgba(108,99,255,0.12)" icon={<Bell size={16} color={Colors.primary} />} onPress={() => onNotify(item)} />
                    {!isPaid && <ActionBtn bg={Colors.successBg} icon={<CheckCircle size={16} color={Colors.success} />} onPress={() => onMarkPaid(item)} />}
                    <ActionBtn bg={Colors.dangerBg} icon={<Trash2 size={16} color={Colors.danger} />} onPress={() => onDelete(item)} />
                </View>
            </View>
        </Animated.View>
    );
});

// ─── Animated Action Button ────────────────────────────────────
const ActionBtn = memo(({ bg, icon, onPress }) => {
    const { scaleStyle, onPressIn, onPressOut } = usePressAnimation(0.85);

    return (
        <Animated.View style={scaleStyle}>
            <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: bg }]}
                onPress={onPress}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                activeOpacity={1}
            >
                {icon}
            </TouchableOpacity>
        </Animated.View>
    );
});

// ─── Loading State ─────────────────────────────────────────────
const LoadingSkeleton = memo(() => (
    <View style={styles.listContent}>
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
    </View>
));

// ─── Main Screen ───────────────────────────────────────────────
const Residents = () => {
    const [tenants, setTenants] = useState([]);
    const [filteredTenants, setFilteredTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [notifyingAll, setNotifyingAll] = useState(false);
    const navigation = useNavigation();

    // Search bar entrance animation
    const searchAnim = useRef(new Animated.Value(0)).current;
    const searchSlide = useRef(new Animated.Value(-20)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(searchAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(searchSlide, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]).start();
    }, []);

    const fetchTenants = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getTenants();
            setTenants(data);
            setFilteredTenants(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchTenants(); }, []);

    const handleSearch = useCallback((text) => {
        setSearch(text);
        const filtered = tenants.filter(t =>
            t.Name?.toLowerCase().includes(text.toLowerCase()) ||
            t.Room?.toString().includes(text) ||
            t.Phone?.includes(text)
        );
        setFilteredTenants(filtered);
    }, [tenants]);

    const handleNotify = useCallback(async (tenant) => {
        const total = tenant['Total Amount'] || '0';
        Alert.alert('📩 Send Invoice', `Send invoice to ${tenant.Name}?\n\n🏠 Room: ${tenant.Room}\n💰 Rent: ₹${tenant['Monthly Rent'] || '0'}\n⚡ EB: ₹${tenant['EB Amount'] || '0'}\n━━━━━━━━━━\n📊 Total Due: ₹${total}`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Send Invoice', onPress: async () => {
                    try {
                        await notifyTenant(tenant.Phone, tenant.Name);
                        // Trigger local system notification
                        await notifyInvoiceSent(tenant.Name, tenant.Room, total);
                        Alert.alert('✅ Sent!', `Invoice for ₹${total} sent to ${tenant.Name}`);
                    }
                    catch (e) { Alert.alert('Error', 'Failed: ' + (e?.response?.data?.error || e.message)); }
                }
            }
        ]);
    }, []);

    const handleNotifyAll = useCallback(() => {
        const activeCount = tenants.filter(t => t.Status !== 'VACATED').length;
        Alert.alert('📢 Notify All', `Send invoices to ALL ${activeCount} residents?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Send to All', onPress: async () => {
                    try {
                        setNotifyingAll(true);
                        await notifyAll();
                        // Trigger local system notification
                        await notifyBulkInvoice(activeCount);
                        Alert.alert('Success', `Sending to ${activeCount} residents!`);
                    }
                    catch (e) { Alert.alert('Error', e.message); }
                    finally { setNotifyingAll(false); }
                }
            }
        ]);
    }, [tenants]);

    const handleViewInvoice = useCallback(async (tenant) => {
        try {
            const result = await generateInvoice(tenant.Phone, tenant.Name);
            if (result?.url) {
                navigation.navigate('PDFViewer', { url: `https://stayflow-hnm3.onrender.com${result.url}`, title: `Invoice: ${tenant.Name}` });
            } else Alert.alert('Error', 'Could not generate invoice');
        } catch (e) { Alert.alert('Error', 'Failed: ' + (e?.response?.data?.error || e.message)); }
    }, [navigation]);

    const handleMarkPaid = useCallback((tenant) => {
        const total = tenant['Total Amount'] || '0';
        Alert.alert('✅ Verify Payment', `Confirm from ${tenant.Name}?\n📊 Total: ₹${total}`, [
            { text: 'Cancel', style: 'cancel' },
            { text: '💵 Cash', onPress: () => confirmPayment(tenant, total, 'CASH') },
            { text: '📱 UPI', onPress: () => confirmPayment(tenant, total, 'UPI') }
        ]);
    }, []);

    const confirmPayment = async (tenant, amount, mode) => {
        try {
            setLoading(true);
            await markPaidManual(tenant.Phone, tenant.Name, amount, mode);
            // Trigger local system notification
            await notifyPaymentReceived(tenant.Name, tenant.Room, amount, mode);
            Alert.alert('✅ Payment Verified!', `${tenant.Name} marked PAID via ${mode}\n💰 ₹${amount}`, [
                { text: 'Close', onPress: () => fetchTenants() },
                {
                    text: '📄 View Receipt', onPress: async () => {
                        try {
                            const result = await generateInvoice(tenant.Phone, tenant.Name);
                            if (result?.url) navigation.navigate('PDFViewer', { url: `https://stayflow-hnm3.onrender.com${result.url}`, title: `Receipt: ${tenant.Name}` });
                        } catch (e) { Alert.alert('Error', 'Could not load receipt'); }
                        fetchTenants();
                    }
                }
            ]);
        } catch (e) {
            Alert.alert('Error', 'Failed: ' + (e?.response?.data?.error || e.message));
        } finally { setLoading(false); }
    };

    const handleDelete = useCallback((tenant) => {
        Alert.alert('Remove Resident', `Remove ${tenant.Name}? This cannot be undone.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove', style: 'destructive', onPress: async () => {
                    try { setLoading(true); await deleteTenant(tenant.Phone, tenant.Name); Alert.alert('Success', 'Removed'); fetchTenants(); }
                    catch (e) { Alert.alert('Error', 'Failed to remove'); }
                    finally { setLoading(false); }
                }
            }
        ]);
    }, [fetchTenants]);

    const renderItem = useCallback(({ item, index }) => (
        <ResidentItem
            item={item}
            onNotify={handleNotify}
            onMarkPaid={handleMarkPaid}
            onDelete={handleDelete}
            onViewInvoice={handleViewInvoice}
            index={index}
        />
    ), [handleNotify, handleMarkPaid, handleDelete, handleViewInvoice]);

    const keyExtractor = useCallback((item, index) => (item.Phone || '') + index, []);

    return (
        <View style={styles.container}>
            <Header title="Residents" />

            <Animated.View style={[styles.topBar, { opacity: searchAnim, transform: [{ translateY: searchSlide }] }]}>
                <View style={styles.searchBox}>
                    <Search size={18} color={Colors.textMuted} />
                    <TextInput
                        placeholder="Search name, room, phone..."
                        placeholderTextColor={Colors.textMuted}
                        style={styles.searchInput}
                        value={search}
                        onChangeText={handleSearch}
                    />
                </View>
                <TouchableOpacity style={styles.notifyAllButton} onPress={handleNotifyAll} disabled={notifyingAll} activeOpacity={0.85}>
                    <LinearGradient colors={Gradients.primary} style={styles.notifyAllGradient}>
                        {notifyingAll ? <ActivityIndicator color="#fff" size="small" /> : (
                            <>
                                <Send size={14} color="#fff" />
                                <Text style={styles.notifyAllText}>Notify All</Text>
                            </>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            </Animated.View>

            {loading ? (
                <LoadingSkeleton />
            ) : (
                <FlatList
                    data={filteredTenants}
                    keyExtractor={keyExtractor}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchTenants} colors={[Colors.primary]} tintColor={Colors.primary} progressBackgroundColor={Colors.surface} />}
                    ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>No residents found.</Text></View>}
                    showsVerticalScrollIndicator={false}
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={8}
                    windowSize={5}
                    initialNumToRender={8}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    topBar: { flexDirection: 'row', paddingHorizontal: Spacing.md, marginBottom: Spacing.sm, gap: 8, alignItems: 'center' },
    searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, height: 48, borderWidth: 1, borderColor: Colors.border },
    searchInput: { flex: 1, marginLeft: Spacing.sm, ...Typography.body, color: Colors.text },
    notifyAllButton: { borderRadius: BorderRadius.md, overflow: 'hidden', height: 48 },
    notifyAllGradient: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, height: '100%', justifyContent: 'center' },
    notifyAllText: { color: '#fff', ...Typography.caption, fontWeight: 'bold' },
    listContent: { padding: Spacing.md, paddingBottom: Spacing.xxl },
    card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    nameContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    avatarSmall: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    avatarChar: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
    nameText: { ...Typography.h4, color: Colors.text },
    roomText: { ...Typography.caption, color: Colors.textSecondary, marginTop: 1 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    statusText: { ...Typography.tiny, textTransform: 'uppercase' },
    breakdownRow: { flexDirection: 'row', backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.sm, padding: 10, marginBottom: 10, alignItems: 'center' },
    breakdownItem: { flex: 1, alignItems: 'center' },
    breakdownDivider: { width: 1, height: 24, backgroundColor: Colors.border },
    breakdownLabel: { ...Typography.tiny, color: Colors.textMuted, textTransform: 'uppercase', marginBottom: 3 },
    breakdownValue: { ...Typography.caption, color: Colors.text, fontWeight: '600' },
    cardFooter: { paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
    actionButtons: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
    iconButton: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { padding: Spacing.xl, alignItems: 'center' },
    emptyText: { ...Typography.body, color: Colors.textSecondary },
});

export default Residents;

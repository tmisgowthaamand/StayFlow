import React, { useEffect, useState, useCallback, memo, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Modal, TextInput, Alert, ActivityIndicator, Animated, Easing } from 'react-native';
import { Colors, Spacing, Shadows, Typography, BorderRadius, Gradients } from '../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import { getTenants, updateTenant, notifyTenant } from '../api/api';
import { Home, Zap, User, X } from 'lucide-react-native';
import { usePressAnimation, useFadeSlideIn, SkeletonCard } from '../utils/animations';
import { notifyEBSplit } from '../utils/notifications';

// ─── Animated Room Card ────────────────────────────────────────
const RoomCard = memo(({ item, index, onSplitPress }) => {
    const occupancyPct = item.sharingType > 0 ? (item.occupants.length / item.sharingType) * 100 : 0;
    const isFull = item.occupants.length >= item.sharingType;
    const { scaleStyle, onPressIn, onPressOut } = usePressAnimation(0.97);

    // Entrance animation
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(24)).current;
    useEffect(() => {
        const delay = Math.min(index * 70, 500);
        setTimeout(() => {
            Animated.parallel([
                Animated.timing(opacity, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                Animated.timing(translateY, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            ]).start();
        }, delay);
    }, []);

    // Occupancy bar animation
    const barWidth = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        setTimeout(() => {
            Animated.timing(barWidth, {
                toValue: Math.min(occupancyPct, 100),
                duration: 800,
                delay: 300 + index * 70,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: false,
            }).start();
        }, 200);
    }, [occupancyPct]);

    return (
        <Animated.View
            style={[styles.card, Shadows.sm, scaleStyle, { opacity, transform: [...scaleStyle.transform, { translateY }] }]}
            onTouchStart={onPressIn}
            onTouchEnd={onPressOut}
            onTouchCancel={onPressOut}
        >
            <View style={styles.cardHeader}>
                <View style={styles.roomBadge}>
                    <LinearGradient colors={isFull ? Gradients.secondary : Gradients.purple} style={styles.roomIconBg}>
                        <Home size={14} color="#fff" />
                    </LinearGradient>
                    <Text style={styles.roomText}>Room {item.room}</Text>
                    <View style={styles.capacityBadge}>
                        <User size={10} color={Colors.textMuted} />
                        <Text style={styles.capacityText}>{item.occupants.length}/{item.sharingType || '?'}</Text>
                    </View>
                </View>
                <TouchableOpacity onPress={() => onSplitPress(item)} activeOpacity={0.8}>
                    <LinearGradient colors={Gradients.purple} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.splitButton}>
                        <Zap size={12} color="#fff" />
                        <Text style={styles.splitButtonText}>Split EB</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            {/* Animated occupancy bar */}
            <View style={styles.occupancyBarBg}>
                <Animated.View style={[styles.occupancyBarFillWrap, { width: barWidth.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]}>
                    <LinearGradient colors={isFull ? Gradients.secondary : Gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.occupancyBarFill} />
                </Animated.View>
            </View>

            {item.occupants.length > 0 && (
                <View style={styles.roomTotals}>
                    <View style={styles.totalItem}>
                        <Text style={styles.totalLabel}>Rent</Text>
                        <Text style={styles.totalValue}>₹{item.totalRent.toLocaleString()}</Text>
                    </View>
                    <View style={styles.totalDivider} />
                    <View style={styles.totalItem}>
                        <Text style={styles.totalLabel}>EB</Text>
                        <Text style={[styles.totalValue, { color: '#8B5CF6' }]}>₹{item.totalEb.toLocaleString()}</Text>
                    </View>
                </View>
            )}

            <View style={styles.divider} />

            <View style={styles.occupantsList}>
                {item.occupants.length > 0 ? (
                    item.occupants.map((occ, idx) => {
                        const isPaid = occ.Status === 'PAID' || occ.Status === 'VALID';
                        return (
                            <View key={idx} style={styles.occupantRow}>
                                <View style={styles.occupantInfo}>
                                    <View style={[styles.occDot, { backgroundColor: isPaid ? Colors.success : Colors.warning }]} />
                                    <Text style={styles.occupantName}>{occ.Name}</Text>
                                </View>
                                <View style={styles.occupantRight}>
                                    <Text style={styles.ebAmountText}>₹{occ['EB Amount'] || '0'}</Text>
                                    <View style={[styles.miniStatusBadge, { backgroundColor: isPaid ? Colors.successBg : Colors.warningBg }]}>
                                        <Text style={[styles.miniStatusText, { color: isPaid ? Colors.success : Colors.warning }]}>{isPaid ? 'PAID' : 'DUE'}</Text>
                                    </View>
                                </View>
                            </View>
                        );
                    })
                ) : (
                    <View style={styles.vacantBadge}>
                        <Text style={styles.vacantText}>🏠 Vacant Room</Text>
                    </View>
                )}
            </View>
        </Animated.View>
    );
});

// ─── Main Screen ───────────────────────────────────────────────
const Rooms = ({ navigation }) => {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [ebInput, setEbInput] = useState('');
    const [processing, setProcessing] = useState(false);

    // Modal animation
    const modalScale = useRef(new Animated.Value(0.9)).current;
    const modalOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (selectedRoom) {
            Animated.parallel([
                Animated.spring(modalScale, { toValue: 1, friction: 7, tension: 50, useNativeDriver: true }),
                Animated.timing(modalOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
            ]).start();
        } else {
            modalScale.setValue(0.9);
            modalOpacity.setValue(0);
        }
    }, [selectedRoom]);

    const fetchRooms = useCallback(async () => {
        try {
            setLoading(true);
            const tenants = await getTenants();
            const grouped = tenants.reduce((acc, t) => {
                const room = t.Room || 'Unassigned';
                if (!acc[room]) acc[room] = { room, occupants: [], totalRent: 0, totalEb: 0, sharingType: parseInt(t['Sharing Type'] || '0') };
                const currentSharing = parseInt(t['Sharing Type'] || '0');
                if (currentSharing > acc[room].sharingType) acc[room].sharingType = currentSharing;
                if (t.Status !== 'VACATED') {
                    acc[room].occupants.push(t);
                    acc[room].totalRent += parseFloat(t['Monthly Rent'] || 0);
                    acc[room].totalEb += parseFloat(t['EB Amount'] || 0);
                }
                return acc;
            }, {});
            setRooms(Object.values(grouped).sort((a, b) => a.room.localeCompare(b.room, undefined, { numeric: true })));
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchRooms(); }, []);

    const handleSplitEB = async () => {
        if (!ebInput || isNaN(ebInput) || parseFloat(ebInput) < 0) { Alert.alert('Invalid Input', 'Please enter valid units consumed'); return; }
        const units = parseFloat(ebInput), rate = 15, totalBill = units * rate, count = selectedRoom.occupants.length;
        if (count === 0) { Alert.alert('Error', 'No active residents in this room.'); return; }
        const perPerson = Math.ceil(totalBill / count);
        const namesList = selectedRoom.occupants.map(o => o.Name).join(', ');
        Alert.alert('Confirm EB Split', `⚡ ${units} × ₹${rate}/unit\n💰 Total: ₹${totalBill}\n👥 ${count} residents (${namesList})\n📊 Per Person: ₹${perPerson}`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Split & Notify', onPress: async () => {
                    try {
                        setProcessing(true);
                        let updated = 0, notified = 0; const errors = [];
                        for (const occ of selectedRoom.occupants) {
                            try {
                                await updateTenant({ oldPhone: occ.Phone, oldName: occ.Name, phone: occ.Phone, name: occ.Name, room: (occ.Room || selectedRoom.room || '').toString(), rent: (occ['Monthly Rent'] || '0').toString(), eb: perPerson.toString(), sharingType: (occ['Sharing Type'] || '').toString(), location: occ.Location || 'Main Branch' });
                                updated++;
                            } catch (e) { errors.push(`Update ${occ.Name}: ${e.message}`); }
                            try { await notifyTenant(occ.Phone, occ.Name); notified++; } catch (e) { errors.push(`Notify ${occ.Name}: ${e.message}`); }
                        }
                        let msg = `✅ EB Split Complete!\n\n⚡ ₹${perPerson}/person\n📊 Updated: ${updated}/${count}\n📱 Notified: ${notified}/${count}`;
                        if (errors.length > 0) msg += `\n\n⚠️ Issues:\n${errors.join('\n')}`;
                        else await notifyEBSplit(selectedRoom.room, perPerson, count);

                        Alert.alert(errors.length > 0 ? 'Partial Success' : 'Success', msg);
                        setEbInput(''); setSelectedRoom(null); fetchRooms();
                    } catch (e) { Alert.alert('Error', e.message); }
                    finally { setProcessing(false); }
                }
            }
        ]);
    };

    const renderItem = useCallback(({ item, index }) => (
        <RoomCard item={item} index={index} onSplitPress={setSelectedRoom} />
    ), []);

    return (
        <View style={styles.container}>
            <Header title="Rooms Map" />
            {loading ? (
                <View style={styles.listContent}>
                    <SkeletonCard lines={3} />
                    <SkeletonCard lines={3} />
                    <SkeletonCard lines={3} />
                    <SkeletonCard lines={3} />
                </View>
            ) : (
                <FlatList
                    data={rooms}
                    keyExtractor={(item) => item.room}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchRooms} colors={[Colors.primary]} tintColor={Colors.primary} progressBackgroundColor={Colors.surface} />}
                    showsVerticalScrollIndicator={false}
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={6}
                    windowSize={5}
                />
            )}

            {/* Animated Modal */}
            <Modal visible={!!selectedRoom} transparent animationType="none">
                <Animated.View style={[styles.modalOverlay, { opacity: modalOpacity }]}>
                    <Animated.View style={[styles.modalContent, { transform: [{ scale: modalScale }] }]}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Split EB Bill</Text>
                                <Text style={styles.modalSubtitle}>Room {selectedRoom?.room}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setSelectedRoom(null)} style={styles.modalClose}>
                                <X size={20} color={Colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.inputLabel}>Total Units Consumed (₹15/unit)</Text>
                        <View style={styles.modalInputContainer}>
                            <Zap size={18} color={Colors.primary} />
                            <TextInput style={styles.modalInput} placeholder="e.g. 100" placeholderTextColor={Colors.textMuted} keyboardType="numeric" value={ebInput} onChangeText={setEbInput} autoFocus />
                            <Text style={styles.unitLabel}>units</Text>
                        </View>

                        {ebInput && !isNaN(ebInput) && selectedRoom?.occupants?.length > 0 && (
                            <View style={styles.previewCard}>
                                <Text style={styles.previewTitle}>Preview</Text>
                                <Text style={styles.previewText}>Total: ₹{(parseFloat(ebInput) * 15).toLocaleString()}</Text>
                                <Text style={styles.previewText}>Per person: ₹{Math.ceil((parseFloat(ebInput) * 15) / selectedRoom.occupants.length).toLocaleString()}</Text>
                            </View>
                        )}

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => setSelectedRoom(null)}>
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleSplitEB} disabled={processing} activeOpacity={0.85}>
                                <LinearGradient colors={Gradients.purple} style={styles.confirmButton}>
                                    {processing ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmButtonText}>Split Now</Text>}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </Animated.View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    listContent: { padding: Spacing.md, paddingBottom: Spacing.xxl },
    card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    roomBadge: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    roomIconBg: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    roomText: { ...Typography.h4, color: Colors.text },
    capacityBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceElevated, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, gap: 3 },
    capacityText: { ...Typography.tiny, color: Colors.textSecondary },
    splitButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, gap: 4 },
    splitButtonText: { color: '#fff', ...Typography.tiny },
    occupancyBarBg: { height: 4, backgroundColor: 'rgba(148,163,184,0.1)', borderRadius: 2, overflow: 'hidden', marginBottom: 10 },
    occupancyBarFillWrap: { height: '100%' },
    occupancyBarFill: { flex: 1, borderRadius: 2 },
    roomTotals: { flexDirection: 'row', backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.sm, padding: 10, marginBottom: 6, alignItems: 'center' },
    totalItem: { flex: 1, alignItems: 'center' },
    totalLabel: { ...Typography.tiny, color: Colors.textMuted, textTransform: 'uppercase', marginBottom: 2 },
    totalValue: { ...Typography.caption, color: Colors.text, fontWeight: '700' },
    totalDivider: { width: 1, height: 20, backgroundColor: Colors.border },
    divider: { height: 1, backgroundColor: Colors.border, marginVertical: 8 },
    occupantsList: { gap: 8 },
    occupantRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    occupantInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    occDot: { width: 6, height: 6, borderRadius: 3 },
    occupantName: { ...Typography.body, color: Colors.text },
    occupantRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    ebAmountText: { ...Typography.caption, color: '#8B5CF6', fontWeight: '600' },
    miniStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    miniStatusText: { ...Typography.tiny },
    vacantBadge: { padding: 10, borderRadius: 8, backgroundColor: Colors.surfaceElevated, alignItems: 'center' },
    vacantText: { ...Typography.body, color: Colors.textSecondary },
    modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', padding: Spacing.lg },
    modalContent: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.lg },
    modalClose: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
    modalTitle: { ...Typography.h2, color: Colors.text },
    modalSubtitle: { ...Typography.caption, color: Colors.primary, marginTop: 2 },
    inputLabel: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 8 },
    modalInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, paddingHorizontal: 14, height: 52, marginBottom: Spacing.md, gap: 10 },
    modalInput: { flex: 1, ...Typography.h3, color: Colors.text },
    unitLabel: { ...Typography.caption, color: Colors.textMuted },
    previewCard: { backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.sm, padding: 12, marginBottom: Spacing.lg, borderLeftWidth: 3, borderLeftColor: Colors.primary },
    previewTitle: { ...Typography.tiny, color: Colors.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
    previewText: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
    modalActions: { flexDirection: 'row', gap: 12 },
    cancelButton: { flex: 1, padding: 14, borderRadius: BorderRadius.md, backgroundColor: Colors.surfaceElevated, alignItems: 'center' },
    cancelButtonText: { ...Typography.bodyBold, color: Colors.text },
    confirmButton: { flex: 1, padding: 14, borderRadius: BorderRadius.md, alignItems: 'center', minWidth: 130 },
    confirmButtonText: { color: '#fff', ...Typography.bodyBold },
});

export default Rooms;

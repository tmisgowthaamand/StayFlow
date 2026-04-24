import React, { useEffect, useState, useCallback, memo, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Modal, TextInput, Alert, ActivityIndicator, Animated, Easing as RNEasing, Linking, ScrollView } from 'react-native';
import { Colors, Spacing, Shadows, Typography, BorderRadius, Gradients } from '../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import { useNavigation } from '@react-navigation/native';
import { getTenants, updateTenant, notifyTenant, sendReminder } from '../api/api';
import { Home, Zap, User, X, Users, ArrowRight, LayoutGrid, Bell, CheckCircle, Phone, AlertCircle } from 'lucide-react-native';
import { usePressAnimation, useFadeSlideIn, SkeletonCard, AnimatedListItem } from '../utils/animations';
import { notifyEBSplit } from '../utils/notifications';
import { useLanguage } from '../context/LanguageContext';

// ─── Color helpers ─────────────────────────────────────────────
const getRoomColor = (occupants, totalBeds) => {
    if (occupants.length === 0) return { gradient: ['rgba(239, 68, 68, 0.15)', 'rgba(239, 68, 68, 0.03)'], border: 'rgba(239, 68, 68, 0.3)', dot: Colors.danger, label: 'VACANT' };
    const hasOverdue = occupants.some(o => o.Status !== 'PAID' && o.Status !== 'VALID');
    if (hasOverdue && new Date().getDate() >= 11) return { gradient: ['rgba(37, 99, 235, 0.15)', 'rgba(37, 99, 235, 0.03)'], border: 'rgba(37, 99, 235, 0.3)', dot: Colors.accentAlt, label: 'OVERDUE' };
    if (occupants.length < totalBeds) return { gradient: ['rgba(245, 158, 11, 0.15)', 'rgba(245, 158, 11, 0.03)'], border: 'rgba(245, 158, 11, 0.3)', dot: Colors.warning, label: 'PARTIAL' };
    return { gradient: ['rgba(16, 185, 129, 0.15)', 'rgba(16, 185, 129, 0.03)'], border: 'rgba(16, 185, 129, 0.3)', dot: Colors.success, label: 'FULL' };
};

// ─── Premium Room Card ─────────────────────────────────────────
const RoomCard = memo(({ item, index, onSplitPress, onRoomPress }) => {
    const { t } = useLanguage();
    const totalBeds = parseInt(item.sharingType || 0) || 1;
    const occupants = Array.isArray(item.occupants) ? item.occupants : [];
    const occupancyPct = (occupants.length / totalBeds) * 100;
    const isFull = occupants.length >= totalBeds;
    const roomColor = getRoomColor(occupants, totalBeds);
    const { scaleStyle, onPressIn, onPressOut } = usePressAnimation(0.98);

    const barWidth = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.timing(barWidth, {
            toValue: Math.min(occupancyPct, 100),
            duration: 1000,
            delay: index * 50,
            easing: RNEasing.out(RNEasing.exp),
            useNativeDriver: false,
        }).start();
    }, [occupancyPct]);

    return (
        <AnimatedListItem index={index}>
            <TouchableOpacity activeOpacity={0.85} onPress={() => onRoomPress(item)} onPressIn={onPressIn} onPressOut={onPressOut}>
                <Animated.View style={[styles.card, scaleStyle, { borderColor: roomColor.border }]}>
                    <View style={styles.cardHeader}>
                        <View style={styles.roomIconWrap}>
                            <LinearGradient colors={roomColor.gradient} style={[styles.roomIcon, { borderWidth: 1, borderColor: roomColor.border }]}>
                                <Home size={18} color={roomColor.dot} />
                            </LinearGradient>
                        </View>
                        <View style={styles.roomText}>
                            <Text style={styles.roomName}>{t('room')} {item.room}</Text>
                            <Text style={styles.roomSub}>{occupants.length} {t('of')} {totalBeds} {t('beds_occupied')}</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.splitBtn}
                            onPress={() => onSplitPress(item)}
                        >
                            <Zap size={18} color={Colors.primary} fill={Colors.primary} />
                        </TouchableOpacity>
                        <View style={[styles.statusBadge, { borderColor: roomColor.dot, backgroundColor: `${roomColor.dot}15` }]}>
                            <Text style={[styles.statusText, { color: roomColor.dot }]}>{roomColor.label}</Text>
                        </View>
                    </View>

                    <View style={styles.progressContainer}>
                        <View style={styles.progressLabelRow}>
                            <Text style={styles.progressLabel}>{Math.round(occupancyPct)}% {t('occupied')}</Text>
                        </View>
                        <View style={styles.progressBarBg}>
                            <Animated.View style={[
                                styles.progressBarFill,
                                {
                                    width: barWidth.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
                                    backgroundColor: roomColor.dot
                                }
                            ]} />
                        </View>
                    </View>

                    <View style={styles.occupantsList}>
                        {occupants.length > 0 ? occupants.map((occ, i) => (
                            <View key={i} style={styles.residentPill}>
                                <View style={[styles.statusDot, { backgroundColor: (occ.Status === 'PAID' || occ.Status === 'VALID') ? Colors.secondary : Colors.warning }]} />
                                <Text style={styles.residentName} numberOfLines={1}>{occ.Name?.split(' ')[0]}</Text>
                            </View>
                        )) : (
                            <Text style={styles.emptyText}>{t('no_residents')}</Text>
                        )}
                    </View>
                </Animated.View>
            </TouchableOpacity>
        </AnimatedListItem>
    );
});

const Rooms = () => {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [detailRoom, setDetailRoom] = useState(null);
    const [ebInput, setEbInput] = useState('');
    const navigation = useNavigation();
    const { t } = useLanguage();

    const fetchRooms = useCallback(async () => {
        try {
            setLoading(true);
            const tenants = await getTenants();
            const grouped = tenants.reduce((acc, t) => {
                const room = t.Room || 'Unassigned';
                // Helper to parse bed count
                const getBedCount = (type) => {
                    if (!type) return 1;
                    const s = type.toString().toLowerCase();
                    if (s.includes('one') || s.includes('single')) return 1;
                    if (s.includes('two') || s.includes('double')) return 2;
                    if (s.includes('three') || s.includes('triple')) return 3;
                    if (s.includes('four')) return 4;
                    return parseInt(s) || 1;
                };

                if (!acc[room]) acc[room] = { room, occupants: [], sharingType: getBedCount(t['Sharing Type']) };
                if (t.Status !== 'VACATED') acc[room].occupants.push(t);
                return acc;
            }, {});
            setRooms(Object.values(grouped).sort());
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchRooms(); }, []);

    const handleSplit = () => {
        if (!ebInput || isNaN(ebInput) || !selectedRoom) return;
        const amount = parseFloat(ebInput);
        const count = selectedRoom.occupants.length;
        if (count === 0) return Alert.alert(t('error'), t('no_occupants'));

        const perHead = Math.ceil(amount / count);

        notifyEBSplit(selectedRoom.room, perHead, count);
        Alert.alert(t('success'), t('bill_split_success').replace('{{amount}}', perHead).replace('{{count}}', count));

        setSelectedRoom(null);
        setEbInput('');
    };

    const handleRoomPress = (room) => {
        if (room.occupants.length > 0) {
            setDetailRoom(room);
        }
    };

    const handleCallTenant = (phone) => {
        Linking.openURL(`tel:${phone}`);
    };

    const handleRemindTenant = async (tenant) => {
        try {
            await sendReminder(tenant.Phone, tenant.Name);
            Alert.alert('Sent', `Reminder sent to ${tenant.Name}`);
        } catch (e) {
            Alert.alert('Error', 'Failed to send reminder');
        }
    };

    const totalRooms = rooms.length;
    const totalBeds = rooms.reduce((acc, r) => acc + (r.sharingType || 0), 0);
    const totalOccupants = rooms.reduce((acc, r) => acc + r.occupants.length, 0);
    const loadFactor = totalBeds > 0 ? Math.round((totalOccupants / totalBeds) * 100) : 0;
    const vacantRooms = rooms.filter(r => r.occupants.length === 0).length;
    const overdueRooms = rooms.filter(r => r.occupants.some(o => o.Status !== 'PAID' && o.Status !== 'VALID') && new Date().getDate() >= 11).length;

    return (
        <View style={styles.container}>
            <Header title={t('inventory')} subtitle={t('management')} />

            <View style={styles.statsRow}>
                <LinearGradient colors={['rgba(255,255,255,0.03)', 'transparent']} style={styles.statBox}>
                    <Text style={styles.statVal}>{totalRooms}</Text>
                    <Text style={styles.statLab}>{t('rooms')}</Text>
                </LinearGradient>
                <View style={styles.statDivider} />
                <LinearGradient colors={['rgba(255,255,255,0.03)', 'transparent']} style={styles.statBox}>
                    <Text style={styles.statVal}>{totalBeds}</Text>
                    <Text style={styles.statLab}>{t('beds')}</Text>
                </LinearGradient>
                <View style={styles.statDivider} />
                <LinearGradient colors={['rgba(255,255,255,0.03)', 'transparent']} style={styles.statBox}>
                    <Text style={styles.statVal}>{loadFactor}%</Text>
                    <Text style={styles.statLab}>{t('load')}</Text>
                </LinearGradient>
            </View>

            {/* Color Legend */}
            <View style={styles.legendRow}>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.success }]} /><Text style={styles.legendText}>Full</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.warning }]} /><Text style={styles.legendText}>Partial</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.danger }]} /><Text style={styles.legendText}>Vacant ({vacantRooms})</Text></View>
                {overdueRooms > 0 && <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.accentAlt }]} /><Text style={styles.legendText}>Overdue ({overdueRooms})</Text></View>}
            </View>

            {loading ? (
                <View style={styles.listArea}><SkeletonCard /><SkeletonCard /></View>
            ) : (
                <FlatList
                    data={rooms}
                    keyExtractor={(it) => it.room}
                    renderItem={({ item, index }) => <RoomCard item={item} index={index} onSplitPress={setSelectedRoom} onRoomPress={handleRoomPress} />}
                    contentContainerStyle={styles.listArea}
                    showsVerticalScrollIndicator={false}
                />
            )}

            <Modal
                transparent={true}
                visible={!!selectedRoom}
                onRequestClose={() => setSelectedRoom(null)}
                animationType="fade"
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <View style={styles.modalIcon}>
                                <Zap size={24} color={Colors.primary} fill={Colors.primary} />
                            </View>
                            <View>
                                <Text style={styles.modalTitle}>{t('split_eb_bill')}</Text>
                                <Text style={styles.modalSub}>{t('room')} {selectedRoom?.room}</Text>
                            </View>
                        </View>

                        <Text style={styles.label}>{t('total_bill_amount')}</Text>
                        <TextInput
                            style={styles.input}
                            value={ebInput}
                            onChangeText={setEbInput}
                            placeholder="₹ 0.00"
                            placeholderTextColor={Colors.textMuted}
                            keyboardType="numeric"
                        />

                        {ebInput && !isNaN(ebInput) && selectedRoom?.occupants.length > 0 && (
                            <View style={styles.splitPreview}>
                                <Text style={styles.splitText}>
                                    {t('each_pays')}: <Text style={styles.splitAmount}>₹{Math.ceil(parseFloat(ebInput) / selectedRoom.occupants.length)}</Text>
                                </Text>
                            </View>
                        )}

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => setSelectedRoom(null)}>
                                <Text style={styles.btnTextCancel}>{t('cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.btn, styles.btnConfirm]} onPress={handleSplit}>
                                <Text style={styles.btnTextConfirm}>{t('confirm_split')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            {/* Room Detail Bottom Sheet */}
            <Modal
                transparent={true}
                visible={!!detailRoom}
                onRequestClose={() => setDetailRoom(null)}
                animationType="slide"
            >
                <View style={styles.detailOverlay}>
                    <TouchableOpacity activeOpacity={1} style={styles.detailBackdrop} onPress={() => setDetailRoom(null)} />
                    <View style={styles.detailSheet}>
                        <View style={styles.detailHandle} />
                        <View style={styles.detailHeader}>
                            <View style={styles.detailRoomIcon}>
                                <Home size={22} color={Colors.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.detailTitle}>{t('room')} {detailRoom?.room}</Text>
                                <Text style={styles.detailSub}>{detailRoom?.occupants?.length || 0} {t('of')} {detailRoom?.sharingType || 1} {t('beds_occupied')}</Text>
                            </View>
                            <TouchableOpacity style={styles.detailCloseBtn} onPress={() => setDetailRoom(null)}>
                                <X size={18} color={Colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                            {detailRoom?.occupants?.map((occ, i) => {
                                const isPaid = occ.Status === 'PAID' || occ.Status === 'VALID';
                                const total = parseFloat((occ['Total Amount'] || occ['Monthly Rent'] || '0').toString().replace(/[^\d.]/g, ''));
                                return (
                                    <View key={i} style={styles.detailTenantRow}>
                                        <View style={styles.detailTenantAvatar}>
                                            <LinearGradient colors={isPaid ? Gradients.secondary : Gradients.accent} style={styles.avatarInner}>
                                                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>{occ.Name?.[0]}</Text>
                                            </LinearGradient>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.detailTenantName}>{occ.Name}</Text>
                                            <Text style={styles.detailTenantSub}>₹{total} • {occ.Phone}</Text>
                                            <View style={[styles.detailStatusBadge, { backgroundColor: isPaid ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)' }]}>
                                                <Text style={[styles.detailStatusText, { color: isPaid ? Colors.success : Colors.accent }]}>
                                                    {isPaid ? '✓ PAID' : '✗ UNPAID'}
                                                </Text>
                                                {isPaid && occ['Paid Date'] && (
                                                    <Text style={{ fontSize: 9, color: Colors.success, fontWeight: '600' }}> • {occ['Paid Date']}</Text>
                                                )}
                                            </View>
                                        </View>
                                        <View style={styles.detailActions}>
                                            <TouchableOpacity style={styles.detailActionBtn} onPress={() => handleCallTenant(occ.Phone)}>
                                                <Phone size={14} color={Colors.secondary} />
                                            </TouchableOpacity>
                                            {!isPaid && (
                                                <TouchableOpacity style={[styles.detailActionBtn, { borderColor: 'rgba(244,63,94,0.3)' }]} onPress={() => handleRemindTenant(occ)}>
                                                    <Bell size={14} color={Colors.accent} />
                                                </TouchableOpacity>
                                            )}
                                            <TouchableOpacity style={[styles.detailActionBtn, { borderColor: 'rgba(124,58,237,0.3)' }]} onPress={() => { setDetailRoom(null); navigation.navigate('EditTenant', { tenant: occ }); }}>
                                                <User size={14} color={Colors.primary} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },

    // Stats
    statsRow: { flexDirection: 'row', margin: Spacing.md, backgroundColor: Colors.backgroundAlt, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
    statBox: { flex: 1, paddingVertical: 18, alignItems: 'center' },
    statVal: { ...Typography.h3, color: Colors.text },
    statLab: { ...Typography.tiny, color: Colors.textSecondary, marginTop: 4 },
    statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 15 },

    // List
    listArea: { paddingHorizontal: Spacing.md, paddingBottom: 100 },

    // Card
    card: {
        backgroundColor: Colors.backgroundAlt,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Colors.border
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    roomIconWrap: { width: 44, height: 44, marginRight: 12 },
    roomIcon: { flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    roomText: { flex: 1 },
    roomName: { ...Typography.bodyBold, color: Colors.text, fontSize: 17 },
    roomSub: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 2 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
    statusText: { ...Typography.tiny, fontSize: 9 },

    // Progress
    progressContainer: { marginBottom: 16 },
    progressLabelRow: { marginBottom: 8 },
    progressLabel: { ...Typography.tiny, color: Colors.textSecondary, fontSize: 9 },
    progressBarBg: { height: 6, backgroundColor: Colors.surface, borderRadius: 3, overflow: 'hidden' },
    progressBarFill: { height: '100%', borderRadius: 3 },

    // Residents
    occupantsList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    residentPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.border,
        maxWidth: '46%'
    },
    statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
    residentName: { ...Typography.bodySmall, color: Colors.textSecondary, fontWeight: '700' },
    emptyText: { ...Typography.bodySmall, color: Colors.textMuted, fontStyle: 'italic' },

    // Split Button
    splitBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(124, 58, 237, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
        borderWidth: 1,
        borderColor: 'rgba(124, 58, 237, 0.2)'
    },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: Spacing.lg },
    modalContainer: { backgroundColor: Colors.backgroundAlt, borderRadius: BorderRadius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
    modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing.lg },
    modalIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(124, 58, 237, 0.1)', alignItems: 'center', justifyContent: 'center' },
    modalTitle: { ...Typography.h3, color: Colors.text },
    modalSub: { ...Typography.body, color: Colors.textMuted },
    label: { ...Typography.tiny, color: Colors.textSecondary, marginBottom: 8 },
    input: {
        backgroundColor: Colors.background,
        borderRadius: BorderRadius.md,
        padding: 12,
        color: Colors.text,
        fontSize: 18,
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: Spacing.lg
    },
    splitPreview: {
        backgroundColor: Colors.surface,
        padding: 12,
        borderRadius: BorderRadius.md,
        marginBottom: Spacing.lg,
        alignItems: 'center'
    },
    splitText: { ...Typography.body, color: Colors.textMuted },
    splitAmount: { ...Typography.bodyBold, color: Colors.primary, fontSize: 18 },
    modalActions: { flexDirection: 'row', gap: 12 },
    btn: { flex: 1, padding: 14, borderRadius: BorderRadius.md, alignItems: 'center' },
    btnCancel: { backgroundColor: Colors.surface },
    btnConfirm: { backgroundColor: Colors.primary },
    btnTextCancel: { ...Typography.bodyBold, color: Colors.textMuted },
    btnTextConfirm: { ...Typography.bodyBold, color: '#fff' },

    // Color Legend
    legendRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 14,
        marginHorizontal: Spacing.md,
        marginBottom: Spacing.sm,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: Colors.backgroundAlt,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { ...Typography.tiny, color: Colors.textMuted, fontSize: 9 },

    // Detail Bottom Sheet
    detailOverlay: { flex: 1, justifyContent: 'flex-end' },
    detailBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)' },
    detailSheet: {
        backgroundColor: Colors.backgroundAlt,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: Spacing.lg,
        paddingBottom: 40,
        borderWidth: 1,
        borderColor: Colors.border,
        borderBottomWidth: 0,
    },
    detailHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: Colors.textMuted,
        alignSelf: 'center',
        marginBottom: Spacing.md,
        opacity: 0.4,
    },
    detailHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        marginBottom: Spacing.lg,
    },
    detailRoomIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: 'rgba(124, 58, 237, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(124, 58, 237, 0.2)',
    },
    detailTitle: { ...Typography.h3, color: Colors.text },
    detailSub: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 2 },
    detailCloseBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: Colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    detailTenantRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    detailTenantAvatar: { width: 38, height: 38, marginRight: 12 },
    detailTenantName: { ...Typography.bodyBold, color: Colors.text, fontSize: 14 },
    detailTenantSub: { ...Typography.bodySmall, color: Colors.textMuted, fontSize: 11, marginTop: 2 },
    detailStatusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        marginTop: 4,
    },
    detailStatusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
    detailActions: { flexDirection: 'column', gap: 6 },
    detailActionBtn: {
        width: 32,
        height: 32,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.3)',
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
});

export default Rooms;

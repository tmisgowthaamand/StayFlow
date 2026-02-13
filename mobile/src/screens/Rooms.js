import React, { useEffect, useState, useCallback, memo, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Modal, TextInput, Alert, ActivityIndicator, Animated, Easing as RNEasing } from 'react-native';
import { Colors, Spacing, Shadows, Typography, BorderRadius, Gradients } from '../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import { useNavigation } from '@react-navigation/native';
import { getTenants, updateTenant, notifyTenant } from '../api/api';
import { Home, Zap, User, X, Users, ArrowRight, LayoutGrid } from 'lucide-react-native';
import { usePressAnimation, useFadeSlideIn, SkeletonCard, AnimatedListItem } from '../utils/animations';
import { notifyEBSplit } from '../utils/notifications';
import { useLanguage } from '../context/LanguageContext';

// ─── Premium Room Card ─────────────────────────────────────────
const RoomCard = memo(({ item, index, onSplitPress }) => {
    const { t } = useLanguage();
    const totalBeds = parseInt(item.sharingType || 0) || 1; // Fallback to 1 to avoid NaN
    const occupants = Array.isArray(item.occupants) ? item.occupants : [];
    const occupancyPct = (occupants.length / totalBeds) * 100;
    const isFull = occupants.length >= totalBeds;
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
            <Animated.View style={[styles.card, scaleStyle]} onTouchStart={onPressIn} onTouchEnd={onPressOut} onTouchCancel={onPressOut}>
                <View style={styles.cardHeader}>
                    <View style={styles.roomIconWrap}>
                        <LinearGradient colors={isFull ? Gradients.accent : Gradients.primary} style={styles.roomIcon}>
                            <Home size={18} color="#fff" />
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
                    <View style={[styles.statusBadge, { borderColor: isFull ? Colors.danger : Colors.secondary }]}>
                        <Text style={[styles.statusText, { color: isFull ? Colors.danger : Colors.secondary }]}>{isFull ? t('full') : t('vacant')}</Text>
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
                                backgroundColor: isFull ? Colors.accent : Colors.primary
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
        </AnimatedListItem>
    );
});

const Rooms = () => {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRoom, setSelectedRoom] = useState(null);
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

    const totalRooms = rooms.length;
    const totalBeds = rooms.reduce((acc, r) => acc + (r.sharingType || 0), 0);
    const totalOccupants = rooms.reduce((acc, r) => acc + r.occupants.length, 0);
    const loadFactor = totalBeds > 0 ? Math.round((totalOccupants / totalBeds) * 100) : 0;

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

            {loading ? (
                <View style={styles.listArea}><SkeletonCard /><SkeletonCard /></View>
            ) : (
                <FlatList
                    data={rooms}
                    keyExtractor={(it) => it.room}
                    renderItem={({ item, index }) => <RoomCard item={item} index={index} onSplitPress={setSelectedRoom} />}
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
});

export default Rooms;

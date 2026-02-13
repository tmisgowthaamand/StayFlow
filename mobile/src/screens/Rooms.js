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

// ─── Premium Room Card ─────────────────────────────────────────
const RoomCard = memo(({ item, index, onSplitPress }) => {
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
                        <Text style={styles.roomName}>Room {item.room}</Text>
                        <Text style={styles.roomSub}>{occupants.length} of {totalBeds} beds occupied</Text>
                    </View>
                    <View style={[styles.statusBadge, { borderColor: isFull ? Colors.danger : Colors.secondary }]}>
                        <Text style={[styles.statusText, { color: isFull ? Colors.danger : Colors.secondary }]}>{isFull ? 'FULL' : 'VACANT'}</Text>
                    </View>
                </View>

                <View style={styles.progressContainer}>
                    <View style={styles.progressLabelRow}>
                        <Text style={styles.progressLabel}>{Math.round(occupancyPct)}% OCCUPIED</Text>
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
                        <Text style={styles.emptyText}>No residents currently</Text>
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

    const fetchRooms = useCallback(async () => {
        try {
            setLoading(true);
            const tenants = await getTenants();
            const grouped = tenants.reduce((acc, t) => {
                const room = t.Room || 'Unassigned';
                if (!acc[room]) acc[room] = { room, occupants: [], sharingType: parseInt(t['Sharing Type'] || '0') };
                if (t.Status !== 'VACATED') acc[room].occupants.push(t);
                return acc;
            }, {});
            setRooms(Object.values(grouped).sort());
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchRooms(); }, []);

    const totalRooms = rooms.length;
    const totalBeds = rooms.reduce((acc, r) => acc + (r.sharingType || 0), 0);
    const totalOccupants = rooms.reduce((acc, r) => acc + r.occupants.length, 0);
    const loadFactor = totalBeds > 0 ? Math.round((totalOccupants / totalBeds) * 100) : 0;

    return (
        <View style={styles.container}>
            <Header title="Inventory" subtitle="Management" />

            <View style={styles.statsRow}>
                <LinearGradient colors={['rgba(255,255,255,0.03)', 'transparent']} style={styles.statBox}>
                    <Text style={styles.statVal}>{totalRooms}</Text>
                    <Text style={styles.statLab}>ROOMS</Text>
                </LinearGradient>
                <View style={styles.statDivider} />
                <LinearGradient colors={['rgba(255,255,255,0.03)', 'transparent']} style={styles.statBox}>
                    <Text style={styles.statVal}>{loadFactor}%</Text>
                    <Text style={styles.statLab}>LOAD</Text>
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
});

export default Rooms;

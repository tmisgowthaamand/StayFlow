import React, { useEffect, useState, useCallback, memo, useRef, useMemo } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, Text, TouchableOpacity, Animated, Dimensions, Alert, Modal, Platform } from 'react-native';
import { Colors, Spacing, Shadows, Typography, BorderRadius, Gradients } from '../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import StatCard from '../components/StatCard';
import { getDashboardStats, getTenants } from '../api/api';
import {
    Wallet, Users, Home, TrendingUp, Zap,
    ArrowUpRight, Plus, Activity, LayoutGrid,
    Calendar, Bell, Menu, Search, ChevronRight,
    Settings, LogOut, Info, ShieldCheck, User, X,
    CreditCard, Megaphone, AlertCircle, Clock, MapPin
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import {
    useFadeSlideIn, usePressAnimation, AnimatedListItem,
    SkeletonCard, useMeshFloat, useGlowPulse, DecryptedText, SplitText
} from '../utils/animations';
import { useLanguage } from '../context/LanguageContext';
// ─── Main Dashboard ─────────────────────────────────────────────
const ActivityItem = memo(({ item, index }) => {
    const isPaid = item.Status === 'PAID' || item.Status === 'VALID';
    const anim = useFadeSlideIn(400 + index * 60, 600, 15);

    return (
        <Animated.View style={[styles.activityRow, anim]}>
            <View style={styles.activityAvatar}>
                <LinearGradient colors={isPaid ? Gradients.secondary : Gradients.primary} style={styles.avatarInner}>
                    <Text style={styles.avatarLetter}>{item.Name?.[0]}</Text>
                </LinearGradient>
            </View>
            <View style={styles.activityMain}>
                <Text style={styles.activityName}>{item.Name}</Text>
                <Text style={styles.activitySub}>Room {item.Room} • {isPaid ? 'Payment Confirmed' : 'Payment Overdue'}</Text>
            </View>
            <View style={styles.activityPrice}>
                <Text style={[styles.priceText, { color: isPaid ? Colors.success : Colors.accent }]}>
                    {isPaid ? '✓' : '₹' + item['Monthly Rent']}
                </Text>
            </View>
        </Animated.View>
    );
});

const Dashboard = () => {
    const [stats, setStats] = useState(null);
    const [tenants, setTenants] = useState([]);
    const [isAdmin, setIsAdmin] = useState(true);
    const [isMenuVisible, setIsMenuVisible] = useState(false);
    const menuAnim = useRef(new Animated.Value(-Dimensions.get('window').width)).current;
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const navigation = useNavigation();
    const { t } = useLanguage();

    const fetchAllData = useCallback(async () => {
        try {
            const [s, t] = await Promise.all([getDashboardStats(), getTenants()]);
            setStats(s);
            setTenants(Array.isArray(t) ? t : []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); setRefreshing(false); }
    }, []);

    useEffect(() => { fetchAllData(); }, []);

    const onRefresh = () => { setRefreshing(true); fetchAllData(); };

    const active = tenants.filter(t => t.Status !== 'VACATED');

    // ─── StayFlow Smart AI Search (Gemini-Inspired) ────────────────
    const filteredActivity = useMemo(() => {
        if (!searchQuery.trim()) return active.slice(0, 6);

        const query = searchQuery.toLowerCase().trim();
        return active.filter(t => {
            const name = (t.Name || '').toLowerCase();
            const room = (t.Room || '').toString().toLowerCase();
            const phone = (t.Phone || '').toString();
            const status = (t.Status || '').toLowerCase();
            const rent = (t['Monthly Rent'] || '0').toString();

            // AI Intent Parsing (Keywords)
            const matchesStatus = query === 'paid' || query === 'valid' ? (status === 'paid' || status === 'valid') :
                query === 'pending' || query === 'unpaid' ? (status === 'pending') : false;

            const matchesRoom = query.startsWith('room ') ? room === query.replace('room ', '') : room.includes(query);

            return name.includes(query) ||
                matchesRoom ||
                phone.includes(query) ||
                matchesStatus ||
                (query.includes('rent') && rent.includes(query.replace(/\D/g, '')));
        });
    }, [searchQuery, active]);

    const totalColl = active.filter(t => t.Status === 'PAID' || t.Status === 'VALID')
        .reduce((sum, t) => sum + parseFloat((t['Total Amount'] || '0').toString().replace(/[^\d.]/g, '')), 0);
    const expected = 150067; // Static override
    const pendingCount = active.filter(t => t.Status === 'PENDING').length;
    const unpaidCount = active.filter(t => t.Status === 'ACTIVE' || !t.Status).length;

    const totalBeds = active.reduce((sum, t) => {
        const type = t['Sharing Type'] || '';
        if (type.includes('One')) return sum + 1;
        if (type.includes('Two')) return sum + 2;
        if (type.includes('Three')) return sum + 3;
        if (type.includes('Four')) return sum + 4;
        return sum + 1;
    }, 0);
    const vacantBeds = totalBeds - active.length;
    const uniqueRooms = [...new Set(active.map(t => t.Room).filter(Boolean))];

    const handleMenuPress = () => {
        setIsMenuVisible(true);
        Animated.timing(menuAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
        }).start();
    };

    const closeMenu = () => {
        Animated.timing(menuAnim, {
            toValue: -Dimensions.get('window').width,
            duration: 250,
            useNativeDriver: true,
        }).start(() => setIsMenuVisible(false));
    };

    return (
        <View style={styles.container}>
            <Header
                title="StayFlow"
                onSearchChange={setSearchQuery}
                onMenuPress={handleMenuPress}
                placeholder={t('ai_placeholder')}
            />

            <ScrollView
                contentContainerStyle={styles.scrollArea}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
            >
                {/* 1. Ultra-Premium Revenue Hero */}
                <AnimatedListItem index={1}>
                    <View style={styles.heroWrapper}>
                        <LinearGradient colors={Gradients.ocean} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
                            <View style={styles.heroContent}>
                                <View style={styles.heroHeader}>
                                    <View>
                                        <Text style={styles.heroLabel}>{t('total_collected')}</Text>
                                        <Text style={styles.heroValue}>₹{totalColl.toLocaleString()}</Text>
                                    </View>
                                    <View style={styles.heroIconBubble}>
                                        <TrendingUp color="#fff" size={24} />
                                    </View>
                                </View>

                                <View style={styles.heroDivider} />

                                <View style={styles.heroStatsRow}>
                                    <View style={styles.heroStatItem}>
                                        <Text style={styles.heroStatVal}>{Math.round((totalColl / expected) * 100) || 0}%</Text>
                                        <Text style={styles.heroStatLab}>{t('progress')}</Text>
                                    </View>
                                    <View style={styles.heroStatDivider} />
                                    <View style={styles.heroStatItem}>
                                        <Text style={styles.heroStatVal}>₹{expected.toLocaleString()}</Text>
                                        <Text style={styles.heroStatLab}>{t('expected')}</Text>
                                    </View>
                                    <View style={styles.heroStatDivider} />
                                    <View style={styles.heroStatItem}>
                                        <Text style={styles.heroStatVal}>{active.length}</Text>
                                        <Text style={styles.heroStatLab}>{t('residents')}</Text>
                                    </View>
                                </View>
                            </View>
                        </LinearGradient>
                    </View>
                </AnimatedListItem>

                {/* 2. Grid Overview */}
                <View style={styles.sectionHeader}>
                    <LayoutGrid size={18} color={Colors.primary} />
                    <Text style={styles.sectionTitle}>{t('insights')}</Text>
                </View>

                <View style={styles.bentoGrid}>
                    <View style={styles.bentoRow}>
                        <StatCard
                            title={t('pending_verif')}
                            value={pendingCount.toString()}
                            icon={Clock}
                            color={Colors.accent}
                            index={2}
                            size="small"
                            onPress={() => navigation.navigate('Residents', { filter: 'PENDING' })}
                        />
                        <StatCard
                            title={t('unpaid')}
                            value={unpaidCount.toString()}
                            icon={AlertCircle}
                            color={Colors.accent}
                            index={3}
                            size="small"
                            onPress={() => navigation.navigate('Residents', { filter: 'ACTIVE' })}
                        />
                    </View>
                    <View style={styles.bentoRow}>
                        <StatCard
                            title={t('vacant_beds')}
                            value={vacantBeds > 0 ? vacantBeds.toString() : t('full')}
                            icon={MapPin}
                            color={Colors.secondary}
                            index={4}
                            size="small"
                            onPress={() => navigation.navigate('Rooms')}
                        />
                        <StatCard
                            title={t('total_rooms')}
                            value={uniqueRooms.length.toString()}
                            icon={Home}
                            color={Colors.accentAlt}
                            index={5}
                            size="small"
                            onPress={() => navigation.navigate('Rooms')}
                        />
                    </View>
                </View>

                {/* 3. Modern Actions */}
                <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Announcements')}>
                        <LinearGradient colors={['rgba(124, 58, 237, 0.1)', 'rgba(124, 58, 237, 0.02)']} style={styles.actionBtnGradient}>
                            <Megaphone size={20} color={Colors.primary} />
                            <Text style={styles.actionBtnText}>{t('announcements')}</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Rooms')}>
                        <LinearGradient colors={['rgba(37, 99, 235, 0.1)', 'rgba(37, 99, 235, 0.02)']} style={styles.actionBtnGradient}>
                            <LayoutGrid size={20} color={Colors.accentAlt} />
                            <Text style={styles.actionBtnText}>{t('rooms')}</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* 4. Activity Section */}
                <View style={styles.sectionHeader}>
                    <Activity size={18} color={Colors.primary} />
                    <Text style={styles.sectionTitle}>{searchQuery ? t('ai_search') : t('recent_activity')}</Text>
                    {searchQuery.length > 0 && (
                        <View style={styles.aiBadge}>
                            <Zap size={10} color={Colors.secondary} fill={Colors.secondary} />
                            <Text style={styles.aiBadgeText}>{t('ai_active')}</Text>
                        </View>
                    )}
                </View>

                {loading ? <SkeletonCard lines={2} /> : filteredActivity.map((item, idx) => <ActivityItem key={idx} item={item} index={idx} />)}

                <View style={{ height: 120 }} />
            </ScrollView>
            {/* ─── Premium Side Menu Modal ────────────────────────────────── */}
            <Modal
                transparent={true}
                visible={isMenuVisible}
                onRequestClose={closeMenu}
                animationType="none"
            >
                <View style={styles.menuOverlay}>
                    <TouchableOpacity
                        activeOpacity={1}
                        style={styles.menuBackdrop}
                        onPress={closeMenu}
                    />
                    <Animated.View style={[styles.menuContainer, { transform: [{ translateX: menuAnim }] }]}>
                        <LinearGradient
                            colors={[Colors.backgroundAlt, Colors.background]}
                            style={styles.menuGradient}
                        >
                            <View style={styles.menuHeader}>
                                <View style={styles.menuUserSection}>
                                    <View style={styles.menuAvatar}>
                                        <LinearGradient
                                            colors={Gradients.primary}
                                            style={styles.avatarInner}
                                        >
                                            <User size={24} color="#fff" />
                                        </LinearGradient>
                                    </View>
                                    <View>
                                        <Text style={styles.menuUserName}>Admin User</Text>
                                        <Text style={styles.menuUserRole}>System Administrator</Text>
                                    </View>
                                </View>
                                <TouchableOpacity onPress={closeMenu} style={styles.menuCloseBtn}>
                                    <X size={20} color={Colors.textMuted} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.menuDivider} />

                            <View style={styles.menuBody}>
                                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                                    <Text style={styles.menuSectionTitle}>{t('navigation_menu')}</Text>

                                    <TouchableOpacity style={styles.menuItem} onPress={() => { closeMenu(); navigation.navigate('Residents'); }}>
                                        <View style={styles.menuIconBox}><Users size={20} color={Colors.text} /></View>
                                        <Text style={styles.menuItemText}>{t('residents')}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity style={styles.menuItem} onPress={() => { closeMenu(); navigation.navigate('Billing'); }}>
                                        <View style={styles.menuIconBox}><CreditCard size={20} color={Colors.text} /></View>
                                        <Text style={styles.menuItemText}>{t('billing_finance')}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity style={styles.menuItem} onPress={() => { closeMenu(); navigation.navigate('Rooms'); }}>
                                        <View style={styles.menuIconBox}><LayoutGrid size={20} color={Colors.text} /></View>
                                        <Text style={styles.menuItemText}>{t('room_status')}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity style={styles.menuItem} onPress={() => { closeMenu(); navigation.navigate('Announcements'); }}>
                                        <View style={styles.menuIconBox}><Megaphone size={20} color={Colors.text} /></View>
                                        <Text style={styles.menuItemText}>{t('announcements')}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity style={styles.menuItem} onPress={() => { closeMenu(); navigation.navigate('Notifications'); }}>
                                        <View style={styles.menuIconBox}><Bell size={20} color={Colors.text} /></View>
                                        <Text style={styles.menuItemText}>{t('notifications')}</Text>
                                    </TouchableOpacity>

                                    <View style={styles.menuDivider} />
                                    <Text style={styles.menuSectionTitle}>{t('system')}</Text>

                                    <TouchableOpacity style={styles.menuItem} onPress={() => { closeMenu(); navigation.navigate('GeneralSettings'); }}>
                                        <View style={styles.menuIconBox}><Settings size={20} color={Colors.text} /></View>
                                        <Text style={styles.menuItemText}>{t('general_settings')}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert("About", "StayFlow Mobile v1.0.4")}>
                                        <View style={styles.menuIconBox}><Info size={20} color={Colors.text} /></View>
                                        <View>
                                            <Text style={styles.menuItemText}>{t('app_info')}</Text>
                                            <Text style={styles.menuItemSub}>Version 1.0.4</Text>
                                        </View>
                                    </TouchableOpacity>
                                </ScrollView>

                                <View style={styles.menuFooter}>
                                    <TouchableOpacity style={styles.logoutBtn} onPress={closeMenu}>
                                        <LogOut size={18} color={Colors.accent} />
                                        <Text style={styles.logoutText}>{t('sign_out')}</Text>
                                    </TouchableOpacity>
                                    <Text style={styles.versionTag}>Build: 2024.02.R1</Text>
                                </View>
                            </View>

                        </LinearGradient>
                    </Animated.View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    scrollArea: { padding: Spacing.md },

    // Hero Card Refined
    heroWrapper: { marginBottom: Spacing.lg, borderRadius: BorderRadius.xl, ...Shadows.glow(Colors.accentAlt, 0.2) },
    heroCard: { borderRadius: BorderRadius.xl, padding: Spacing.lg, height: 210, overflow: 'hidden' },
    heroContent: { flex: 1, justifyContent: 'space-between' },
    heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    heroLabel: { ...Typography.tiny, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
    heroValue: { ...Typography.h1, color: '#fff', fontSize: 38 },
    heroIconBubble: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 12 },
    heroStatsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: BorderRadius.md, padding: 12 },
    heroStatItem: { flex: 1, alignItems: 'center' },
    heroStatVal: { ...Typography.h3, color: '#fff', fontSize: 18 },
    heroStatLab: { ...Typography.tiny, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
    heroStatDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.1)' },

    // Sections
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: Spacing.md },
    sectionTitle: { ...Typography.caption, color: Colors.textSecondary, letterSpacing: 1.5 },
    aiBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 4,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.2)'
    },
    aiBadgeText: { ...Typography.tiny, color: Colors.secondary, fontWeight: '900', fontSize: 10 },
    bentoGrid: { marginBottom: Spacing.md },
    bentoRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
    bentoCol: { flex: 1, gap: Spacing.sm },

    // Actions
    actionRow: { flexDirection: 'row', gap: 12, marginBottom: Spacing.md },
    actionBtn: { flex: 1, borderRadius: BorderRadius.md, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
    actionBtnGradient: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    actionBtnText: { ...Typography.bodyBold, color: Colors.text },

    // Activity Items - Modern Glass List
    activityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        backgroundColor: Colors.backgroundAlt,
        borderRadius: BorderRadius.md,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: Colors.border
    },
    activityAvatar: { width: 44, height: 44, marginRight: 14 },
    avatarInner: { flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    avatarLetter: { color: '#fff', fontWeight: '900', fontSize: 18 },
    activityMain: { flex: 1 },
    activityName: { ...Typography.bodyBold, color: Colors.text },
    activitySub: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 2 },
    activityPrice: { paddingHorizontal: 10, alignItems: 'flex-end' },
    priceText: { ...Typography.bodyBold, fontSize: 16 },

    // Side Menu Styles
    menuOverlay: { flex: 1, flexDirection: 'row' },
    menuBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)' },
    menuContainer: { width: '80%', height: '100%', backgroundColor: Colors.background },
    menuGradient: { flex: 1, padding: Spacing.xl },
    menuHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: Platform.OS === 'ios' ? 40 : 20, marginBottom: Spacing.xl },
    menuUserSection: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    menuAvatar: { width: 50, height: 50, borderRadius: 15, overflow: 'hidden' },
    menuUserName: { ...Typography.h3, color: Colors.text },
    menuUserRole: { ...Typography.tiny, color: Colors.textMuted },
    menuCloseBtn: { padding: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)' },
    menuDivider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },
    menuSectionTitle: { ...Typography.tiny, color: Colors.textMuted, letterSpacing: 2, marginBottom: 10, marginTop: 10 },
    menuBody: { flex: 1, marginTop: Spacing.lg },
    menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 16 },
    menuIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
    menuItemText: { ...Typography.bodyBold, color: Colors.text },
    menuItemSub: { ...Typography.tiny, color: Colors.textMuted, marginTop: 2 },
    menuFooter: { marginTop: 'auto', paddingTop: 20, gap: 15 },
    logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255, 68, 68, 0.1)' },
    logoutText: { ...Typography.bodyBold, color: Colors.accent },
    versionTag: { ...Typography.tiny, color: Colors.textMuted, textAlign: 'center', opacity: 0.5 },
});

export default Dashboard;

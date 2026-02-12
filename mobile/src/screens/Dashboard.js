import React, { useEffect, useState, useCallback, memo } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, Text, TouchableOpacity, Animated, Easing } from 'react-native';
import { Colors, Spacing, Shadows, Typography, BorderRadius, Gradients } from '../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import StatCard from '../components/StatCard';
import { getDashboardStats, getTenants } from '../api/api';
import { IndianRupee, Users, Home, Zap, Megaphone, Clock, Wallet, MapPin, CheckCircle, AlertCircle, TrendingUp, ArrowRight } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useFadeSlideIn, usePressAnimation, AnimatedListItem, SkeletonCard, SkeletonLoader, usePulse } from '../utils/animations';

// ─── Animated Activity Row ─────────────────────────────────────
const ActivityRow = memo(({ item, index }) => {
    const isPaid = item.Status === 'PAID' || item.Status === 'VALID';
    const anim = useFadeSlideIn(index * 70, 400, 18);

    return (
        <Animated.View style={[styles.activityCard, anim]}>
            <View style={styles.activityLeft}>
                <LinearGradient
                    colors={isPaid ? Gradients.secondary : Gradients.danger}
                    style={styles.avatar}
                >
                    <Text style={styles.avatarText}>{item.Name?.[0] || '?'}</Text>
                </LinearGradient>
                <View style={styles.activityInfo}>
                    <Text style={styles.activityName}>{item.Name}</Text>
                    <Text style={styles.activityMeta}>
                        Room {item.Room} • ₹{item['Monthly Rent'] || '0'} / ₹{item['EB Amount'] || '0'}
                    </Text>
                </View>
            </View>
            <View style={[
                styles.statusBadge,
                {
                    backgroundColor: isPaid
                        ? Colors.successBg
                        : item.Status === 'PENDING' ? Colors.warningBg : Colors.dangerBg
                }
            ]}>
                {isPaid
                    ? <CheckCircle size={12} color={Colors.success} />
                    : <Clock size={12} color={item.Status === 'PENDING' ? Colors.warning : Colors.danger} />
                }
                <Text style={[
                    styles.statusBadgeText,
                    {
                        color: isPaid
                            ? Colors.success
                            : item.Status === 'PENDING' ? Colors.warning : Colors.danger
                    }
                ]}>
                    {item.Status || 'ACTIVE'}
                </Text>
            </View>
        </Animated.View>
    );
});

// ─── Loading Skeleton ──────────────────────────────────────────
const DashboardSkeleton = memo(() => (
    <View style={styles.scrollContent}>
        <SkeletonLoader width="100%" height={70} borderRadius={16} style={{ marginBottom: 20 }} />
        <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 4 }}>
                <SkeletonLoader width="100%" height={128} borderRadius={20} />
            </View>
            <View style={{ flex: 1, marginLeft: 4 }}>
                <SkeletonLoader width="100%" height={128} borderRadius={20} />
            </View>
        </View>
        <View style={[styles.row, { marginTop: 8 }]}>
            <View style={{ flex: 1, marginRight: 4 }}>
                <SkeletonLoader width="100%" height={128} borderRadius={20} />
            </View>
            <View style={{ flex: 1, marginLeft: 4 }}>
                <SkeletonLoader width="100%" height={128} borderRadius={20} />
            </View>
        </View>
        <SkeletonLoader width="100%" height={100} borderRadius={16} style={{ marginTop: 20 }} />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
    </View>
));

// ─── Main Dashboard ────────────────────────────────────────────
const Dashboard = () => {
    const [stats, setStats] = useState(null);
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const navigation = useNavigation();

    // Section animations
    const bannerAnim = useFadeSlideIn(100, 500, 30);
    const statsAnim = useFadeSlideIn(200, 500, 24);
    const progressAnim = useFadeSlideIn(500, 500, 20);
    const activityAnim = useFadeSlideIn(700, 500, 20);
    const bannerPulse = usePulse(0.99, 1.01, 3000);
    const { scaleStyle: bannerPress, onPressIn, onPressOut } = usePressAnimation(0.97);

    const fetchData = useCallback(async () => {
        try {
            const [statsData, tenantsData] = await Promise.all([
                getDashboardStats(),
                getTenants()
            ]);
            setStats(statsData);
            setTenants(Array.isArray(tenantsData) ? tenantsData : []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchData();
    }, [fetchData]);

    // Compute stats
    const activeTenants = tenants.filter(t => t.Status !== 'VACATED');
    const paidCount = activeTenants.filter(t => t.Status === 'PAID' || t.Status === 'VALID').length;
    const pendingCount = activeTenants.filter(t => t.Status === 'PENDING').length;
    const unpaidCount = activeTenants.filter(t => t.Status === 'ACTIVE' || !t.Status).length;
    const vacatedCount = tenants.filter(t => t.Status === 'VACATED').length;

    const totalRevenue = tenants
        .filter(t => t.Status === 'PAID' || t.Status === 'VALID')
        .reduce((sum, t) => sum + parseFloat((t['Total Amount'] || '0').toString().replace(/[^\d.]/g, '')), 0);

    const expectedRevenue = activeTenants.reduce((sum, t) => sum + parseFloat((t['Total Amount'] || '0').toString().replace(/[^\d.]/g, '')), 0);
    const collectionPct = expectedRevenue > 0 ? Math.round((totalRevenue / expectedRevenue) * 100) : 0;

    const totalBeds = activeTenants.reduce((sum, t) => {
        const type = (t['Sharing Type'] || '').toString();
        if (type.includes('One') || type === '1') return sum + 1;
        if (type.includes('Two') || type === '2') return sum + 2;
        if (type.includes('Three') || type === '3') return sum + 3;
        if (type.includes('Four') || type === '4') return sum + 4;
        return sum + 1;
    }, 0);
    const vacantBeds = totalBeds - activeTenants.length;
    const recentTenants = activeTenants.slice(0, 6);

    return (
        <View style={styles.container}>
            <Header title="Dashboard" />

            {loading && !refreshing ? (
                <ScrollView showsVerticalScrollIndicator={false}>
                    <DashboardSkeleton />
                </ScrollView>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[Colors.primary]}
                            tintColor={Colors.primary}
                            progressBackgroundColor={Colors.surface}
                        />
                    }
                    showsVerticalScrollIndicator={false}
                >
                    {/* Broadcast Banner — animated entrance + subtle pulse + press */}
                    <Animated.View style={[bannerAnim, bannerPulse, bannerPress]}>
                        <TouchableOpacity
                            style={styles.broadcastBanner}
                            onPress={() => navigation.navigate('Announcements')}
                            onPressIn={onPressIn}
                            onPressOut={onPressOut}
                            activeOpacity={1}
                        >
                            <LinearGradient
                                colors={Gradients.cool}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.broadcastGradient}
                            >
                                <View style={styles.broadcastDecoCircle} />
                                <View style={styles.broadcastContent}>
                                    <View style={styles.broadcastIconBg}>
                                        <Megaphone size={20} color="#fff" />
                                    </View>
                                    <View style={styles.broadcastTextContainer}>
                                        <Text style={styles.broadcastTitle}>Make Announcement</Text>
                                        <Text style={styles.broadcastSubtitle}>Send updates to all residents</Text>
                                    </View>
                                    <View style={styles.broadcastArrow}>
                                        <ArrowRight size={18} color="rgba(255,255,255,0.7)" />
                                    </View>
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>

                    {/* Stats Grid — staggered entrance */}
                    <Animated.View style={[styles.statsGrid, statsAnim]}>
                        <View style={styles.row}>
                            <StatCard
                                title="Residents"
                                value={activeTenants.length.toString()}
                                icon={Users}
                                color="#6C63FF"
                                subtitle={`${vacatedCount} Vacated`}
                                index={0}
                            />
                            <StatCard
                                title="Collection"
                                value={`₹${totalRevenue.toLocaleString()}`}
                                icon={Wallet}
                                color="#10B981"
                                subtitle={`Expected: ₹${expectedRevenue.toLocaleString()}`}
                                index={1}
                            />
                        </View>
                        <View style={styles.row}>
                            <StatCard
                                title="Pending"
                                value={pendingCount.toString()}
                                icon={Clock}
                                color="#F59E0B"
                                subtitle={`${unpaidCount} Unpaid`}
                                index={2}
                            />
                            <StatCard
                                title="Vacant Beds"
                                value={vacantBeds > 0 ? vacantBeds.toString() : 'Full'}
                                icon={MapPin}
                                color="#FF6B9D"
                                subtitle={vacantBeds > 0 ? 'Available' : 'No vacancies'}
                                index={3}
                            />
                        </View>
                    </Animated.View>

                    {/* Collection Progress — animated progress bar */}
                    <Animated.View style={progressAnim}>
                        <View style={styles.sectionHeader}>
                            <TrendingUp size={18} color={Colors.primary} />
                            <Text style={styles.sectionTitle}>Collection Status</Text>
                        </View>
                        <View style={styles.progressCard}>
                            <View style={styles.progressLabelRow}>
                                <Text style={styles.progressLabel}>
                                    Collected <Text style={styles.progressPct}>{collectionPct}%</Text>
                                </Text>
                                <Text style={styles.progressValue}>
                                    ₹{totalRevenue.toLocaleString()} / ₹{expectedRevenue.toLocaleString()}
                                </Text>
                            </View>
                            <View style={styles.progressBarBg}>
                                <LinearGradient
                                    colors={Gradients.secondary}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={[styles.progressBarFill, { width: `${Math.min(collectionPct, 100)}%` }]}
                                />
                            </View>
                            <View style={styles.legendRow}>
                                <View style={styles.legendItem}>
                                    <View style={[styles.dot, { backgroundColor: Colors.success }]} />
                                    <Text style={styles.legendText}>Paid ({paidCount})</Text>
                                </View>
                                <View style={styles.legendItem}>
                                    <View style={[styles.dot, { backgroundColor: Colors.warning }]} />
                                    <Text style={styles.legendText}>Pending ({pendingCount})</Text>
                                </View>
                                <View style={styles.legendItem}>
                                    <View style={[styles.dot, { backgroundColor: Colors.accent }]} />
                                    <Text style={styles.legendText}>Unpaid ({unpaidCount})</Text>
                                </View>
                            </View>
                        </View>
                    </Animated.View>

                    {/* Recent Activity — staggered items */}
                    <Animated.View style={activityAnim}>
                        <View style={styles.sectionHeader}>
                            <Users size={18} color={Colors.secondary} />
                            <Text style={styles.sectionTitle}>Recent Activity</Text>
                        </View>
                        {recentTenants.length > 0 ? (
                            recentTenants.map((t, index) => (
                                <ActivityRow key={index} item={t} index={index} />
                            ))
                        ) : (
                            <View style={styles.emptyCard}>
                                <Text style={styles.emptyText}>No active residents found.</Text>
                            </View>
                        )}
                    </Animated.View>

                    {/* Recent Payments */}
                    {stats?.recentPayments?.length > 0 && (
                        <Animated.View style={activityAnim}>
                            <View style={[styles.sectionHeader, { marginTop: Spacing.lg }]}>
                                <Wallet size={18} color={Colors.accentAlt} />
                                <Text style={styles.sectionTitle}>Recent Payments</Text>
                            </View>
                            {stats.recentPayments.map((payment, index) => (
                                <AnimatedListItem key={index} index={index}>
                                    <View style={styles.paymentCard}>
                                        <View style={styles.paymentLeft}>
                                            <View style={styles.paymentIcon}>
                                                <IndianRupee size={16} color={Colors.success} />
                                            </View>
                                            <View style={styles.paymentInfo}>
                                                <Text style={styles.paymentName}>{payment.name}</Text>
                                                <Text style={styles.paymentDate}>{payment.date} • {payment.mode}</Text>
                                            </View>
                                        </View>
                                        <Text style={styles.paymentAmount}>+₹{payment.amount}</Text>
                                    </View>
                                </AnimatedListItem>
                            ))}
                        </Animated.View>
                    )}

                    <View style={{ height: 30 }} />
                </ScrollView>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    scrollContent: { padding: Spacing.md },
    statsGrid: { marginBottom: Spacing.md },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs },

    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md, gap: 8 },
    sectionTitle: { ...Typography.h3, color: Colors.text },

    progressCard: {
        backgroundColor: Colors.surface,
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: Spacing.lg,
    },
    progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    progressLabel: { ...Typography.bodyBold, color: Colors.text },
    progressPct: { color: Colors.secondary },
    progressValue: { ...Typography.caption, color: Colors.textSecondary },
    progressBarBg: { height: 8, backgroundColor: 'rgba(148,163,184,0.1)', borderRadius: 4, overflow: 'hidden', marginBottom: 14 },
    progressBarFill: { height: '100%', borderRadius: 4 },
    legendRow: { flexDirection: 'row', gap: 16 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { ...Typography.tiny, color: Colors.textSecondary },

    activityCard: {
        backgroundColor: Colors.surface,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    activityLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    avatar: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
    activityInfo: { flex: 1, gap: 2 },
    activityName: { ...Typography.h4, color: Colors.text },
    activityMeta: { ...Typography.caption, color: Colors.textSecondary },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    statusBadgeText: { ...Typography.tiny },

    paymentCard: {
        backgroundColor: Colors.surface,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    paymentLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    paymentIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.successBg, alignItems: 'center', justifyContent: 'center' },
    paymentInfo: { gap: 3 },
    paymentName: { ...Typography.h4, color: Colors.text },
    paymentDate: { ...Typography.caption, color: Colors.textSecondary },
    paymentAmount: { ...Typography.h3, color: Colors.success },

    broadcastBanner: { borderRadius: BorderRadius.xl, overflow: 'hidden', marginBottom: Spacing.lg, ...Shadows.md },
    broadcastGradient: { padding: Spacing.lg, position: 'relative', overflow: 'hidden' },
    broadcastDecoCircle: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.06)', top: -40, right: -20 },
    broadcastContent: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    broadcastIconBg: { backgroundColor: 'rgba(255,255,255,0.18)', width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    broadcastTextContainer: { flex: 1 },
    broadcastTitle: { ...Typography.h4, color: '#fff' },
    broadcastSubtitle: { ...Typography.caption, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
    broadcastArrow: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },

    emptyCard: { backgroundColor: Colors.surface, padding: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
    emptyText: { ...Typography.body, color: Colors.textSecondary },
});

export default Dashboard;

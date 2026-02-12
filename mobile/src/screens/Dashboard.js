import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, Text, TouchableOpacity, FlatList } from 'react-native';
import { Colors, Spacing, Shadows } from '../theme/theme';
import Header from '../components/Header';
import StatCard from '../components/StatCard';
import { getDashboardStats, getTenants } from '../api/api';
import { IndianRupee, Users, Home, Zap, Megaphone, Clock, Wallet, MapPin, CheckCircle, AlertCircle } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

const Dashboard = () => {
    const [stats, setStats] = useState(null);
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const navigation = useNavigation();

    const fetchData = async () => {
        try {
            setLoading(true);
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
    };

    useEffect(() => {
        fetchData();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    // Compute stats from tenant data — exactly same logic as web frontend dashboard
    const activeTenants = tenants.filter(t => t.Status !== 'VACATED');
    const paidCount = activeTenants.filter(t => t.Status === 'PAID' || t.Status === 'VALID').length;
    const pendingCount = activeTenants.filter(t => t.Status === 'PENDING').length;
    const unpaidCount = activeTenants.filter(t => t.Status === 'ACTIVE' || !t.Status).length;
    const vacatedCount = tenants.filter(t => t.Status === 'VACATED').length;

    // Collection — same as web: sum of Total Amount for PAID/VALID tenants
    const totalRevenue = tenants
        .filter(t => t.Status === 'PAID' || t.Status === 'VALID')
        .reduce((sum, t) => sum + parseFloat((t['Total Amount'] || '0').toString().replace(/[^\d.]/g, '')), 0);

    // Expected — same as web: sum of Total Amount for all active tenants
    const expectedRevenue = activeTenants.reduce((sum, t) => sum + parseFloat((t['Total Amount'] || '0').toString().replace(/[^\d.]/g, '')), 0);
    const collectionPct = expectedRevenue > 0 ? Math.round((totalRevenue / expectedRevenue) * 100) : 0;

    // Vacant Beds — same as web: calculate from Sharing Type
    const totalBeds = activeTenants.reduce((sum, t) => {
        const type = (t['Sharing Type'] || '').toString();
        if (type.includes('One') || type === '1') return sum + 1;
        if (type.includes('Two') || type === '2') return sum + 2;
        if (type.includes('Three') || type === '3') return sum + 3;
        if (type.includes('Four') || type === '4') return sum + 4;
        return sum + 1;
    }, 0);
    const vacantBeds = totalBeds - activeTenants.length;

    // Recent activity — last 6 active tenants
    const recentTenants = activeTenants.slice(0, 6);

    return (
        <View style={styles.container}>
            <Header title="Dashboard" />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
                }
            >
                {/* Broadcast Banner */}
                <TouchableOpacity
                    style={styles.broadcastBanner}
                    onPress={() => navigation.navigate('Announcements')}
                >
                    <View style={styles.broadcastContent}>
                        <View style={styles.broadcastIconBg}>
                            <Megaphone size={20} color="#fff" />
                        </View>
                        <View>
                            <Text style={styles.broadcastTitle}>Make Announcement</Text>
                            <Text style={styles.broadcastSubtitle}>Send updates to all residents</Text>
                        </View>
                    </View>
                </TouchableOpacity>

                {/* Stats Grid — exactly matches web frontend */}
                <View style={styles.statsGrid}>
                    <View style={styles.row}>
                        <StatCard
                            title="Residents"
                            value={activeTenants.length.toString()}
                            icon={Users}
                            color="#6366f1"
                            subtitle={`${vacatedCount} Vacated`}
                        />
                        <StatCard
                            title="Collection"
                            value={`₹${totalRevenue.toLocaleString()}`}
                            icon={Wallet}
                            color="#10B981"
                            subtitle={`Expected: ₹${expectedRevenue.toLocaleString()}`}
                        />
                    </View>
                    <View style={styles.row}>
                        <StatCard
                            title="Pending"
                            value={pendingCount.toString()}
                            icon={Clock}
                            color="#F59E0B"
                            subtitle={`${unpaidCount} Unpaid`}
                        />
                        <StatCard
                            title="Unpaid"
                            value={unpaidCount.toString()}
                            icon={Clock}
                            color="#f43f5e"
                            subtitle={vacantBeds > 0 ? `${vacantBeds} Beds Free` : 'Full'}
                        />
                    </View>
                    <View style={styles.row}>
                        <StatCard
                            title="Vacant Beds"
                            value={vacantBeds > 0 ? vacantBeds.toString() : 'Full'}
                            icon={MapPin}
                            color="#10B981"
                            subtitle="Available"
                        />
                    </View>
                </View>

                {/* Collection Progress */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Collection Status</Text>
                </View>
                <View style={[styles.infoBox, { marginBottom: Spacing.lg }]}>
                    <View style={styles.progressLabelRow}>
                        <Text style={styles.progressLabel}>Collected ({collectionPct}%)</Text>
                        <Text style={styles.progressValue}>
                            ₹{totalRevenue.toLocaleString()} / ₹{expectedRevenue.toLocaleString()}
                        </Text>
                    </View>
                    <View style={styles.progressBarBg}>
                        <View
                            style={[
                                styles.progressBarFill,
                                { width: `${collectionPct}%`, backgroundColor: Colors.success }
                            ]}
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
                            <View style={[styles.dot, { backgroundColor: '#f43f5e' }]} />
                            <Text style={styles.legendText}>Unpaid ({unpaidCount})</Text>
                        </View>
                    </View>
                </View>

                {/* Recent Activity — matches web dashboard table */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Recent Activity</Text>
                </View>
                {recentTenants.length > 0 ? (
                    recentTenants.map((t, index) => {
                        const isPaid = t.Status === 'PAID' || t.Status === 'VALID';
                        return (
                            <View key={index} style={styles.activityCard}>
                                <View style={styles.activityLeft}>
                                    <View style={[styles.avatar, { backgroundColor: isPaid ? '#ECFDF5' : '#FEF2F2' }]}>
                                        <Text style={[styles.avatarText, { color: isPaid ? '#059669' : '#DC2626' }]}>
                                            {t.Name?.[0] || '?'}
                                        </Text>
                                    </View>
                                    <View style={styles.activityInfo}>
                                        <Text style={styles.activityName}>{t.Name}</Text>
                                        <Text style={styles.activityMeta}>Room {t.Room} • ₹{t['Monthly Rent'] || '0'} / ₹{t['EB Amount'] || '0'}</Text>
                                    </View>
                                </View>
                                <View style={[styles.statusBadge, { backgroundColor: isPaid ? '#ECFDF5' : t.Status === 'PENDING' ? '#FFFBEB' : '#FEF2F2' }]}>
                                    {isPaid ? <CheckCircle size={12} color="#059669" /> : <Clock size={12} color={t.Status === 'PENDING' ? '#F59E0B' : '#DC2626'} />}
                                    <Text style={[styles.statusBadgeText, { color: isPaid ? '#059669' : t.Status === 'PENDING' ? '#F59E0B' : '#DC2626' }]}>
                                        {t.Status || 'ACTIVE'}
                                    </Text>
                                </View>
                            </View>
                        );
                    })
                ) : (
                    <View style={styles.infoBox}>
                        <Text style={styles.infoText}>No active residents found.</Text>
                    </View>
                )}

                {/* Recent Payments */}
                <View style={[styles.sectionHeader, { marginTop: Spacing.lg }]}>
                    <Text style={styles.sectionTitle}>Recent Payments</Text>
                </View>
                {stats?.recentPayments?.length > 0 ? (
                    stats.recentPayments.map((payment, index) => (
                        <View key={index} style={styles.paymentCard}>
                            <View style={styles.paymentInfo}>
                                <Text style={styles.paymentName}>{payment.name}</Text>
                                <Text style={styles.paymentDate}>{payment.date} • {payment.mode}</Text>
                            </View>
                            <Text style={styles.paymentAmount}>+₹{payment.amount}</Text>
                        </View>
                    ))
                ) : (
                    <View style={styles.infoBox}>
                        <Text style={styles.infoText}>No recent payments found.</Text>
                    </View>
                )}

                <View style={{ height: 20 }} />
            </ScrollView>
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
    statsGrid: {
        marginBottom: Spacing.lg,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Spacing.sm,
    },
    sectionHeader: {
        marginBottom: Spacing.md,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
    },
    infoBox: {
        backgroundColor: Colors.surface,
        padding: Spacing.md,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    infoText: {
        color: Colors.textSecondary,
        lineHeight: 20,
    },
    progressLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    progressLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.text,
    },
    progressValue: {
        fontSize: 14,
        color: Colors.textSecondary,
    },
    progressBarBg: {
        height: 8,
        backgroundColor: Colors.border,
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 12,
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 4,
    },
    legendRow: {
        flexDirection: 'row',
        gap: 16,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    legendText: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    // Recent Activity
    activityCard: {
        backgroundColor: Colors.surface,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: 12,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    activityLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    activityInfo: {
        flex: 1,
        gap: 2,
    },
    activityName: {
        fontSize: 15,
        fontWeight: 'bold',
        color: Colors.text,
    },
    activityMeta: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    statusBadgeText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    // Payments
    paymentCard: {
        backgroundColor: Colors.surface,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: 12,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    paymentInfo: {
        gap: 4,
    },
    paymentName: {
        fontSize: 15,
        fontWeight: 'bold',
        color: Colors.text,
    },
    paymentDate: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    paymentAmount: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.success,
    },
    // Broadcast banner
    broadcastBanner: {
        backgroundColor: Colors.primary,
        borderRadius: 16,
        padding: 16,
        marginBottom: Spacing.lg,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    broadcastContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    broadcastIconBg: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    broadcastTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
    },
    broadcastSubtitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.9)',
    }
});

export default Dashboard;

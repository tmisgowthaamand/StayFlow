import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, Text, TouchableOpacity } from 'react-native';
import { Colors, Spacing } from '../theme/theme';
import Header from '../components/Header';
import StatCard from '../components/StatCard';
import { getDashboardStats } from '../api/api';
import { IndianRupee, Users, Home, Zap, Megaphone } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

const Dashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const navigation = useNavigation();

    const fetchStats = async () => {
        try {
            setLoading(true);
            const data = await getDashboardStats();
            setStats(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchStats();
    };

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

                <View style={styles.statsGrid}>
                    <View style={styles.row}>
                        <StatCard
                            title="Revenue"
                            value={`₹${stats?.totalRevenue?.toLocaleString() || '0'}`}
                            icon={IndianRupee}
                            color="#4F46E5" // Indigo
                            subtitle={`Expected: ₹${stats?.expectedRevenue?.toLocaleString() || '0'}`}
                        />
                        <StatCard
                            title="Residents"
                            value={stats?.totalTenants || '0'}
                            icon={Users}
                            color="#06B6D4" // Cyan
                            subtitle={`${stats?.vacatedCount || 0} Vacated`}
                        />
                    </View>
                    <View style={styles.row}>
                        <StatCard
                            title="Pending"
                            value={stats?.pendingCount?.toString() || '0'}
                            icon={Zap}
                            color="#F59E0B" // Amber
                            subtitle={`${stats?.unpaidCount || 0} Unpaid`}
                        />
                        <StatCard
                            title="Vacant Beds"
                            value={stats?.locations?.reduce((acc, loc) => acc + (parseInt(loc.unoccupied) || 0), 0).toString() || '0'}
                            icon={Home}
                            color="#10B981" // Emerald
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
                        <Text style={styles.progressLabel}>Collected ({stats?.collectionPercentage || 0}%)</Text>
                        <Text style={styles.progressValue}>
                            ₹{stats?.totalRevenue?.toLocaleString()} / ₹{stats?.expectedRevenue?.toLocaleString()}
                        </Text>
                    </View>
                    <View style={styles.progressBarBg}>
                        <View
                            style={[
                                styles.progressBarFill,
                                { width: `${stats?.collectionPercentage || 0}%`, backgroundColor: Colors.success }
                            ]}
                        />
                    </View>
                    <View style={styles.legendRow}>
                        <View style={styles.legendItem}>
                            <View style={[styles.dot, { backgroundColor: Colors.success }]} />
                            <Text style={styles.legendText}>Paid ({stats?.paidCount || 0})</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.dot, { backgroundColor: Colors.warning }]} />
                            <Text style={styles.legendText}>Pending ({stats?.pendingCount || 0})</Text>
                        </View>
                    </View>
                </View>

                {/* Recent Payments */}
                <View style={styles.sectionHeader}>
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

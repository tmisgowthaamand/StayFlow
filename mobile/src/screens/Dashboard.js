import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, Text } from 'react-native';
import { Colors, Spacing } from '../theme/theme';
import Header from '../components/Header';
import StatCard from '../components/StatCard';
import { getDashboardStats } from '../api/api';
import { IndianRupee, Users, Home, Zap } from 'lucide-react-native';

const Dashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

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
                <View style={styles.statsGrid}>
                    <View style={styles.row}>
                        <StatCard
                            title="Revenue"
                            value={`₹${stats?.totalRevenue?.toLocaleString() || '0'}`}
                            icon={IndianRupee}
                            color="#4F46E5"
                            subtitle="Current Month"
                        />
                        <StatCard
                            title="Residents"
                            value={stats?.activeTenants || '0'}
                            icon={Users}
                            color="#06B6D4"
                            subtitle="Active Members"
                        />
                    </View>
                    <View style={styles.row}>
                        <StatCard
                            title="EB Collected"
                            value={`₹${stats?.ebCollection?.toLocaleString() || '0'}`}
                            icon={Zap}
                            color="#8B5CF6"
                            subtitle="Utility Billing"
                        />
                        <StatCard
                            title="Vacant"
                            value={stats?.vacantBeds || '0'}
                            icon={Home}
                            color="#F59E0B"
                            subtitle="Available Beds"
                        />
                    </View>
                </View>

                {/* Recent Activity or Quick Actions can go here */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Overview</Text>
                </View>

                <View style={styles.infoBox}>
                    <Text style={styles.infoText}>
                        Welcome to the StayFlow Mobile Admin. You can track revenue, manage residents, and update bills on the go.
                    </Text>
                </View>
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
});

export default Dashboard;

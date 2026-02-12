import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Linking, Alert } from 'react-native';
import { Colors, Spacing, Shadows } from '../theme/theme';
import Header from '../components/Header';
import { getTenants } from '../api/api';
import { FileText, Eye, User, Calendar, ExternalLink } from 'lucide-react-native';

const Registrations = () => {
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchRegistrations = async () => {
        try {
            setLoading(true);
            const data = await getTenants();
            // Filter tenants who have a registration form or just show all sorted by Join Date
            // User asked for "registered new", so let's sort by Join Date (newest first)
            // and maybe prioritize those with forms.

            const sorted = data.sort((a, b) => {
                const dateA = new Date(a['Join Date'] || 0);
                const dateB = new Date(b['Join Date'] || 0);
                return dateB - dateA;
            });

            setTenants(sorted);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to fetch registrations');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchRegistrations();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchRegistrations();
    };

    const openDocument = (filename) => {
        if (!filename) {
            Alert.alert('No Document', 'This tenant does not have a registration form attached.');
            return;
        }
        // Assuming backend serves uploads at /api/uploads/filename
        const url = `https://stayflow-hnm3.onrender.com/api/uploads/${filename}`;
        Linking.openURL(url).catch(err => {
            console.error('Failed to open URL:', err);
            Alert.alert('Error', 'Could not open document.');
        });
    };

    const renderItem = ({ item }) => {
        const hasDoc = !!item['Registration Form'];
        const joinDate = item['Join Date'] || 'Unknown';

        return (
            <View style={[styles.card, Shadows.sm]}>
                <View style={styles.cardHeader}>
                    <View style={styles.userInfo}>
                        <User size={16} color={Colors.primary} />
                        <Text style={styles.userName}>{item.Name}</Text>
                    </View>
                    <Text style={styles.roomText}>Room {item.Room || 'N/A'}</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.detailsRow}>
                    <View style={styles.detailItem}>
                        <Calendar size={14} color={Colors.textSecondary} />
                        <Text style={styles.detailText}>Joined: {joinDate}</Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.docButton, !hasDoc && styles.docButtonDisabled]}
                    onPress={() => openDocument(item['Registration Form'])}
                    disabled={!hasDoc}
                >
                    {hasDoc ? <FileText size={18} color="#fff" /> : <FileText size={18} color={Colors.textSecondary} />}
                    <Text style={[styles.docButtonText, !hasDoc && styles.docButtonTextDisabled]}>
                        {hasDoc ? 'View Registration PDF' : 'No Registration Form'}
                    </Text>
                    {hasDoc && <ExternalLink size={14} color="#fff" style={{ marginLeft: 'auto' }} />}
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <Header title="New Registrations" />
            <FlatList
                data={tenants}
                keyExtractor={(item, index) => item.Phone + index}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No registrations found.</Text>
                    </View>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    listContent: { padding: Spacing.md },
    card: { backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    userInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    userName: { fontSize: 16, fontWeight: 'bold', color: Colors.text },
    roomText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    divider: { height: 1, backgroundColor: Colors.border, marginVertical: 8 },
    detailsRow: { flexDirection: 'row', marginBottom: 12 },
    detailItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    detailText: { fontSize: 13, color: Colors.textSecondary },
    docButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary,
        padding: 12,
        borderRadius: 8,
        gap: 8,
        marginTop: 4
    },
    docButtonDisabled: {
        backgroundColor: '#E5E7EB',
        borderColor: Colors.border,
        borderWidth: 1
    },
    docButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14
    },
    docButtonTextDisabled: {
        color: Colors.textSecondary,
        fontWeight: 'normal'
    },
    emptyContainer: { padding: Spacing.xl, alignItems: 'center' },
    emptyText: { color: Colors.textSecondary, fontSize: 16 }
});

export default Registrations;

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { Colors, Spacing, Shadows } from '../theme/theme';
import Header from '../components/Header';
import { useNavigation } from '@react-navigation/native';
import { getTenants, notifyTenant, markPaidManual, deleteTenant } from '../api/api';
import { Search, Bell, Phone, CheckCircle, Trash2, Edit } from 'lucide-react-native';

const ResidentItem = ({ item, onNotify, onMarkPaid, onDelete }) => {
    const isPaid = item.Status === 'PAID' || item.Status === 'VALID';
    const navigation = useNavigation();

    return (
        <View style={[styles.card, Shadows.sm]}>
            <View style={styles.cardHeader}>
                <View>
                    <Text style={styles.nameText}>{item.Name}</Text>
                    <Text style={styles.roomText}>Room {item.Room} • {item.Phone}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: isPaid ? '#ECFDF5' : '#FEF2F2' }]}>
                    <Text style={[styles.statusText, { color: isPaid ? '#059669' : '#DC2626' }]}>
                        {item.Status || 'PENDING'}
                    </Text>
                </View>
            </View>

            <View style={styles.cardFooter}>
                <View style={styles.amountContainer}>
                    <Text style={styles.amountLabel}>Total Due</Text>
                    <Text style={styles.amountValue}>₹{item['Total Amount'] || '0'}</Text>
                </View>

                <View style={styles.actionButtons}>
                    {/* Edit */}
                    <TouchableOpacity
                        style={[styles.iconButton, { backgroundColor: '#F3F4F6' }]}
                        onPress={() => navigation.navigate('EditTenant', { tenant: item })}
                    >
                        <Edit size={18} color="#4B5563" />
                    </TouchableOpacity>

                    {/* Notify */}
                    {!isPaid && (
                        <TouchableOpacity
                            style={[styles.iconButton, { backgroundColor: '#EEF2FF' }]}
                            onPress={() => onNotify(item)}
                        >
                            <Bell size={18} color="#4F46E5" />
                        </TouchableOpacity>
                    )}

                    {/* Mark Paid */}
                    {!isPaid && (
                        <TouchableOpacity
                            style={[styles.iconButton, { backgroundColor: '#ECFDF5' }]}
                            onPress={() => onMarkPaid(item)}
                        >
                            <CheckCircle size={18} color="#059669" />
                        </TouchableOpacity>
                    )}

                    {/* Vacate / Delete */}
                    <TouchableOpacity
                        style={[styles.iconButton, { backgroundColor: '#FEF2F2' }]}
                        onPress={() => onDelete(item)}
                    >
                        <Trash2 size={18} color="#DC2626" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const Residents = () => {
    const [tenants, setTenants] = useState([]);
    const [filteredTenants, setFilteredTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const fetchTenants = async () => {
        try {
            setLoading(true);
            const data = await getTenants();
            setTenants(data);
            setFilteredTenants(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTenants();
    }, []);

    const handleSearch = (text) => {
        setSearch(text);
        const filtered = tenants.filter(t =>
            t.Name?.toLowerCase().includes(text.toLowerCase()) ||
            t.Room?.toString().includes(text) ||
            t.Phone?.includes(text)
        );
        setFilteredTenants(filtered);
    };

    const handleNotify = async (tenant) => {
        Alert.alert('Notify Resident', `Send payment reminder to ${tenant.Name}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Send',
                onPress: async () => {
                    try {
                        await notifyTenant(tenant.Phone, tenant.Name);
                        Alert.alert('Success', 'Reminder sent via WhatsApp');
                    } catch (error) {
                        Alert.alert('Error', 'Failed to send notification');
                    }
                }
            }
        ]);
    };

    const handleMarkPaid = (tenant) => {
        const amount = tenant['Total Amount'] || '0';
        Alert.alert(
            'Mark As Paid',
            `Confirm receipt of ₹${amount} from ${tenant.Name}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Received via CASH',
                    onPress: () => confirmPayment(tenant, amount, 'CASH')
                },
                {
                    text: 'Received via UPI',
                    onPress: () => confirmPayment(tenant, amount, 'UPI')
                }
            ]
        );
    };

    const confirmPayment = async (tenant, amount, mode) => {
        try {
            setLoading(true);
            await markPaidManual(tenant.Phone, tenant.Name, amount, mode);
            Alert.alert('Success', `Marked as PAID via ${mode}`);
            fetchTenants();
        } catch (error) {
            Alert.alert('Error', 'Failed to update payment status');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (tenant) => {
        Alert.alert(
            'Remove Resident',
            `Are you sure you want to remove ${tenant.Name} from the PG? This action cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove / Vacate',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            await deleteTenant(tenant.Phone, tenant.Name);
                            Alert.alert('Success', 'Resident removed successfully');
                            fetchTenants();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to remove resident');
                            console.error(error);
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <Header title="Residents" />

            <View style={styles.searchContainer}>
                <View style={styles.searchBox}>
                    <Search size={20} color={Colors.textSecondary} />
                    <TextInput
                        placeholder="Search by name, room or phone..."
                        style={styles.searchInput}
                        value={search}
                        onChangeText={handleSearch}
                    />
                </View>
            </View>

            {loading ? (
                <ActivityIndicator style={{ flex: 1 }} color={Colors.primary} />
            ) : (
                <FlatList
                    data={filteredTenants}
                    keyExtractor={(item, index) => index.toString()}
                    renderItem={({ item }) => (
                        <ResidentItem
                            item={item}
                            onNotify={handleNotify}
                            onMarkPaid={handleMarkPaid}
                            onDelete={handleDelete}
                        />
                    )}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={loading} onRefresh={fetchTenants} colors={[Colors.primary]} />
                    }
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>No residents found.</Text>
                    }
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    searchContainer: {
        paddingHorizontal: Spacing.md,
        marginBottom: Spacing.sm,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: 12,
        paddingHorizontal: Spacing.sm,
        height: 48,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    searchInput: {
        flex: 1,
        marginLeft: Spacing.sm,
        fontSize: 14,
        color: Colors.text,
    },
    listContent: {
        padding: Spacing.md,
    },
    card: {
        backgroundColor: Colors.surface,
        borderRadius: 16,
        padding: Spacing.md,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: Spacing.md,
    },
    nameText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text,
    },
    roomText: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    statusText: {
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    amountLabel: {
        fontSize: 10,
        color: Colors.textSecondary,
        textTransform: 'uppercase',
    },
    amountValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    iconButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        textAlign: 'center',
        color: Colors.textSecondary,
        marginTop: 40,
    },
});

export default Residents;

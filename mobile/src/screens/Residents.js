import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { Colors, Spacing, Shadows } from '../theme/theme';
import Header from '../components/Header';
import { useNavigation } from '@react-navigation/native';
import { getTenants, notifyTenant, markPaidManual, deleteTenant, notifyAll, generateInvoice } from '../api/api';
import { Search, Bell, Phone, CheckCircle, Trash2, Edit, FileText, Send } from 'lucide-react-native';

const ResidentItem = ({ item, onNotify, onMarkPaid, onDelete, onViewInvoice }) => {
    const isPaid = item.Status === 'PAID' || item.Status === 'VALID';
    const navigation = useNavigation();

    return (
        <View style={[styles.card, Shadows.sm]}>
            <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.nameText}>{item.Name}</Text>
                    <Text style={styles.roomText}>Room {item.Room} • {item.Phone}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: isPaid ? '#ECFDF5' : '#FEF2F2' }]}>
                    <Text style={[styles.statusText, { color: isPaid ? '#059669' : '#DC2626' }]}>
                        {item.Status || 'PENDING'}
                    </Text>
                </View>
            </View>

            {/* Rent + EB breakdown */}
            <View style={styles.breakdownRow}>
                <View style={styles.breakdownItem}>
                    <Text style={styles.breakdownLabel}>Rent</Text>
                    <Text style={styles.breakdownValue}>₹{item['Monthly Rent'] || '0'}</Text>
                </View>
                <View style={styles.breakdownItem}>
                    <Text style={styles.breakdownLabel}>EB</Text>
                    <Text style={styles.breakdownValue}>₹{item['EB Amount'] || '0'}</Text>
                </View>
                <View style={styles.breakdownItem}>
                    <Text style={styles.breakdownLabel}>Total</Text>
                    <Text style={[styles.breakdownValue, { color: Colors.primary, fontWeight: 'bold' }]}>₹{item['Total Amount'] || '0'}</Text>
                </View>
                {isPaid && (
                    <View style={styles.breakdownItem}>
                        <Text style={styles.breakdownLabel}>Mode</Text>
                        <Text style={[styles.breakdownValue, { color: '#059669' }]}>{item['Payment Mode'] || '-'}</Text>
                    </View>
                )}
            </View>

            <View style={styles.cardFooter}>
                <View style={styles.actionButtons}>
                    {/* Edit */}
                    <TouchableOpacity
                        style={[styles.iconButton, { backgroundColor: '#F3F4F6' }]}
                        onPress={() => navigation.navigate('EditTenant', { tenant: item })}
                    >
                        <Edit size={18} color="#4B5563" />
                    </TouchableOpacity>

                    {/* View Invoice PDF */}
                    <TouchableOpacity
                        style={[styles.iconButton, { backgroundColor: '#F0F9FF' }]}
                        onPress={() => onViewInvoice(item)}
                    >
                        <FileText size={18} color="#0EA5E9" />
                    </TouchableOpacity>

                    {/* Notify — always visible for all residents */}
                    <TouchableOpacity
                        style={[styles.iconButton, { backgroundColor: '#EEF2FF' }]}
                        onPress={() => onNotify(item)}
                    >
                        <Bell size={18} color="#4F46E5" />
                    </TouchableOpacity>

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
    const [notifyingAll, setNotifyingAll] = useState(false);
    const navigation = useNavigation();

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
        const rent = tenant['Monthly Rent'] || '0';
        const eb = tenant['EB Amount'] || '0';
        const total = tenant['Total Amount'] || '0';

        Alert.alert(
            '📩 Send Invoice',
            `Send invoice to ${tenant.Name}?\n\n` +
            `🏠 Room: ${tenant.Room}\n` +
            `💰 Rent: ₹${rent}\n` +
            `⚡ EB: ₹${eb}\n` +
            `━━━━━━━━━━━━━\n` +
            `📊 Total Due: ₹${total}\n\n` +
            `This will send:\n` +
            `✅ Invoice PDF via WhatsApp\n` +
            `✅ Payment link to pay online`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Send Invoice',
                    onPress: async () => {
                        try {
                            await notifyTenant(tenant.Phone, tenant.Name);
                            Alert.alert('✅ Sent!', `Invoice for ₹${total} sent to ${tenant.Name} via WhatsApp`);
                        } catch (error) {
                            Alert.alert('Error', 'Failed to send notification: ' + (error?.response?.data?.error || error.message));
                        }
                    }
                }
            ]
        );
    };

    const handleNotifyAll = () => {
        const activeCount = tenants.filter(t => t.Status !== 'VACATED').length;
        Alert.alert(
            '📢 Notify All Residents',
            `This will send rent + EB invoice with payment link to ALL ${activeCount} active residents via WhatsApp.\n\nEach resident will receive:\n✅ Updated invoice PDF\n✅ Payment breakdown (Rent + EB)\n✅ Razorpay payment link\n\nProceed?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Send to All',
                    onPress: async () => {
                        try {
                            setNotifyingAll(true);
                            await notifyAll();
                            Alert.alert('Success', `Invoices being sent to ${activeCount} residents! WhatsApp notifications are processing in the background.`);
                        } catch (error) {
                            Alert.alert('Error', 'Failed to trigger notifications: ' + error.message);
                        } finally {
                            setNotifyingAll(false);
                        }
                    }
                }
            ]
        );
    };

    const handleViewInvoice = async (tenant) => {
        try {
            const result = await generateInvoice(tenant.Phone, tenant.Name);
            if (result?.url) {
                const fullUrl = `https://stayflow-hnm3.onrender.com${result.url}`;
                navigation.navigate('PDFViewer', {
                    url: fullUrl,
                    title: `Invoice: ${tenant.Name}`
                });
            } else {
                Alert.alert('Error', 'Could not generate invoice');
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to generate invoice: ' + (error?.response?.data?.error || error.message));
        }
    };

    const handleMarkPaid = (tenant) => {
        const rent = tenant['Monthly Rent'] || '0';
        const eb = tenant['EB Amount'] || '0';
        const total = tenant['Total Amount'] || '0';

        Alert.alert(
            '✅ Verify Payment',
            `Confirm payment from ${tenant.Name}?\n\n` +
            `🏠 Room: ${tenant.Room}\n` +
            `💰 Rent: ₹${rent}\n` +
            `⚡ EB: ₹${eb}\n` +
            `━━━━━━━━━━━━━\n` +
            `📊 Total: ₹${total}\n\n` +
            `Select payment mode:`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: '💵 Cash',
                    onPress: () => confirmPayment(tenant, total, 'CASH')
                },
                {
                    text: '📱 UPI',
                    onPress: () => confirmPayment(tenant, total, 'UPI')
                }
            ]
        );
    };

    const confirmPayment = async (tenant, amount, mode) => {
        try {
            setLoading(true);
            await markPaidManual(tenant.Phone, tenant.Name, amount, mode);

            // After marking paid, ask owner if they want to view the receipt
            Alert.alert(
                '✅ Payment Verified!',
                `${tenant.Name} marked as PAID via ${mode}\n\n` +
                `💰 Amount: ₹${amount}\n` +
                `📄 Invoice PDF sent to resident via WhatsApp\n\n` +
                `Would you like to view the receipt?`,
                [
                    {
                        text: 'Close',
                        onPress: () => fetchTenants()
                    },
                    {
                        text: '📄 View Receipt',
                        onPress: async () => {
                            try {
                                const result = await generateInvoice(tenant.Phone, tenant.Name);
                                if (result?.url) {
                                    const fullUrl = `https://stayflow-hnm3.onrender.com${result.url}`;
                                    navigation.navigate('PDFViewer', {
                                        url: fullUrl,
                                        title: `Receipt: ${tenant.Name}`
                                    });
                                }
                            } catch (e) {
                                Alert.alert('Error', 'Could not load receipt');
                            }
                            fetchTenants();
                        }
                    }
                ]
            );
        } catch (error) {
            Alert.alert('Error', 'Failed to update payment: ' + (error?.response?.data?.error || error.message));
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

            {/* Search + Notify All */}
            <View style={styles.topBar}>
                <View style={styles.searchBox}>
                    <Search size={20} color={Colors.textSecondary} />
                    <TextInput
                        placeholder="Search name, room, phone..."
                        style={styles.searchInput}
                        value={search}
                        onChangeText={handleSearch}
                    />
                </View>
                <TouchableOpacity
                    style={styles.notifyAllButton}
                    onPress={handleNotifyAll}
                    disabled={notifyingAll}
                >
                    {notifyingAll ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <>
                            <Send size={16} color="#fff" />
                            <Text style={styles.notifyAllText}>Notify All</Text>
                        </>
                    )}
                </TouchableOpacity>
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
                            onViewInvoice={handleViewInvoice}
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
    topBar: {
        flexDirection: 'row',
        paddingHorizontal: Spacing.md,
        marginBottom: Spacing.sm,
        gap: 8,
        alignItems: 'center',
    },
    searchBox: {
        flex: 1,
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
    notifyAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#4F46E5',
        paddingHorizontal: 14,
        height: 48,
        borderRadius: 12,
    },
    notifyAllText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
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
        marginBottom: 8,
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
    breakdownRow: {
        flexDirection: 'row',
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        padding: 10,
        marginBottom: 8,
        gap: 4,
    },
    breakdownItem: {
        flex: 1,
        alignItems: 'center',
    },
    breakdownLabel: {
        fontSize: 10,
        color: Colors.textSecondary,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    breakdownValue: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.text,
    },
    cardFooter: {
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    actionButtons: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
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

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Colors, Spacing, Shadows } from '../theme/theme';
import Header from '../components/Header';
import { getTenants, updateTenant, notifyTenant } from '../api/api';
import { Home, Zap, ChevronRight, User } from 'lucide-react-native';

const Rooms = ({ navigation }) => {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRoom, setSelectedRoom] = useState(null); // For Split EB Modal
    const [ebInput, setEbInput] = useState('');
    const [processing, setProcessing] = useState(false);

    const fetchRooms = async () => {
        try {
            setLoading(true);
            const tenants = await getTenants();
            // Group by Room
            const grouped = tenants.reduce((acc, t) => {
                const room = t.Room || 'Unassigned';
                if (!acc[room]) {
                    acc[room] = {
                        room,
                        occupants: [],
                        totalRent: 0,
                        totalEb: 0,
                        sharingType: parseInt(t['Sharing Type'] || '0')
                    };
                }
                // Update sharing type if higher found (assumption: max sharing defines room capacity)
                const currentSharing = parseInt(t['Sharing Type'] || '0');
                if (currentSharing > acc[room].sharingType) acc[room].sharingType = currentSharing;

                if (t.Status !== 'VACATED') {
                    acc[room].occupants.push(t);
                    acc[room].totalRent += parseFloat(t['Monthly Rent'] || 0);
                    acc[room].totalEb += parseFloat(t['EB Amount'] || 0);
                }
                return acc;
            }, {});

            setRooms(Object.values(grouped).sort((a, b) => a.room.localeCompare(b.room, undefined, { numeric: true })));
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRooms();
    }, []);

    const handleSplitEB = async () => {
        if (!ebInput || isNaN(ebInput) || parseFloat(ebInput) < 0) {
            Alert.alert('Invalid Input', 'Please enter valid units consumed');
            return;
        }

        const units = parseFloat(ebInput);
        const rate = 15;
        const totalBill = units * rate;
        const count = selectedRoom.occupants.length;

        if (count === 0) {
            Alert.alert('Error', 'No active residents in this room to split bill.');
            return;
        }

        const perPerson = Math.ceil(totalBill / count);

        const namesList = selectedRoom.occupants.map(o => o.Name).join(', ');

        Alert.alert(
            'Confirm EB Split',
            `⚡ Units: ${units} × ₹${rate}/unit\n💰 Total Bill: ₹${totalBill}\n👥 Residents: ${count} (${namesList})\n📊 Per Person: ₹${perPerson}\n\nThis will:\n✅ Update EB for each resident\n✅ Update Total Amount (Rent + EB)\n📱 Send WhatsApp notification to all`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Split & Notify',
                    onPress: async () => {
                        try {
                            setProcessing(true);
                            let updated = 0;
                            let notified = 0;
                            const errors = [];

                            // Process each resident sequentially for reliability
                            for (const occ of selectedRoom.occupants) {
                                try {
                                    // 1. Update EB in database (updates Google Sheets + MongoDB)
                                    await updateTenant({
                                        oldPhone: occ.Phone,
                                        oldName: occ.Name,
                                        phone: occ.Phone,
                                        name: occ.Name,
                                        room: (occ.Room || selectedRoom.room || '').toString(),
                                        rent: (occ['Monthly Rent'] || '0').toString(),
                                        eb: perPerson.toString(),
                                        sharingType: (occ['Sharing Type'] || '').toString(),
                                        location: occ.Location || 'Main Branch'
                                    });
                                    updated++;
                                } catch (e) {
                                    errors.push(`Update ${occ.Name}: ${e.message}`);
                                }

                                try {
                                    // 2. Send WhatsApp notification with updated invoice
                                    await notifyTenant(occ.Phone, occ.Name);
                                    notified++;
                                } catch (e) {
                                    errors.push(`Notify ${occ.Name}: ${e.message}`);
                                }
                            }

                            // Show detailed result
                            const rent = parseFloat((selectedRoom.occupants[0]?.['Monthly Rent'] || '0').toString().replace(/[^\d.]/g, ''));
                            const newTotal = rent + perPerson;

                            let resultMsg = `✅ EB Split Complete!\n\n`;
                            resultMsg += `⚡ EB per person: ₹${perPerson}\n`;
                            resultMsg += `💰 New Total (Rent+EB): ₹${newTotal}\n\n`;
                            resultMsg += `📊 Updated: ${updated}/${count}\n`;
                            resultMsg += `📱 Notified: ${notified}/${count}`;

                            if (errors.length > 0) {
                                resultMsg += `\n\n⚠️ Issues:\n${errors.join('\n')}`;
                            }

                            Alert.alert(
                                errors.length > 0 ? 'Partial Success' : 'Success',
                                resultMsg
                            );

                            setEbInput('');
                            setSelectedRoom(null);
                            fetchRooms(); // Refresh to show updated EB amounts
                        } catch (error) {
                            console.error(error);
                            Alert.alert('Error', 'Failed to split EB: ' + error.message);
                        } finally {
                            setProcessing(false);
                        }
                    }
                }
            ]
        );
    };

    const renderRoomItem = ({ item }) => (
        <View style={[styles.card, Shadows.sm]}>
            <View style={styles.cardHeader}>
                <View style={styles.roomBadge}>
                    <Home size={16} color={Colors.primary} />
                    <Text style={styles.roomText}>Room {item.room}</Text>
                    <View style={styles.capacityBadge}>
                        <User size={12} color={Colors.textSecondary} />
                        <Text style={styles.capacityText}>
                            {item.occupants.length} / {item.sharingType || '?'}
                        </Text>
                    </View>
                </View>
                <TouchableOpacity onPress={() => setSelectedRoom(item)} style={styles.splitButton}>
                    <Zap size={14} color="#fff" />
                    <Text style={styles.splitButtonText}>Split EB</Text>
                </TouchableOpacity>
            </View>

            {/* Room totals */}
            {item.occupants.length > 0 && (
                <View style={styles.roomTotals}>
                    <Text style={styles.roomTotalText}>Rent: ₹{item.totalRent.toLocaleString()}</Text>
                    <Text style={styles.roomTotalText}>EB: ₹{item.totalEb.toLocaleString()}</Text>
                </View>
            )}

            <View style={styles.divider} />

            <View style={styles.occupantsList}>
                {item.occupants.length > 0 ? (
                    item.occupants.map((occ, idx) => (
                        <View key={idx} style={styles.occupantRow}>
                            <View style={styles.occupantInfo}>
                                <User size={14} color={Colors.textSecondary} />
                                <Text style={styles.occupantName}>{occ.Name}</Text>
                            </View>
                            <View style={styles.occupantRight}>
                                <Text style={styles.ebAmountText}>EB: ₹{occ['EB Amount'] || '0'}</Text>
                                <Text style={[styles.statusText, { color: (occ.Status === 'PAID' || occ.Status === 'VALID') ? Colors.success : Colors.warning }]}>
                                    {(occ.Status === 'PAID' || occ.Status === 'VALID') ? 'PAID' : 'DUE'}
                                </Text>
                            </View>
                        </View>
                    ))
                ) : (
                    <Text style={styles.emptyText}>Vacant Room</Text>
                )}
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <Header title="Rooms Map" />

            <FlatList
                data={rooms}
                keyExtractor={(item) => item.room}
                renderItem={renderRoomItem}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchRooms} colors={[Colors.primary]} />}
            />

            {/* Split EB Modal */}
            <Modal visible={!!selectedRoom} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Enter Units Consumed</Text>
                        <Text style={styles.modalSubtitle}>Room {selectedRoom?.room}</Text>

                        <Text style={styles.inputLabel}>Total Units (Rate: ₹15/unit)</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="e.g. 100"
                            keyboardType="numeric"
                            value={ebInput}
                            onChangeText={setEbInput}
                            autoFocus
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => setSelectedRoom(null)}>
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.confirmButton} onPress={handleSplitEB} disabled={processing}>
                                {processing ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmButtonText}>Split Now</Text>}
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
    listContent: { padding: Spacing.md },
    card: { backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    roomBadge: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    roomText: { fontSize: 16, fontWeight: 'bold', color: Colors.text },
    capacityBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, gap: 4 },
    capacityText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
    splitButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#8B5CF6', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, gap: 4 },
    splitButtonText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    roomTotals: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F8F9FA', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 4 },
    roomTotalText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
    divider: { height: 1, backgroundColor: Colors.border, marginVertical: 8 },
    occupantsList: { gap: 8 },
    occupantRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    occupantInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    occupantName: { fontSize: 14, color: Colors.text },
    occupantRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    ebAmountText: { fontSize: 12, color: '#8B5CF6', fontWeight: '600' },
    statusText: { fontSize: 12, fontWeight: 'bold' },
    emptyText: { fontSize: 12, color: Colors.textSecondary, fontStyle: 'italic' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.lg },
    modalContent: { backgroundColor: Colors.surface, borderRadius: 16, padding: Spacing.lg },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text, marginBottom: 4, textAlign: 'center' },
    modalSubtitle: { fontSize: 16, color: Colors.textSecondary, marginBottom: Spacing.lg, textAlign: 'center' },
    inputLabel: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, marginBottom: 8 },
    modalInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 12, fontSize: 18, marginBottom: Spacing.lg, textAlign: 'center' },
    modalActions: { flexDirection: 'row', gap: 12 },
    cancelButton: { flex: 1, padding: 14, borderRadius: 8, backgroundColor: Colors.background, alignItems: 'center' },
    cancelButtonText: { color: Colors.text, fontWeight: 'bold' },
    confirmButton: { flex: 1, padding: 14, borderRadius: 8, backgroundColor: Colors.primary, alignItems: 'center' },
    confirmButtonText: { color: '#fff', fontWeight: 'bold' }
});

export default Rooms;

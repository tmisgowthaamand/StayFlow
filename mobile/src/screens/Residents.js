import React, { useEffect, useState, useCallback, memo, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Alert, RefreshControl, Animated, Easing, Modal } from 'react-native';
import { Colors, Spacing, Shadows, Typography, BorderRadius, Gradients } from '../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import { useNavigation } from '@react-navigation/native';
import { useLanguage } from '../context/LanguageContext';
import { getTenants, notifyTenant, markPaidManual, deleteTenant, notifyAll, generateInvoice } from '../api/api';
import { Search, Bell, Phone, CheckCircle, Trash2, Edit, FileText, Send, Zap, MoreVertical, MapPin, Star, Users } from 'lucide-react-native';
import { usePressAnimation, SkeletonCard, AnimatedListItem } from '../utils/animations';

// ─── Premium Resident Card ─────────────────────────────────────
const ResidentItem = memo(({ item, index, onMenuPress }) => {
    const isPaid = item.Status === 'PAID' || item.Status === 'VALID';
    const navigation = useNavigation();
    const { t } = useLanguage();
    const { scaleStyle, onPressIn, onPressOut } = usePressAnimation(0.98);

    const statusColor = isPaid ? Colors.secondary : item.Status === 'PENDING' ? Colors.warning : Colors.danger;

    return (
        <AnimatedListItem index={index}>
            <Animated.View style={[styles.card, scaleStyle]} onTouchStart={onPressIn} onTouchEnd={onPressOut} onTouchCancel={onPressOut}>
                <View style={styles.cardHeader}>
                    <View style={styles.avatarWrapper}>
                        <LinearGradient colors={isPaid ? Gradients.secondary : Gradients.primary} style={styles.avatarInner}>
                            <Text style={styles.avatarText}>{item.Name?.[0] || '?'}</Text>
                        </LinearGradient>
                        <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
                    </View>

                    <View style={styles.headerText}>
                        <Text style={styles.nameText}>{item.Name}</Text>
                        <View style={styles.metaRow}>
                            <MapPin size={12} color={Colors.textSecondary} />
                            <Text style={styles.metaText}>{t('room')} {item.Room}</Text>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.optionsBtn} onPress={onMenuPress}>
                        <MoreVertical size={20} color={Colors.textMuted} />
                    </TouchableOpacity>
                </View>

                <View style={styles.statsGrid}>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>{t('rent')}</Text>
                        <Text style={styles.statValue}>₹{item['Monthly Rent'] || '0'}</Text>
                    </View>
                    <View style={styles.gridDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>{t('phone')}</Text>
                        <Text style={styles.statValue}>{item.Phone || t('na')}</Text>
                    </View>
                </View>

                <View style={styles.actionsRow}>
                    <TouchableOpacity style={[styles.btn, styles.secondaryBtn]} onPress={() => navigation.navigate('EditTenant', { tenant: item })}>
                        <Edit size={16} color={Colors.primaryLight} />
                        <Text style={styles.btnTextSecondary}>{t('edit')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.btn, styles.primaryBtn]}>
                        <LinearGradient colors={Gradients.cool} style={StyleSheet.absoluteFill} />
                        <Send size={16} color="#fff" />
                        <Text style={styles.btnTextPrimary}>{t('remind')}</Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </AnimatedListItem>
    );
});

const Residents = ({ route }) => {
    const [tenants, setTenants] = useState([]);
    const [filteredTenants, setFilteredTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTenant, setSelectedTenant] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const navigation = useNavigation();
    const { t } = useLanguage();

    const fetchTenants = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getTenants();
            const validData = Array.isArray(data) ? data : [];
            const sortedData = validData.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
            setTenants(sortedData);

            // Apply initial filter if exists in route params
            const initialFilter = route.params?.filter;
            if (initialFilter) {
                const filtered = sortedData.filter(t => t.Status === initialFilter);
                setFilteredTenants(filtered);
                setSearchQuery(initialFilter); // Visual cue
            } else {
                setFilteredTenants(sortedData);
            }
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
    }, [route.params?.filter]);

    useEffect(() => { fetchTenants(); }, [fetchTenants]);

    const handleSearch = (text) => {
        setSearchQuery(text);
        const query = text.toLowerCase();
        const filtered = tenants.filter(t =>
            t.Name?.toLowerCase().includes(query) ||
            t.Room?.toString().includes(query) ||
            t.Phone?.includes(query) ||
            t.Status?.toLowerCase().includes(query)
        );
        setFilteredTenants(filtered);
    };

    const handleAction = async (action) => {
        if (!selectedTenant) return;

        try {
            setLoading(true);
            if (action === 'PAID') {
                await markPaidManual(selectedTenant._id); // Assuming ID is _id
                Alert.alert("Success", "Marked as Paid manually.");
            } else if (action === 'PREVIEW') {
                setSelectedTenant(null); // Close the menu
                try {
                    setLoading(true);
                    // Use POST since GET failed (undefined ID)
                    console.log("Requesting invoice (POST) for:", selectedTenant.Phone);

                    const response = await fetch('https://stayflow-hnm3.onrender.com/api/generate-invoice', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({ phone: selectedTenant.Phone, name: selectedTenant.Name })
                    });

                    console.log("Response status:", response.status);
                    const contentType = response.headers.get('content-type');

                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error("Invoice gen failed:", errorText);
                        Alert.alert("Error", "Server error: " + response.status);
                        setLoading(false);
                        return;
                    }

                    if (contentType && contentType.includes('application/json')) {
                        const json = await response.json();
                        console.log("Invoice JSON keys:", Object.keys(json));

                        const base64data = json.pdfBase64 || json.base64 || json.data || json.pdf;
                        if (base64data) {
                            navigation.navigate('PDFViewer', {
                                base64Data: base64data,
                                uri: json.url || `https://stayflow-hnm3.onrender.com/api/generate-invoice?phone=${selectedTenant.Phone}`,
                                title: `${t('invoice')} - ${selectedTenant.Name}`,
                                shareEnabled: true
                            });
                            setLoading(false);
                            return;
                        }

                        if (json.url) {
                            // Construct absolute URL if relative
                            let pdfUrl = json.url;
                            if (pdfUrl.startsWith('/')) {
                                pdfUrl = `https://stayflow-hnm3.onrender.com${pdfUrl}`;
                            }

                            // Ensure URL is encoded (e.g. spaces in filenames)
                            const encodedUrl = encodeURI(pdfUrl);
                            console.log("Fetching PDF data from:", encodedUrl);

                            try {
                                const fileResp = await fetch(encodedUrl);
                                const fileBlob = await fileResp.blob();
                                const reader = new FileReader();
                                reader.readAsDataURL(fileBlob);
                                reader.onloadend = () => {
                                    navigation.navigate('PDFViewer', {
                                        base64Data: reader.result,
                                        uri: encodedUrl,
                                        title: `${t('invoice')} - ${selectedTenant.Name}`,
                                        shareEnabled: true
                                    });
                                    setLoading(false);
                                };
                                reader.onerror = () => {
                                    Alert.alert("Error", "Failed to process PDF from URL");
                                    setLoading(false);
                                };
                            } catch (err) {
                                console.error("Secondary fetch failed:", err);
                                Alert.alert("Error", `Failed to fetch from ${encodedUrl}`);
                                setLoading(false);
                            }
                            return;
                        }

                        console.warn("No PDF data found in response:", json);
                        Alert.alert("Invoice Generated", "Invoice generated, but no preview data returned.");
                        setLoading(false);
                        return;
                    }

                    // Fallback to blob
                    const blob = await response.blob();
                    if (blob.size < 100) {
                        console.warn("Blob too small");
                        Alert.alert("Error", "Received empty response");
                        setLoading(false);
                        return;
                    }
                    const reader = new FileReader();
                    reader.readAsDataURL(blob);
                    reader.onloadend = () => {
                        navigation.navigate('PDFViewer', {
                            base64Data: reader.result,
                            title: `${t('invoice')} - ${selectedTenant.Name}`,
                            shareEnabled: true
                        });
                        setLoading(false);
                    };
                } catch (e) {
                    console.error("Preview failed:", e);
                    Alert.alert("Error", "Failed to load invoice preview: " + e.message);
                    setLoading(false);
                }
                return;
            } else if (action === 'DELETE') {
                Alert.alert("Confirm Delete", "Are you sure you want to remove this resident?", [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Delete", style: "destructive", onPress: async () => {
                            await deleteTenant(selectedTenant._id);
                            setSelectedTenant(null);
                            fetchTenants();
                        }
                    }
                ]);
                return; // Return early to avoid closing modal immediately in delete case
            }
            setSelectedTenant(null);
            fetchTenants();
        } catch (e) {
            Alert.alert("Error", "Action failed. " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Header
                title={t('residents')}
                subtitle={t('management')}
                onSearchChange={handleSearch}
                placeholder={t('search_placeholder')}
                initialSearchValue={searchQuery}
            />

            {loading ? (
                <View style={styles.listArea}><SkeletonCard /><SkeletonCard /></View>
            ) : (
                <FlatList
                    data={filteredTenants}
                    keyExtractor={(it, idx) => (it._id || idx).toString()}
                    renderItem={({ item, index }) => <ResidentItem item={item} index={index} onMenuPress={() => setSelectedTenant(item)} />}
                    contentContainerStyle={styles.listArea}
                    refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchTenants} tintColor={Colors.primary} />}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>{t('no_residents')}</Text></View>}
                />
            )}

            {/* Context Menu Modal */}
            <Modal
                transparent={true}
                visible={!!selectedTenant}
                onRequestClose={() => setSelectedTenant(null)}
                animationType="fade"
            >
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelectedTenant(null)}>
                    <View style={styles.menuContainer}>
                        <View style={styles.menuHeader}>
                            <Text style={styles.menuTitle}>{selectedTenant?.Name}</Text>
                            <Text style={styles.menuSubtitle}>Room {selectedTenant?.Room}</Text>
                        </View>

                        <TouchableOpacity style={styles.menuItem} onPress={() => handleAction('PAID')}>
                            <CheckCircle size={20} color={Colors.secondary} />
                            <Text style={styles.menuText}>{t('mark_paid')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.menuItem} onPress={() => {
                            setSelectedTenant(null);
                            navigation.navigate('Announcements', { recipient: selectedTenant });
                        }}>
                            <Send size={20} color={Colors.cool} />
                            <Text style={styles.menuText}>{t('send_message')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.menuItem} onPress={() => handleAction('PREVIEW')}>
                            <FileText size={20} color={Colors.primary} />
                            <Text style={styles.menuText}>{t('preview_invoice')}</Text>
                        </TouchableOpacity>

                        <View style={styles.menuDivider} />

                        <TouchableOpacity style={styles.menuItem} onPress={() => handleAction('DELETE')}>
                            <Trash2 size={20} color={Colors.danger} />
                            <Text style={[styles.menuText, { color: Colors.danger }]}>{t('remove_resident')}</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },

    // Search
    headerSearch: { padding: Spacing.md },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.backgroundAlt,
        borderRadius: BorderRadius.md,
        paddingHorizontal: 16,
        height: 54,
        borderWidth: 1,
        borderColor: Colors.border
    },
    searchInput: { flex: 1, marginLeft: 12, ...Typography.body, color: Colors.text },

    // List
    listArea: { paddingHorizontal: Spacing.md, paddingBottom: 100 },

    // Card
    card: {
        backgroundColor: Colors.backgroundAlt,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Colors.border,
        ...Shadows.sm,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    avatarWrapper: { position: 'relative' },
    avatarInner: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#fff', fontWeight: '900', fontSize: 20 },
    statusIndicator: { position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: Colors.backgroundAlt },
    headerText: { flex: 1, marginLeft: 16 },
    nameText: { ...Typography.h4, color: Colors.text, fontSize: 17 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    metaText: { ...Typography.bodySmall, color: Colors.textSecondary },
    optionsBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

    // Stats Grid
    statsGrid: {
        flexDirection: 'row',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        padding: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: Colors.border
    },
    statItem: { flex: 1, alignItems: 'center' },
    statLabel: { ...Typography.tiny, fontSize: 9, color: Colors.textMuted, marginBottom: 4 },
    statValue: { ...Typography.bodyBold, color: Colors.text, fontSize: 14 },
    gridDivider: { width: 1, height: '60%', backgroundColor: Colors.border, alignSelf: 'center' },

    // Actions
    actionsRow: { flexDirection: 'row', gap: 12 },
    btn: { flex: 1, height: 46, borderRadius: BorderRadius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden' },
    secondaryBtn: { backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: Colors.border },
    primaryBtn: { backgroundColor: Colors.primary },
    btnTextSecondary: { ...Typography.bodyBold, color: Colors.text, fontSize: 14 },
    btnTextPrimary: { ...Typography.bodyBold, color: '#fff', fontSize: 14 },

    emptyContainer: { padding: 40, alignItems: 'center' },
    emptyText: { ...Typography.bodySmall, color: Colors.textMuted, fontStyle: 'italic', marginTop: 12 },

    // Menu Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: Spacing.xl },
    menuContainer: { backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.lg, padding: 20, borderWidth: 1, borderColor: Colors.border, ...Shadows.md },
    menuHeader: { marginBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 12 },
    menuTitle: { ...Typography.h3, color: Colors.text },
    menuSubtitle: { ...Typography.tiny, color: Colors.textSecondary, marginTop: 4 },
    menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 14 },
    menuText: { ...Typography.bodyBold, color: Colors.text },
    menuDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 8 }
});

export default Residents;

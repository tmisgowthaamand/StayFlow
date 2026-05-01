import React, { useEffect, useState, useCallback, useMemo, memo, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Linking, Alert, Animated, Easing } from 'react-native';
import { Colors, Spacing, Shadows, Typography, BorderRadius, Gradients } from '../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import { getTenants } from '../api/api';
import { FileText, Calendar, ExternalLink, Clock } from 'lucide-react-native';
import { usePressAnimation, useFadeSlideIn, SkeletonCard } from '../utils/animations';
import { useLanguage } from '../context/LanguageContext';
import { useNavigation } from '@react-navigation/native';

// ─── Animated Registration Card ────────────────────────────────
const RegistrationCard = memo(({ item, index, openDocument }) => {
    const { t } = useLanguage();
    const navigation = useNavigation();
    const hasDoc = !!item['Registration Form'];
    const joinDate = item['Join Date'] || t('unknown');
    const isPaid = item.Status === 'PAID' || item.Status === 'VALID';
    const { scaleStyle, onPressIn, onPressOut } = usePressAnimation(0.97);

    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(24)).current;
    useEffect(() => {
        const delay = Math.min(index * 65, 450);
        setTimeout(() => {
            Animated.parallel([
                Animated.timing(opacity, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                Animated.timing(translateY, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            ]).start();
        }, delay);
    }, []);

    return (
        <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate('TenantDetails', { tenant: item })}>
        <Animated.View
            style={[styles.card, Shadows.sm, scaleStyle, { opacity, transform: [...scaleStyle.transform, { translateY }] }]}
            onTouchStart={onPressIn}
            onTouchEnd={onPressOut}
            onTouchCancel={onPressOut}
        >
            <View style={styles.cardHeader}>
                <View style={styles.userInfo}>
                    <LinearGradient colors={isPaid ? Gradients.secondary : Gradients.primary} style={styles.avatarSmall}>
                        <Text style={styles.avatarChar}>{item.Name?.[0] || '?'}</Text>
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.userName}>{item.Name}</Text>
                        <Text style={styles.phoneText}>{item.Phone}</Text>
                    </View>
                </View>
                <View style={styles.roomBadge}><Text style={styles.roomText}>{t('room')} {item.Room || t('na')}</Text></View>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailsRow}>
                <View style={styles.detailItem}><Calendar size={13} color={Colors.textMuted} /><Text style={styles.detailText}>{t('joined')}: {joinDate}</Text></View>
                <View style={styles.detailItem}><Clock size={13} color={Colors.textMuted} /><Text style={styles.detailText}>{item.Status || 'ACTIVE'}</Text></View>
            </View>
            <TouchableOpacity style={[styles.docButton, !hasDoc && styles.docButtonDisabled]} onPress={() => openDocument(item['Registration Form'])} disabled={!hasDoc} activeOpacity={0.85}>
                {hasDoc ? (
                    <LinearGradient colors={Gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.docButtonGradient}>
                        <FileText size={16} color="#fff" />
                        <Text style={styles.docButtonText}>{t('view_registration_pdf')}</Text>
                        <ExternalLink size={14} color="rgba(255,255,255,0.7)" style={{ marginLeft: 'auto' }} />
                    </LinearGradient>
                ) : (
                    <View style={styles.docButtonDisabledInner}>
                        <FileText size={16} color={Colors.textMuted} />
                        <Text style={styles.docButtonTextDisabled}>{t('no_registration_form')}</Text>
                    </View>
                )}
            </TouchableOpacity>
        </Animated.View>
        </TouchableOpacity>
    );
});

const Registrations = () => {
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const { t } = useLanguage();

    const filteredTenants = useMemo(() => {
        if (!searchQuery.trim()) return tenants;
        const q = searchQuery.toLowerCase().trim();
        return tenants.filter(t => {
            const name = (t.Name || '').toLowerCase();
            const phone = (t.Phone || '').toString();
            const room = (t.Room || '').toString().toLowerCase();
            const status = (t.Status || '').toLowerCase();
            return name.includes(q) || phone.includes(q) || room.includes(q) || status.includes(q);
        });
    }, [searchQuery, tenants]);

    const fetchRegistrations = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getTenants();
            const validData = Array.isArray(data) ? data : [];
            const sorted = validData.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
            setTenants(sorted);
        } catch (error) { console.error(error); Alert.alert('Error', 'Failed to fetch registrations'); }
        finally { setLoading(false); setRefreshing(false); }
    }, []);

    useEffect(() => { fetchRegistrations(); }, []);
    const onRefresh = useCallback(() => { setRefreshing(true); fetchRegistrations(); }, [fetchRegistrations]);

    const openDocument = useCallback(async (filename) => {
        if (!filename) { Alert.alert('No Document', 'No registration form attached.'); return; }
        const token = await AsyncStorage.getItem('stayflow_jwt');
        Linking.openURL(`https://stayflow-tkto.onrender.com/api/media/${filename}`).catch(() => Alert.alert('Error', 'Could not open document.'));
    }, []);

    const renderItem = useCallback(({ item, index }) => <RegistrationCard item={item} index={index} openDocument={openDocument} />, [openDocument]);
    const keyExtractor = useCallback((item, index) => (item.Phone || '') + index, []);

    return (
        <View style={styles.container}>
            <Header title={t('registrations')} onSearchChange={setSearchQuery} placeholder="Search by name, room, phone..." />
            {loading && !refreshing ? (
                <View style={styles.listContent}><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></View>
            ) : (
                <FlatList
                    data={filteredTenants} keyExtractor={keyExtractor} renderItem={renderItem} contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} tintColor={Colors.primary} progressBackgroundColor={Colors.surface} />}
                    ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>{t('no_registrations')}</Text></View>}
                    showsVerticalScrollIndicator={false} removeClippedSubviews={true} maxToRenderPerBatch={8} windowSize={5}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    listContent: { padding: Spacing.md, paddingBottom: Spacing.xxl },
    card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    userInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    avatarSmall: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    avatarChar: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    userName: { ...Typography.h4, color: Colors.text },
    phoneText: { ...Typography.caption, color: Colors.textSecondary, marginTop: 1 },
    roomBadge: { backgroundColor: Colors.surfaceElevated, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    roomText: { ...Typography.caption, color: Colors.textSecondary, fontWeight: '600' },
    divider: { height: 1, backgroundColor: Colors.border, marginVertical: 8 },
    detailsRow: { flexDirection: 'row', marginBottom: 12, gap: 16 },
    detailItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    detailText: { ...Typography.caption, color: Colors.textSecondary },
    docButton: { borderRadius: BorderRadius.md, overflow: 'hidden', marginTop: 4 },
    docButtonGradient: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
    docButtonText: { color: '#fff', ...Typography.bodyBold },
    docButtonDisabled: { borderRadius: BorderRadius.md },
    docButtonDisabledInner: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8, backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
    docButtonTextDisabled: { ...Typography.body, color: Colors.textMuted },
    emptyContainer: { padding: Spacing.xl, alignItems: 'center' },
    emptyText: { ...Typography.body, color: Colors.textSecondary },
});

export default Registrations;

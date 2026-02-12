import React, { useEffect, useState, useCallback, useRef, memo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Alert, Animated, Easing } from 'react-native';
import { Colors, Spacing, Shadows, Typography, BorderRadius, Gradients } from '../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import { getTenants, updateEBBill } from '../api/api';
import { Zap, Save, CheckCircle2 } from 'lucide-react-native';
import { usePressAnimation, useFadeSlideIn, SkeletonCard } from '../utils/animations';

// ─── Animated EB Item ──────────────────────────────────────────
const EBItem = memo(({ item, onSave, index }) => {
    const [ebValue, setEbValue] = useState(item['EB Amount']?.toString() || '0');
    const [isChanged, setIsChanged] = useState(false);
    const { scaleStyle, onPressIn, onPressOut } = usePressAnimation(0.97);

    // Entrance animation
    const opacity = useRef(new Animated.Value(0)).current;
    const translateX = useRef(new Animated.Value(30)).current;
    useEffect(() => {
        const delay = Math.min(index * 50, 400);
        setTimeout(() => {
            Animated.parallel([
                Animated.timing(opacity, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                Animated.timing(translateX, { toValue: 0, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            ]).start();
        }, delay);
    }, []);

    // Save button pop animation
    const saveScale = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.spring(saveScale, {
            toValue: isChanged ? 1 : 0,
            friction: 5,
            tension: 80,
            useNativeDriver: true,
        }).start();
    }, [isChanged]);

    useEffect(() => {
        setEbValue(item['EB Amount']?.toString() || '0');
        setIsChanged(false);
    }, [item]);

    const handleChange = useCallback((text) => {
        setEbValue(text);
        setIsChanged(text !== item['EB Amount']?.toString());
    }, [item]);

    return (
        <Animated.View
            style={[styles.card, Shadows.sm, scaleStyle, { opacity, transform: [...scaleStyle.transform, { translateX }] }]}
            onTouchStart={onPressIn}
            onTouchEnd={onPressOut}
            onTouchCancel={onPressOut}
        >
            <View style={styles.cardRow}>
                <View style={styles.cardInfo}>
                    <LinearGradient colors={Gradients.purple} style={styles.itemAvatar}>
                        <Text style={styles.itemAvatarText}>{item.Name?.[0] || '?'}</Text>
                    </LinearGradient>
                    <View>
                        <Text style={styles.nameText}>{item.Name}</Text>
                        <Text style={styles.roomText}>Room {item.Room}</Text>
                    </View>
                </View>
                <View style={styles.inputContainer}>
                    <Text style={styles.currency}>₹</Text>
                    <TextInput style={styles.input} keyboardType="numeric" value={ebValue} onChangeText={handleChange} placeholderTextColor={Colors.textMuted} />
                    {isChanged ? (
                        <Animated.View style={{ transform: [{ scale: saveScale }] }}>
                            <TouchableOpacity style={styles.saveBtn} onPress={() => onSave(item, ebValue)}>
                                <LinearGradient colors={Gradients.primary} style={styles.saveBtnGradient}>
                                    <Save size={14} color="#fff" />
                                </LinearGradient>
                            </TouchableOpacity>
                        </Animated.View>
                    ) : (
                        <View style={styles.savedIcon}><CheckCircle2 size={18} color={Colors.success} /></View>
                    )}
                </View>
            </View>
        </Animated.View>
    );
});

const Billing = () => {
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const bannerAnim = useFadeSlideIn(100, 450, 20);

    const fetchTenants = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getTenants();
            setTenants(data.filter(t => t.Status !== 'VACATED'));
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchTenants(); }, []);

    const handleUpdateEB = useCallback(async (tenant, newAmount) => {
        Alert.alert('Update Bill', `Set EB for ${tenant.Name} to ₹${newAmount}?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Update', onPress: async () => { Alert.alert('Success', 'Bill updated'); fetchTenants(); } }
        ]);
    }, [fetchTenants]);

    const renderItem = useCallback(({ item, index }) => <EBItem item={item} onSave={handleUpdateEB} index={index} />, [handleUpdateEB]);
    const keyExtractor = useCallback((item, index) => (item.Phone || '') + index, []);

    return (
        <View style={styles.container}>
            <Header title="Utility Billing" />
            <Animated.View style={[styles.bannerContainer, bannerAnim]}>
                <LinearGradient colors={Gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
                    <View style={styles.bannerDecoCircle} />
                    <View style={styles.bannerIconBg}><Zap color="#fff" size={18} /></View>
                    <Text style={styles.bannerText}>Update monthly EB amounts for each resident below</Text>
                </LinearGradient>
            </Animated.View>
            {loading ? (
                <View style={styles.listContent}><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></View>
            ) : (
                <FlatList data={tenants} keyExtractor={keyExtractor} renderItem={renderItem} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} removeClippedSubviews={true} maxToRenderPerBatch={10} windowSize={5} />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    bannerContainer: { paddingHorizontal: Spacing.md, marginBottom: Spacing.sm },
    banner: { borderRadius: BorderRadius.lg, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: 12, position: 'relative', overflow: 'hidden' },
    bannerDecoCircle: { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.06)', right: -20, top: -20 },
    bannerIconBg: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    bannerText: { color: 'rgba(255,255,255,0.9)', ...Typography.caption, flex: 1 },
    listContent: { padding: Spacing.md, paddingBottom: Spacing.xxl },
    card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
    cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    itemAvatar: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    itemAvatarText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    nameText: { ...Typography.h4, color: Colors.text },
    roomText: { ...Typography.caption, color: Colors.textSecondary, marginTop: 1 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.sm, paddingHorizontal: 10, height: 44, width: 140, borderWidth: 1, borderColor: Colors.border },
    currency: { ...Typography.h4, color: Colors.textMuted, marginRight: 4 },
    input: { flex: 1, ...Typography.h4, color: Colors.text },
    saveBtn: { marginLeft: 4 },
    saveBtnGradient: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    savedIcon: { padding: 4, opacity: 0.6 },
});

export default Billing;

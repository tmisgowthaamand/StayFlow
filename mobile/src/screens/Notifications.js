import React, { useEffect, useState, useCallback, useRef, memo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Animated, Easing, RefreshControl, Image } from 'react-native';
import { Colors, Spacing, Shadows, Typography, BorderRadius, Gradients } from '../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import { usePressAnimation, useFadeSlideIn, SkeletonCard, AnimatedListItem } from '../utils/animations';
import {
    getNotifications, markAsRead, markAllAsRead, deleteNotification,
    clearAllNotifications, NOTIFICATION_TYPES, formatNotificationTime, formatFullDateTime
} from '../utils/notifications';
import {
    FileText, CheckCircle, UserPlus, Send, Zap, Bell,
    BellOff, Trash2, CheckCheck, Clock, X, AlertCircle, ChevronRight,
    Megaphone
} from 'lucide-react-native';
import { useLanguage } from '../context/LanguageContext';

const ICON_MAP = { FileText, CheckCircle, UserPlus, Send, Zap, AlertCircle, Megaphone };

const getTypeConfig = (type) => {
    const configs = {
        invoice_sent: NOTIFICATION_TYPES.INVOICE_SENT,
        payment_received: NOTIFICATION_TYPES.PAYMENT_RECEIVED,
        new_registration: NOTIFICATION_TYPES.NEW_REGISTRATION,
        bulk_notify: NOTIFICATION_TYPES.BULK_NOTIFY,
        eb_split: NOTIFICATION_TYPES.EB_SPLIT,
        announcement: NOTIFICATION_TYPES.ANNOUNCEMENT,
    };
    return configs[type] || NOTIFICATION_TYPES.BULK_NOTIFY;
};

// ─── Animated Notification Card ────────────────────────────────
const NotificationCard = memo(({ item, index, onRead, onDelete }) => {
    const config = getTypeConfig(item.type);
    const IconComponent = ICON_MAP[config.icon] || Bell;
    const { scaleStyle, onPressIn, onPressOut } = usePressAnimation(0.98);

    return (
        <AnimatedListItem index={index}>
            <Animated.View style={scaleStyle}>
                <TouchableOpacity
                    style={[styles.card, !item.read && styles.cardUnread]}
                    onPress={() => onRead(item.id)}
                    onPressIn={onPressIn}
                    onPressOut={onPressOut}
                    activeOpacity={1}
                >
                    <View style={styles.cardMain}>
                        <LinearGradient colors={config.gradient} style={styles.iconBg}>
                            <IconComponent size={18} color="#fff" />
                        </LinearGradient>
                        <View style={styles.textContainer}>
                            <View style={styles.titleRow}>
                                <Text style={[styles.notifTitle, !item.read && styles.unreadText]} numberOfLines={1}>{item.title}</Text>
                                <Text style={styles.timeText}>{formatNotificationTime(item.timestamp)}</Text>
                            </View>
                            <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
                            {(item.type === 'announcement' || item.meta?.imageUrl) && item.meta?.imageUrl && (
                                <Image source={{ uri: item.meta.imageUrl }} style={styles.attachedImage} resizeMode="cover" />
                            )}
                        </View>
                    </View>
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(item.id)}>
                        <X size={14} color={Colors.textMuted} />
                    </TouchableOpacity>
                </TouchableOpacity>
            </Animated.View>
        </AnimatedListItem>
    );
});

// ─── Main Screen ───────────────────────────────────────────────
const Notifications = ({ navigation }) => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const { t } = useLanguage();

    const loadNotifications = useCallback(async () => {
        try {
            const data = await getNotifications();
            setNotifications(data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); setRefreshing(false); }
    }, []);

    useEffect(() => { loadNotifications(); }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadNotifications();
    }, []);

    const handleRead = useCallback(async (id) => {
        const item = notifications.find(n => n.id === id);
        await markAsRead(id, item?.isServer);
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    }, [notifications]);

    const handleDelete = useCallback(async (id) => {
        await deleteNotification(id);
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    const handleMarkAllRead = useCallback(async () => {
        await markAllAsRead();
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }, []);

    return (
        <View style={styles.container}>
            <Header title={t('notifications')} onBack={() => navigation.goBack()} showNotifBell={false} />

            <View style={styles.actionHeader}>
                <Text style={styles.countText}>{notifications.filter(n => !n.read).length} {t('unread')}</Text>
                <TouchableOpacity onPress={handleMarkAllRead}>
                    <Text style={styles.markAllText}>{t('mark_all_read')}</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.listContent}><SkeletonCard lines={2} /><SkeletonCard lines={2} /></View>
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item, index }) => (
                        <NotificationCard item={item} index={index} onRead={handleRead} onDelete={handleDelete} />
                    )}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} tintColor={Colors.primary} />}
                    ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>{t('no_notifications')}</Text></View>}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    actionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 12 },
    countText: { ...Typography.caption, color: Colors.textSecondary, fontWeight: '700' },
    markAllText: { ...Typography.tiny, color: Colors.primary, fontWeight: '700' },
    listContent: { padding: Spacing.md, paddingBottom: 40 },
    card: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border,
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardUnread: { backgroundColor: Colors.surfaceElevated, borderColor: Colors.primary + '30' },
    cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconBg: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    textContainer: { flex: 1 },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
    notifTitle: { ...Typography.caption, color: Colors.textSecondary, fontWeight: '600' },
    unreadText: { color: Colors.text, fontWeight: '700' },
    timeText: { ...Typography.tiny, color: Colors.textMuted },
    notifBody: { ...Typography.tiny, color: Colors.textSecondary, lineHeight: 14 },
    attachedImage: {
        width: '100%',
        height: 150,
        borderRadius: BorderRadius.md,
        marginTop: 10,
        backgroundColor: Colors.surfaceElevated,
    },
    deleteBtn: { padding: 8, marginLeft: 10 },
    empty: { padding: 80, alignItems: 'center' },
    emptyText: { ...Typography.body, color: Colors.textMuted },
});

export default Notifications;

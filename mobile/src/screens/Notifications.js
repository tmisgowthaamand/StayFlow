import React, { useEffect, useState, useCallback, useRef, memo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Animated, Easing, RefreshControl, Image } from 'react-native';
import { Colors, Spacing, Shadows, Typography, BorderRadius, Gradients } from '../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import { usePressAnimation, useFadeSlideIn, SkeletonCard } from '../utils/animations';
import {
    getNotifications, markAsRead, markAllAsRead, deleteNotification,
    clearAllNotifications, NOTIFICATION_TYPES, formatNotificationTime, formatFullDateTime
} from '../utils/notifications';
import {
    FileText, CheckCircle, UserPlus, Send, Zap, Bell,
    BellOff, Trash2, CheckCheck, Clock, X, AlertCircle
} from 'lucide-react-native';

// ─── Icon Map ──────────────────────────────────────────────────
const ICON_MAP = {
    FileText, CheckCircle, UserPlus, Send, Zap, AlertCircle
};

const getTypeConfig = (type) => {
    const configs = {
        invoice_sent: NOTIFICATION_TYPES.INVOICE_SENT,
        payment_received: NOTIFICATION_TYPES.PAYMENT_RECEIVED,
        new_registration: NOTIFICATION_TYPES.NEW_REGISTRATION,
        bulk_notify: NOTIFICATION_TYPES.BULK_NOTIFY,
        eb_split: NOTIFICATION_TYPES.EB_SPLIT,
        issue_submitted: {
            key: 'issue_submitted',
            label: 'Issue Submitted',
            icon: 'AlertCircle',
            gradient: ['#F87171', '#DC2626'],
            color: '#F87171',
        }
    };
    return configs[type] || NOTIFICATION_TYPES.INVOICE_SENT;
};

// ─── Animated Notification Card ────────────────────────────────
const NotificationCard = memo(({ item, index, onRead, onDelete }) => {
    const config = getTypeConfig(item.type);
    const IconComponent = ICON_MAP[config.icon] || Bell;
    const { scaleStyle, onPressIn, onPressOut } = usePressAnimation(0.97);

    // Entrance animation
    const opacity = useRef(new Animated.Value(0)).current;
    const translateX = useRef(new Animated.Value(40)).current;

    useEffect(() => {
        const delay = Math.min(index * 60, 500);
        setTimeout(() => {
            Animated.parallel([
                Animated.timing(opacity, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                Animated.timing(translateX, { toValue: 0, duration: 400, easing: Easing.out(Easing.back(1.1)), useNativeDriver: true }),
            ]).start();
        }, delay);
    }, []);

    // Delete swipe animation
    const deleteAnim = useRef(new Animated.Value(1)).current;
    const handleDelete = useCallback(() => {
        Animated.timing(deleteAnim, {
            toValue: 0,
            duration: 250,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
        }).start(() => onDelete(item.id));
    }, [item.id]);

    return (
        <Animated.View
            style={[
                scaleStyle,
                {
                    opacity: Animated.multiply(opacity, deleteAnim),
                    transform: [
                        ...scaleStyle.transform,
                        { translateX },
                        { scale: deleteAnim },
                    ],
                },
            ]}
        >
            <TouchableOpacity
                style={[
                    styles.card,
                    Shadows.sm,
                    !item.read && styles.cardUnread,
                ]}
                onPress={() => onRead(item.id)}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                activeOpacity={1}
            >
                {/* Unread indicator */}
                {!item.read && <View style={[styles.unreadDot, { backgroundColor: config.color }]} />}

                <View style={styles.cardContent}>
                    <View style={styles.cardTop}>
                        <LinearGradient colors={config.gradient} style={styles.notifIconBg}>
                            <IconComponent size={16} color="#fff" />
                        </LinearGradient>

                        <View style={styles.cardTextContainer}>
                            <View style={styles.titleRow}>
                                <Text style={[styles.notifTitle, !item.read && styles.notifTitleUnread]} numberOfLines={1}>
                                    {item.title}
                                </Text>
                            </View>
                            <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
                        </View>

                        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <X size={14} color={Colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.cardBottom}>
                        <View style={styles.timeRow}>
                            <Clock size={11} color={Colors.textMuted} />
                            <Text style={styles.timeText}>{formatNotificationTime(item.timestamp)}</Text>
                        </View>
                        <Text style={styles.fullDate}>{formatFullDateTime(item.timestamp)}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
});

// ─── Summary Banner ────────────────────────────────────────────
const SummaryBanner = memo(({ notifications }) => {
    const bannerAnim = useFadeSlideIn(50, 450, 20);
    const unread = notifications.filter(n => !n.read).length;
    const today = notifications.filter(n => {
        const d = new Date(n.timestamp);
        const now = new Date();
        return d.toDateString() === now.toDateString();
    }).length;

    return (
        <Animated.View style={[styles.summaryBanner, bannerAnim]}>
            <LinearGradient colors={Gradients.dark} style={styles.summaryGradient}>
                <View style={styles.summaryItem}>
                    <Text style={styles.summaryNumber}>{notifications.length}</Text>
                    <Text style={styles.summaryLabel}>Total</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                    <Text style={[styles.summaryNumber, { color: Colors.primary }]}>{unread}</Text>
                    <Text style={styles.summaryLabel}>Unread</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                    <Text style={[styles.summaryNumber, { color: Colors.secondary }]}>{today}</Text>
                    <Text style={styles.summaryLabel}>Today</Text>
                </View>
            </LinearGradient>
        </Animated.View>
    );
});

// ─── Empty State ───────────────────────────────────────────────
const EmptyState = memo(() => {
    const anim = useFadeSlideIn(200, 500, 30);
    return (
        <Animated.View style={[styles.emptyContainer, anim]}>
            <View style={styles.emptyIconBg}>
                <Image source={require('../../assets/icon.png')} style={{ width: 48, height: 48, borderRadius: 10 }} />
            </View>
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptySubtext}>
                Activity logs will appear here when you{'\n'}send invoices, receive payments, or add residents.
            </Text>
        </Animated.View>
    );
});

// ─── Main Screen ───────────────────────────────────────────────
const Notifications = ({ navigation }) => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const actionsAnim = useFadeSlideIn(100, 400, 16);

    const loadNotifications = useCallback(async () => {
        try {
            const data = await getNotifications();
            setNotifications(data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); setRefreshing(false); }
    }, []);

    useEffect(() => { loadNotifications(); }, []);

    // Reload when screen comes into focus
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            loadNotifications();
        });
        return unsubscribe;
    }, [navigation]);

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

    const handleMarkAllRead = useCallback(() => {
        Alert.alert('Mark All Read', 'Mark all notifications as read?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Mark All', onPress: async () => {
                    await markAllAsRead();
                    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                }
            }
        ]);
    }, []);

    const handleClearAll = useCallback(() => {
        Alert.alert('Clear All', 'Delete all notifications? This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Clear All', style: 'destructive', onPress: async () => {
                    await clearAllNotifications();
                    setNotifications([]);
                }
            }
        ]);
    }, []);

    const renderItem = useCallback(({ item, index }) => (
        <NotificationCard item={item} index={index} onRead={handleRead} onDelete={handleDelete} />
    ), [handleRead, handleDelete]);

    const keyExtractor = useCallback((item) => item.id, []);
    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <View style={styles.container}>
            <Header title="Notifications" onBack={() => navigation.goBack()} showNotifBell={false} />

            {notifications.length > 0 && (
                <>
                    <SummaryBanner notifications={notifications} />
                    <Animated.View style={[styles.actionRow, actionsAnim]}>
                        {unreadCount > 0 && (
                            <TouchableOpacity style={styles.actionButton} onPress={handleMarkAllRead}>
                                <CheckCheck size={14} color={Colors.primary} />
                                <Text style={styles.actionButtonText}>Mark All Read</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity style={[styles.actionButton, styles.actionButtonDanger]} onPress={handleClearAll}>
                            <Trash2 size={14} color={Colors.danger} />
                            <Text style={[styles.actionButtonText, { color: Colors.danger }]}>Clear All</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </>
            )}

            {loading ? (
                <View style={styles.listContent}>
                    <SkeletonCard lines={2} />
                    <SkeletonCard lines={2} />
                    <SkeletonCard lines={2} />
                    <SkeletonCard lines={2} />
                    <SkeletonCard lines={2} />
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={keyExtractor}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={<EmptyState />}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[Colors.primary]}
                            tintColor={Colors.primary}
                            progressBackgroundColor={Colors.surface}
                        />
                    }
                    showsVerticalScrollIndicator={false}
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={10}
                    windowSize={7}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    listContent: { padding: Spacing.md, paddingBottom: Spacing.xxl },

    // Summary
    summaryBanner: { marginHorizontal: Spacing.md, marginBottom: Spacing.sm, borderRadius: BorderRadius.lg, overflow: 'hidden' },
    summaryGradient: { flexDirection: 'row', padding: Spacing.md, alignItems: 'center' },
    summaryItem: { flex: 1, alignItems: 'center' },
    summaryNumber: { ...Typography.h2, color: Colors.text },
    summaryLabel: { ...Typography.tiny, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },
    summaryDivider: { width: 1, height: 30, backgroundColor: Colors.border },

    // Actions
    actionRow: { flexDirection: 'row', paddingHorizontal: Spacing.md, marginBottom: Spacing.sm, gap: 8 },
    actionButton: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: Colors.surface, paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.border,
    },
    actionButtonDanger: { marginLeft: 'auto' },
    actionButtonText: { ...Typography.caption, color: Colors.primary, fontWeight: '600' },

    // Card
    card: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border,
        position: 'relative',
        overflow: 'hidden',
    },
    cardUnread: {
        borderColor: 'rgba(108, 99, 255, 0.2)',
        backgroundColor: 'rgba(108, 99, 255, 0.04)',
    },
    unreadDot: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        borderTopLeftRadius: BorderRadius.lg,
        borderBottomLeftRadius: BorderRadius.lg,
    },
    cardContent: { gap: 10 },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    notifIconBg: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    cardTextContainer: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    notifTitle: { ...Typography.h4, color: Colors.text, flex: 1 },
    notifTitleUnread: { color: Colors.textBright },
    notifBody: { ...Typography.caption, color: Colors.textSecondary, marginTop: 3, lineHeight: 18 },
    deleteBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },

    cardBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    timeText: { ...Typography.tiny, color: Colors.textMuted },
    fullDate: { ...Typography.tiny, color: Colors.textMuted, fontWeight: '400' },

    // Empty
    emptyContainer: { alignItems: 'center', paddingTop: 80 },
    emptyIconBg: {
        width: 80, height: 80, borderRadius: 24,
        backgroundColor: Colors.surfaceElevated,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: Spacing.lg,
    },
    emptyTitle: { ...Typography.h2, color: Colors.text, marginBottom: 8 },
    emptySubtext: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});

export default Notifications;

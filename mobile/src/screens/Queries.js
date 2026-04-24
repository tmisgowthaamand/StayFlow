import React, { useEffect, useState, useCallback, memo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, Modal, TextInput, Linking, ScrollView } from 'react-native';
import { Colors, Spacing, Shadows, Typography, BorderRadius, Gradients } from '../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import { getQueries, replyToQuery, resolveQuery } from '../api/api';
import { MessageCircle, Phone, CheckCircle, Clock, AlertCircle, Send, X, User, ChevronRight } from 'lucide-react-native';
import { SkeletonCard, AnimatedListItem } from '../utils/animations';
import { useLanguage } from '../context/LanguageContext';

const QUICK_REPLIES = [
    'We are looking into it.',
    'Technician will visit tomorrow.',
    'Issue has been resolved. Please check now.',
    'Will be fixed within 24 hours.',
];

const statusConfig = {
    PENDING: { color: Colors.accent, bg: 'rgba(244, 63, 94, 0.1)', border: 'rgba(244, 63, 94, 0.25)', icon: AlertCircle, label: 'PENDING' },
    ACKNOWLEDGED: { color: Colors.warning, bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.25)', icon: Clock, label: 'ACKNOWLEDGED' },
    RESOLVED: { color: Colors.success, bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.25)', icon: CheckCircle, label: 'RESOLVED' },
};

const QueryCard = memo(({ item, index, onReply, onCall, onResolve }) => {
    const cfg = statusConfig[item.status] || statusConfig.PENDING;
    const StatusIcon = cfg.icon;
    const timeAgo = getTimeAgo(item.createdAt);

    return (
        <AnimatedListItem index={index}>
            <View style={[styles.card, { borderColor: cfg.border }]}>
                <View style={styles.cardTop}>
                    <View style={styles.cardAvatar}>
                        <LinearGradient colors={item.status === 'RESOLVED' ? Gradients.secondary : Gradients.accent} style={styles.avatarInner}>
                            <Text style={styles.avatarLetter}>{item.tenantName?.[0] || '?'}</Text>
                        </LinearGradient>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.cardName}>{item.tenantName}</Text>
                        <Text style={styles.cardMeta}>Room {item.room} • {item.phone}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                        <StatusIcon size={10} color={cfg.color} />
                        <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                </View>

                <View style={styles.categoryRow}>
                    <Text style={styles.categoryLabel}>{item.category || 'General'}</Text>
                    <Text style={styles.timeLabel}>⏱ {timeAgo}</Text>
                </View>

                <View style={styles.messageBox}>
                    <Text style={styles.messageText}>"{item.message}"</Text>
                </View>

                {item.adminReply && (
                    <View style={styles.replyBox}>
                        <Text style={styles.replyLabel}>Admin Reply:</Text>
                        <Text style={styles.replyText}>{item.adminReply}</Text>
                    </View>
                )}

                {item.autoReplySent && item.status === 'ACKNOWLEDGED' && !item.adminReply && (
                    <View style={[styles.replyBox, { borderColor: 'rgba(245, 158, 11, 0.2)' }]}>
                        <Text style={[styles.replyLabel, { color: Colors.warning }]}>Auto-Reply Sent</Text>
                        <Text style={styles.replyText}>Query acknowledged. Working on resolution.</Text>
                    </View>
                )}

                {item.status !== 'RESOLVED' && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity style={[styles.actionBtn, styles.replyBtn]} onPress={() => onReply(item)}>
                            <Send size={14} color="#fff" />
                            <Text style={styles.replyBtnText}>Reply</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, styles.callBtn]} onPress={() => onCall(item.phone)}>
                            <Phone size={14} color={Colors.secondary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, styles.resolveBtn]} onPress={() => onResolve(item)}>
                            <CheckCircle size={14} color={Colors.success} />
                            <Text style={styles.resolveBtnText}>Resolve</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </AnimatedListItem>
    );
});

function getTimeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

const Queries = () => {
    const [queries, setQueries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState('ALL');
    const [replyModal, setReplyModal] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [sending, setSending] = useState(false);
    const { t } = useLanguage();

    const fetchQueries = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getQueries();
            setQueries(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchQueries(); }, []);
    const onRefresh = useCallback(() => { setRefreshing(true); fetchQueries(); }, [fetchQueries]);

    const filtered = filter === 'ALL' ? queries : queries.filter(q => q.status === filter);
    const pendingCount = queries.filter(q => q.status === 'PENDING').length;
    const ackCount = queries.filter(q => q.status === 'ACKNOWLEDGED').length;
    const resolvedCount = queries.filter(q => q.status === 'RESOLVED').length;

    const handleReply = (item) => {
        setReplyModal(item);
        setReplyText('');
    };

    const handleCall = (phone) => {
        Linking.openURL(`tel:${phone}`);
    };

    const handleResolve = (item) => {
        Alert.alert('Resolve Query', `Mark query #${item.queryId} as resolved?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Resolve', onPress: async () => {
                try {
                    await resolveQuery(item.queryId);
                    Alert.alert('Done', 'Query marked as resolved');
                    fetchQueries();
                } catch (e) { Alert.alert('Error', 'Failed to resolve'); }
            }}
        ]);
    };

    const handleSendReply = async () => {
        if (!replyText.trim()) return;
        setSending(true);
        try {
            await replyToQuery(replyModal.queryId, replyText.trim());
            Alert.alert('Sent', `Reply sent to ${replyModal.tenantName} via WhatsApp`);
            setReplyModal(null);
            fetchQueries();
        } catch (e) {
            Alert.alert('Error', 'Failed to send reply');
        } finally {
            setSending(false);
        }
    };

    const renderItem = useCallback(({ item, index }) => (
        <QueryCard item={item} index={index} onReply={handleReply} onCall={handleCall} onResolve={handleResolve} />
    ), []);

    return (
        <View style={styles.container}>
            <Header title="Queries" subtitle="Tenant Issues" />

            {/* Stats Bar */}
            <View style={styles.statsRow}>
                <LinearGradient colors={['rgba(255,255,255,0.03)', 'transparent']} style={styles.statBox}>
                    <Text style={styles.statVal}>{queries.length}</Text>
                    <Text style={styles.statLab}>Total</Text>
                </LinearGradient>
                <View style={styles.statDivider} />
                <LinearGradient colors={['rgba(244,63,94,0.08)', 'transparent']} style={styles.statBox}>
                    <Text style={[styles.statVal, { color: Colors.accent }]}>{pendingCount}</Text>
                    <Text style={styles.statLab}>Pending</Text>
                </LinearGradient>
                <View style={styles.statDivider} />
                <LinearGradient colors={['rgba(245,158,11,0.08)', 'transparent']} style={styles.statBox}>
                    <Text style={[styles.statVal, { color: Colors.warning }]}>{ackCount}</Text>
                    <Text style={styles.statLab}>Ack'd</Text>
                </LinearGradient>
                <View style={styles.statDivider} />
                <LinearGradient colors={['rgba(16,185,129,0.08)', 'transparent']} style={styles.statBox}>
                    <Text style={[styles.statVal, { color: Colors.success }]}>{resolvedCount}</Text>
                    <Text style={styles.statLab}>Resolved</Text>
                </LinearGradient>
            </View>

            {/* Filter Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
                {['ALL', 'PENDING', 'ACKNOWLEDGED', 'RESOLVED'].map(f => (
                    <TouchableOpacity key={f} style={[styles.filterTab, filter === f && styles.filterActive]} onPress={() => setFilter(f)}>
                        <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                            {f === 'ALL' ? 'All' : f === 'ACKNOWLEDGED' ? 'Ack\'d' : f.charAt(0) + f.slice(1).toLowerCase()}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {loading && !refreshing ? (
                <View style={styles.listArea}><SkeletonCard /><SkeletonCard /><SkeletonCard /></View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(item) => item.queryId || item._id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listArea}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <MessageCircle size={48} color={Colors.textMuted} />
                            <Text style={styles.emptyTitle}>No queries found</Text>
                            <Text style={styles.emptySub}>Tenant queries will appear here</Text>
                        </View>
                    }
                />
            )}

            {/* Reply Modal */}
            <Modal transparent visible={!!replyModal} animationType="slide" onRequestClose={() => setReplyModal(null)}>
                <View style={styles.modalOverlay}>
                    <TouchableOpacity activeOpacity={1} style={styles.modalBackdrop} onPress={() => setReplyModal(null)} />
                    <View style={styles.modalSheet}>
                        <View style={styles.modalHandle} />
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalTitle}>Reply to #{replyModal?.queryId}</Text>
                                <Text style={styles.modalSub}>{replyModal?.tenantName} • Room {replyModal?.room}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setReplyModal(null)} style={styles.modalClose}>
                                <X size={18} color={Colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.issuePreview}>
                            <Text style={styles.issueLabel}>Issue:</Text>
                            <Text style={styles.issueText}>"{replyModal?.message}"</Text>
                        </View>

                        <Text style={styles.quickLabel}>Quick Replies:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickScroll}>
                            {QUICK_REPLIES.map((qr, i) => (
                                <TouchableOpacity key={i} style={styles.quickChip} onPress={() => setReplyText(qr)}>
                                    <Text style={styles.quickChipText}>{qr}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <View style={styles.replyInputWrap}>
                            <TextInput
                                style={styles.replyInput}
                                placeholder="Type your reply..."
                                placeholderTextColor={Colors.textMuted}
                                value={replyText}
                                onChangeText={setReplyText}
                                multiline
                                numberOfLines={3}
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.sendBtn, !replyText.trim() && { opacity: 0.5 }]}
                            onPress={handleSendReply}
                            disabled={!replyText.trim() || sending}
                        >
                            <LinearGradient colors={Gradients.primary} style={styles.sendBtnInner}>
                                <Send size={16} color="#fff" />
                                <Text style={styles.sendBtnText}>{sending ? 'Sending...' : 'Send Reply via WhatsApp'}</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    listArea: { padding: Spacing.md, paddingBottom: 100 },

    // Stats
    statsRow: { flexDirection: 'row', margin: Spacing.md, marginBottom: 0, backgroundColor: Colors.backgroundAlt, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
    statBox: { flex: 1, paddingVertical: 14, alignItems: 'center' },
    statVal: { ...Typography.h3, color: Colors.text, fontSize: 18, fontWeight: '900' },
    statLab: { ...Typography.tiny, color: Colors.textMuted, marginTop: 2, fontSize: 9 },
    statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 10 },

    // Filter
    filterScroll: { maxHeight: 48, marginTop: Spacing.sm },
    filterRow: { paddingHorizontal: Spacing.md, gap: 8 },
    filterTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
    filterActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    filterText: { ...Typography.tiny, color: Colors.textMuted, fontWeight: '700', fontSize: 11 },
    filterTextActive: { color: '#fff' },

    // Card
    card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    cardAvatar: { width: 40, height: 40 },
    avatarInner: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    avatarLetter: { color: '#fff', fontWeight: '900', fontSize: 16 },
    cardName: { ...Typography.bodyBold, color: Colors.text, fontSize: 14 },
    cardMeta: { ...Typography.tiny, color: Colors.textMuted, marginTop: 2, fontSize: 10 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
    statusText: { fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },

    categoryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 8 },
    categoryLabel: { ...Typography.tiny, color: Colors.primary, fontWeight: '700', fontSize: 10, backgroundColor: 'rgba(124,58,237,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    timeLabel: { ...Typography.tiny, color: Colors.textMuted, fontSize: 9 },

    messageBox: { backgroundColor: Colors.backgroundAlt, borderRadius: BorderRadius.md, padding: 12, borderWidth: 1, borderColor: Colors.border },
    messageText: { ...Typography.body, color: Colors.textSecondary, fontSize: 13, fontStyle: 'italic', lineHeight: 20 },

    replyBox: { backgroundColor: 'rgba(16,185,129,0.05)', borderRadius: BorderRadius.md, padding: 10, marginTop: 8, borderWidth: 1, borderColor: 'rgba(16,185,129,0.15)' },
    replyLabel: { ...Typography.tiny, color: Colors.success, fontWeight: '800', fontSize: 9, marginBottom: 4 },
    replyText: { ...Typography.bodySmall, color: Colors.textSecondary, fontSize: 12 },

    actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
    actionBtn: { borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
    replyBtn: { flex: 1, backgroundColor: Colors.primary, paddingVertical: 10, borderRadius: 10 },
    replyBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
    callBtn: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)', backgroundColor: 'rgba(16,185,129,0.05)' },
    resolveBtn: { flex: 1, borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)', backgroundColor: 'rgba(16,185,129,0.05)', paddingVertical: 10, borderRadius: 10 },
    resolveBtnText: { color: Colors.success, fontWeight: '800', fontSize: 12 },

    // Empty
    empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 12 },
    emptyTitle: { ...Typography.h3, color: Colors.textSecondary },
    emptySub: { ...Typography.bodySmall, color: Colors.textMuted },

    // Modal
    modalOverlay: { flex: 1, justifyContent: 'flex-end' },
    modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)' },
    modalSheet: { backgroundColor: Colors.backgroundAlt, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: Spacing.lg, paddingBottom: 40, borderWidth: 1, borderColor: Colors.border, borderBottomWidth: 0 },
    modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.textMuted, alignSelf: 'center', marginBottom: Spacing.md, opacity: 0.4 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
    modalTitle: { ...Typography.h3, color: Colors.text },
    modalSub: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 2 },
    modalClose: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },

    issuePreview: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: 12, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
    issueLabel: { ...Typography.tiny, color: Colors.accent, fontWeight: '800', fontSize: 9, marginBottom: 4 },
    issueText: { ...Typography.body, color: Colors.textSecondary, fontSize: 13, fontStyle: 'italic' },

    quickLabel: { ...Typography.tiny, color: Colors.textMuted, fontWeight: '700', fontSize: 10, marginBottom: 8 },
    quickScroll: { maxHeight: 40, marginBottom: Spacing.md },
    quickChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, marginRight: 8 },
    quickChipText: { ...Typography.tiny, color: Colors.textSecondary, fontSize: 10 },

    replyInputWrap: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md },
    replyInput: { padding: 14, color: Colors.text, fontSize: 14, minHeight: 80, textAlignVertical: 'top' },

    sendBtn: { borderRadius: BorderRadius.md, overflow: 'hidden' },
    sendBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
    sendBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});

export default Queries;

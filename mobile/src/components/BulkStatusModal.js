import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, ActivityIndicator } from 'react-native';
import { Colors, Spacing, Typography, BorderRadius, Gradients, Shadows } from '../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle, XCircle, Clock, Send, X, AlertTriangle } from 'lucide-react-native';
import { getBulkStatus } from '../api/api';

const BulkStatusModal = ({ visible, onClose, onComplete }) => {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const pollTimer = useRef(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const fetchStatus = async () => {
        try {
            const data = await getBulkStatus();
            setStatus(data);
            if (data.status === 'completed' || data.status === 'idle') {
                if (pollTimer.current) clearInterval(pollTimer.current);
                if (data.status === 'completed' && onComplete) onComplete();
            }
        } catch (e) {
            console.error('Status fetch error:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (visible) {
            setLoading(true);
            fetchStatus();
            pollTimer.current = setInterval(fetchStatus, 2000);
            Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
        } else {
            if (pollTimer.current) clearInterval(pollTimer.current);
            fadeAnim.setValue(0);
        }
        return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
    }, [visible]);

    if (!status && loading) return null;

    const progress = status ? (status.total > 0 ? (status.sent + status.failed + status.skipped) / status.total : 0) : 0;
    const isRunning = status?.status === 'running';

    return (
        <Modal transparent visible={visible} animationType="fade">
            <View style={styles.overlay}>
                <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Bulk Notification Status</Text>
                        {!isRunning && (
                            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                <X size={20} color={Colors.textMuted} />
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={styles.body}>
                        {isRunning ? (
                            <View style={styles.runningState}>
                                <ActivityIndicator size="large" color={Colors.secondary} />
                                <Text style={styles.statusText}>Sending Invoices...</Text>
                                <View style={styles.progressContainer}>
                                    <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
                                </View>
                                <Text style={styles.progressLabel}>{Math.round(progress * 100)}% Complete</Text>
                            </View>
                        ) : (
                            <View style={styles.resultsContainer}>
                                <View style={styles.resultRow}>
                                    <View style={[styles.iconBox, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                                        <CheckCircle size={20} color={Colors.secondary} />
                                    </View>
                                    <View style={styles.resultInfo}>
                                        <Text style={styles.resultVal}>{status?.sent || 0}</Text>
                                        <Text style={styles.resultLab}>Successfully Sent</Text>
                                    </View>
                                </View>

                                <View style={styles.resultRow}>
                                    <View style={[styles.iconBox, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                                        <XCircle size={20} color={Colors.accent} />
                                    </View>
                                    <View style={styles.resultInfo}>
                                        <Text style={styles.resultVal}>{status?.failed || 0}</Text>
                                        <Text style={styles.resultLab}>Failed</Text>
                                    </View>
                                </View>

                                <View style={styles.resultRow}>
                                    <View style={[styles.iconBox, { backgroundColor: 'rgba(107, 114, 128, 0.1)' }]}>
                                        <Clock size={20} color={Colors.textMuted} />
                                    </View>
                                    <View style={styles.resultInfo}>
                                        <Text style={styles.resultVal}>{status?.skipped || 0}</Text>
                                        <Text style={styles.resultLab}>Skipped (Already Paid)</Text>
                                    </View>
                                </View>

                                {status?.failedList?.length > 0 && (
                                    <View style={styles.failureBox}>
                                        <View style={styles.failureHeader}>
                                            <AlertTriangle size={14} color={Colors.accent} />
                                            <Text style={styles.failureTitle}>Failures ({status.failedList.length})</Text>
                                        </View>
                                        <Text style={styles.failureList}>{status.failedList.join(', ')}</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>

                    {!isRunning && (
                        <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
                            <LinearGradient colors={Gradients.secondary} style={styles.doneGradient}>
                                <Text style={styles.doneBtnText}>Close Report</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    )}
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    container: { backgroundColor: Colors.background, borderRadius: BorderRadius.xl, width: '100%', maxWidth: 400, ...Shadows.lg, overflow: 'hidden' },
    header: { padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { ...Typography.h3, color: Colors.text },
    closeBtn: { padding: 4 },
    body: { padding: 20 },
    statusText: { ...Typography.bodyBold, color: Colors.text, marginTop: 15, textAlign: 'center' },
    progressContainer: { height: 8, backgroundColor: Colors.border, borderRadius: 4, width: '100%', marginTop: 20, overflow: 'hidden' },
    progressBar: { height: '100%', backgroundColor: Colors.secondary },
    progressLabel: { ...Typography.tiny, color: Colors.textMuted, marginTop: 8, textAlign: 'center' },
    runningState: { alignItems: 'center', paddingVertical: 10 },
    resultsContainer: { gap: 15 },
    resultRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
    iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    resultInfo: { flex: 1 },
    resultVal: { ...Typography.h3, color: Colors.text, lineHeight: 22 },
    resultLab: { ...Typography.tiny, color: Colors.textMuted },
    failureBox: { backgroundColor: 'rgba(239, 68, 68, 0.05)', padding: 12, borderRadius: BorderRadius.md, marginTop: 10, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.1)' },
    failureHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
    failureTitle: { ...Typography.tiny, color: Colors.accent, fontWeight: '700' },
    failureList: { ...Typography.tiny, color: Colors.textSecondary, lineHeight: 16 },
    doneBtn: { margin: 20, marginTop: 0, borderRadius: BorderRadius.md, overflow: 'hidden' },
    doneGradient: { height: 50, alignItems: 'center', justifyContent: 'center' },
    doneBtnText: { ...Typography.bodyBold, color: '#fff' }
});

export default BulkStatusModal;

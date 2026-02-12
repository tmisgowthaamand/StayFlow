import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Animated, Easing } from 'react-native';
import { Colors, Spacing, Shadows, Typography, BorderRadius, Gradients } from '../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import { broadcastMessage } from '../api/api';
import { Megaphone, Paperclip, X, Send } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useFadeSlideIn, usePressAnimation } from '../utils/animations';

const Announcements = ({ navigation }) => {
    const [message, setMessage] = useState('');
    const [attachment, setAttachment] = useState(null);
    const [loading, setLoading] = useState(false);

    // Animations
    const cardAnim = useFadeSlideIn(100, 500, 30);
    const { scaleStyle: sendPress, onPressIn: sendIn, onPressOut: sendOut } = usePressAnimation(0.95);

    // Attachment badge animation
    const attachAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.spring(attachAnim, {
            toValue: attachment ? 1 : 0,
            friction: 6,
            tension: 60,
            useNativeDriver: true,
        }).start();
    }, [attachment]);

    // Character count animation
    const charPct = message.length / 1000;
    const charColor = charPct > 0.9 ? Colors.danger : charPct > 0.7 ? Colors.warning : Colors.textMuted;

    const handlePickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'video/*', 'application/pdf'], copyToCacheDirectory: true });
            if (!result.canceled && result.assets?.length > 0) {
                const file = result.assets[0];
                if (file.size > 10 * 1024 * 1024) { Alert.alert('File too large', 'Max 10MB'); return; }
                setAttachment(file);
            }
        } catch (err) { console.log('Picker Error:', err); }
    };

    const handleSend = async () => {
        if (!message.trim() && !attachment) { Alert.alert('Empty', 'Enter a message or attach a file.'); return; }
        Alert.alert('Confirm Broadcast', 'Send to ALL active residents?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Send Now', onPress: async () => {
                    try {
                        setLoading(true);
                        const formData = new FormData();
                        if (message.trim()) formData.append('message', message);
                        if (attachment) formData.append('file', { uri: attachment.uri, name: attachment.name, type: attachment.mimeType || 'application/octet-stream' });
                        await broadcastMessage(formData, true);
                        Alert.alert('Success', 'Announcement sent!');
                        setMessage(''); setAttachment(null); navigation.goBack();
                    } catch (e) { Alert.alert('Error', 'Failed to send'); console.error(e); }
                    finally { setLoading(false); }
                }
            }
        ]);
    };

    const hasContent = message.trim() || attachment;

    return (
        <View style={styles.container}>
            <Header title="Announcement" />
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Animated.View style={[styles.card, Shadows.md, cardAnim]}>
                    <View style={styles.headerRow}>
                        <LinearGradient colors={Gradients.cool} style={styles.headerIconBg}>
                            <Megaphone size={20} color="#fff" />
                        </LinearGradient>
                        <View>
                            <Text style={styles.title}>Broadcast Message</Text>
                            <Text style={styles.helperText}>Send to all residents via WhatsApp</Text>
                        </View>
                    </View>

                    <TextInput
                        style={styles.textArea}
                        placeholder="Type your announcement here..."
                        placeholderTextColor={Colors.textMuted}
                        multiline numberOfLines={6}
                        textAlignVertical="top"
                        value={message}
                        onChangeText={setMessage}
                        maxLength={1000}
                    />

                    {/* Character counter */}
                    <View style={styles.charCountRow}>
                        <Text style={[styles.charCount, { color: charColor }]}>{message.length}/1000</Text>
                    </View>

                    {/* Attachment — animated entrance */}
                    {attachment ? (
                        <Animated.View style={[styles.attachmentBadge, { opacity: attachAnim, transform: [{ scale: attachAnim }] }]}>
                            <View style={styles.attachmentInfo}>
                                <Paperclip size={14} color={Colors.primary} />
                                <Text style={styles.attachmentName} numberOfLines={1}>{attachment.name}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setAttachment(null)} style={styles.removeBtn}>
                                <X size={16} color={Colors.textSecondary} />
                            </TouchableOpacity>
                        </Animated.View>
                    ) : (
                        <TouchableOpacity style={styles.attachButton} onPress={handlePickDocument}>
                            <Paperclip size={18} color={Colors.textMuted} />
                            <Text style={styles.attachText}>Attach Image / Video / PDF</Text>
                        </TouchableOpacity>
                    )}

                    <Animated.View style={sendPress}>
                        <TouchableOpacity disabled={loading || !hasContent} onPress={handleSend} onPressIn={sendIn} onPressOut={sendOut} activeOpacity={1}>
                            <LinearGradient colors={!hasContent ? [Colors.surfaceElevated, Colors.surfaceElevated] : Gradients.primary} style={[styles.sendButton, !hasContent && styles.sendButtonDisabled]}>
                                {loading ? <ActivityIndicator color="#fff" /> : (
                                    <>
                                        <Send size={18} color={!hasContent ? Colors.textMuted : '#fff'} />
                                        <Text style={[styles.sendButtonText, !hasContent && { color: Colors.textMuted }]}>Send Announcement</Text>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>
                </Animated.View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    content: { padding: Spacing.md },
    card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: Spacing.lg },
    headerIconBg: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    title: { ...Typography.h3, color: Colors.text },
    helperText: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
    textArea: { backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: 14, ...Typography.body, minHeight: 130, marginBottom: 4, color: Colors.text },
    charCountRow: { alignItems: 'flex-end', marginBottom: Spacing.md },
    charCount: { ...Typography.tiny },
    attachButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed', borderRadius: BorderRadius.md, marginBottom: Spacing.lg, gap: 8 },
    attachText: { ...Typography.caption, color: Colors.textMuted, fontWeight: '600' },
    attachmentBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(108,99,255,0.1)', padding: 12, borderRadius: BorderRadius.sm, marginBottom: Spacing.lg, borderWidth: 1, borderColor: 'rgba(108,99,255,0.2)' },
    attachmentInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    attachmentName: { ...Typography.caption, color: Colors.primary, fontWeight: '600', flex: 1 },
    removeBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
    sendButton: { flexDirection: 'row', padding: 16, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', gap: 8 },
    sendButtonDisabled: { borderWidth: 1, borderColor: Colors.border },
    sendButtonText: { color: '#fff', ...Typography.bodyBold, fontSize: 16 },
});

export default Announcements;

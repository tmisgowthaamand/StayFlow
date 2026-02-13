import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Animated, Easing } from 'react-native';
import { Colors, Spacing, Shadows, Typography, BorderRadius, Gradients } from '../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import { sendAnnouncement } from '../api/api';
import { Megaphone, Paperclip, X, Send } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useFadeSlideIn, usePressAnimation, AnimatedListItem } from '../utils/animations';
import { notifyAnnouncement } from '../utils/notifications';

const Announcements = ({ navigation }) => {
    const [message, setMessage] = useState('');
    const [attachment, setAttachment] = useState(null);
    const [loading, setLoading] = useState(false);

    const entranceAnim = useFadeSlideIn(100, 600, 20);
    const { scaleStyle: sendPress, onPressIn: sendIn, onPressOut: sendOut } = usePressAnimation(0.97);

    const handlePickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'video/*', 'application/pdf'] });
            if (!result.canceled && result.assets?.length > 0) {
                setAttachment(result.assets[0]);
            }
        } catch (err) { console.log(err); }
    };

    const handleSend = async () => {
        if (!message.trim() && !attachment) return;
        try {
            setLoading(true);
            const formData = new FormData();
            if (message.trim()) formData.append('message', message);
            if (attachment) formData.append('file', { uri: attachment.uri, name: attachment.name, type: attachment.mimeType || 'application/octet-stream' });
            await sendAnnouncement(formData, true);
            notifyAnnouncement(message, 'residents');
            Alert.alert('Success', 'Announcement sending started! Residents will receive it shortly.');
            navigation.goBack();
        } catch (e) {
            Alert.alert('Error', 'Announcement channel failed: ' + (e.message || 'Network Error'));
        } finally { setLoading(false); }
    };

    const hasContent = message.trim() || attachment;

    return (
        <View style={styles.container}>
            <Header title="Announcement" onBack={() => navigation.goBack()} />
            <ScrollView contentContainerStyle={styles.content}>
                <Animated.View style={[styles.messageCard, entranceAnim]}>
                    <View style={styles.cardTop}>
                        <Megaphone size={16} color={Colors.primary} />
                        <Text style={styles.cardBatch}>WHATSAPP CHANNEL</Text>
                    </View>

                    <TextInput
                        style={styles.composer}
                        placeholder="Draft your announcement here..."
                        placeholderTextColor={Colors.textMuted}
                        multiline
                        value={message}
                        onChangeText={setMessage}
                        maxLength={1000}
                    />

                    <View style={styles.cardFooter}>
                        {attachment ? (
                            <View style={styles.filePill}>
                                <Paperclip size={14} color={Colors.primary} />
                                <Text style={styles.fileName} numberOfLines={1}>{attachment.name}</Text>
                                <TouchableOpacity onPress={() => setAttachment(null)} style={styles.removeFile}>
                                    <X size={14} color={Colors.textSecondary} />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity style={styles.attachControl} onPress={handlePickDocument}>
                                <Paperclip size={16} color={Colors.textMuted} />
                                <Text style={styles.attachText}>Add media or document</Text>
                            </TouchableOpacity>
                        )}
                        <Text style={styles.countText}>{message.length}/1000</Text>
                    </View>
                </Animated.View>

                <Animated.View style={[sendPress, { marginTop: 32 }]}>
                    <TouchableOpacity
                        disabled={loading || !hasContent}
                        onPress={handleSend}
                        onPressIn={sendIn}
                        onPressOut={sendOut}
                        activeOpacity={1}
                        style={styles.sendTrigger}
                    >
                        <LinearGradient
                            colors={hasContent ? Gradients.primary : [Colors.surfaceElevated, Colors.surfaceElevated]}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                            style={styles.gradientBtn}
                        >
                            {loading ? <ActivityIndicator color="#fff" /> : (
                                <>
                                    <Send size={20} color={hasContent ? "#fff" : Colors.textMuted} />
                                    <Text style={[styles.btnText, { color: hasContent ? "#fff" : Colors.textMuted }]}>
                                        SEND TO ALL
                                    </Text>
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </Animated.View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    content: { padding: Spacing.md },
    messageCard: {
        backgroundColor: Colors.backgroundAlt,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
        minHeight: 280,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
    cardBatch: { ...Typography.tiny, color: Colors.primary, letterSpacing: 1, fontWeight: '800' },
    composer: {
        ...Typography.body,
        color: Colors.text,
        flex: 1,
        textAlignVertical: 'top',
        padding: 0,
        fontSize: 16,
        lineHeight: 24,
    },
    cardFooter: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    attachControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    attachText: { ...Typography.tiny, color: Colors.textSecondary },
    filePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: Colors.surface,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        flex: 1,
        marginRight: 12,
        borderWidth: 1,
        borderColor: Colors.border
    },
    fileName: { ...Typography.tiny, color: Colors.text, flex: 1, fontWeight: '600' },
    removeFile: { padding: 2 },
    countText: { ...Typography.tiny, color: Colors.textMuted, fontSize: 10 },

    sendTrigger: { borderRadius: BorderRadius.md, overflow: 'hidden' },
    gradientBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 60,
        gap: 12,
        ...Shadows.glow(Colors.primary, 0.2),
    },
    btnText: { ...Typography.bodyBold, letterSpacing: 1.5, fontSize: 13 },
});

export default Announcements;

import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Animated, Easing, Image } from 'react-native';
import { Colors, Spacing, Shadows, Typography, BorderRadius, Gradients } from '../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import { sendAnnouncement } from '../api/api';
import { Megaphone, Paperclip, X, Send, Image as ImageIcon } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useFadeSlideIn, usePressAnimation, AnimatedListItem } from '../utils/animations';
import { notifyAnnouncement } from '../utils/notifications';
import { useLanguage } from '../context/LanguageContext';

const Announcements = ({ navigation, route }) => {
    const recipient = route.params?.recipient;
    const [message, setMessage] = useState('');
    const [attachment, setAttachment] = useState(null);
    const { t } = useLanguage();
    const [loading, setLoading] = useState(false);

    const entranceAnim = useFadeSlideIn(100, 600, 20);
    const { scaleStyle: sendPress, onPressIn: sendIn, onPressOut: sendOut } = usePressAnimation(0.97);

    const handlePickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
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
            if (attachment) formData.append('file', {
                uri: attachment.uri,
                name: attachment.name,
                type: attachment.mimeType || 'application/octet-stream'
            });

            if (recipient?.Phone) {
                formData.append('phone', recipient.Phone);
                formData.append('name', recipient.Name);
            }

            const response = await sendAnnouncement(formData, true);
            const serverImageUrl = response.imageUrl || response.fileUrl || response.url;

            // Only notify globally if it was a broadcast
            if (!recipient) {
                notifyAnnouncement(message, 'residents', serverImageUrl || (attachment?.mimeType?.startsWith('image/') ? attachment.uri : null));
            }

            Alert.alert(t('success'), recipient ? t('message_sent') : t('announcement_sent'));
            navigation.goBack();
        } catch (e) {
            Alert.alert(t('error'), (recipient ? t('message_failed') : t('announcement_failed')) + (e.message || t('network_error')));
        } finally { setLoading(false); }
    };

    const hasContent = message.trim() || attachment;

    return (
        <View style={styles.container}>
            <Header title={recipient ? t('send_message') : t('announcement')} onBack={() => navigation.goBack()} />
            <ScrollView contentContainerStyle={styles.content}>
                <Animated.View style={[styles.messageCard, entranceAnim]}>
                    <View style={styles.cardTop}>
                        <Megaphone size={16} color={Colors.primary} />
                        <Text style={styles.cardBatch}>
                            {recipient ? `${t('to').toUpperCase()}: ${recipient.Name}` : t('whatsapp_channel').toUpperCase()}
                        </Text>
                    </View>

                    <TextInput
                        style={styles.composer}
                        placeholder={recipient ? t('type_message') : t('draft_announcement')}
                        placeholderTextColor={Colors.textMuted}
                        multiline
                        value={message}
                        onChangeText={setMessage}
                        maxLength={1000}
                    />

                    <View style={styles.cardFooter}>
                        {attachment ? (
                            <View style={styles.attachmentWrapper}>
                                {attachment.mimeType?.startsWith('image/') && (
                                    <Image source={{ uri: attachment.uri }} style={styles.previewImage} />
                                )}
                                <View style={styles.filePill}>
                                    <Paperclip size={14} color={Colors.primary} />
                                    <Text style={styles.fileName} numberOfLines={1}>{attachment.name}</Text>
                                    <TouchableOpacity onPress={() => setAttachment(null)} style={styles.removeFile}>
                                        <X size={14} color={Colors.textSecondary} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <TouchableOpacity style={styles.attachControl} onPress={handlePickDocument}>
                                <Paperclip size={16} color={Colors.textMuted} />
                                <Text style={styles.attachText}>{t('add_media')}</Text>
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
                                        {recipient ? t('send_message').toUpperCase() : t('send_to_all').toUpperCase()}
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
    attachmentWrapper: { flex: 1, marginRight: 12 },
    previewImage: {
        width: '100%',
        height: 120,
        borderRadius: 10,
        marginBottom: 8,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border
    },
    filePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: Colors.surface,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
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

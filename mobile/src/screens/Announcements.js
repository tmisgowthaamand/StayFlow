import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import { Colors, Spacing, Shadows } from '../theme/theme';
import Header from '../components/Header';
import { broadcastMessage } from '../api/api'; // We will update this to handle FormData
import { Megaphone, Paperclip, X } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';

const Announcements = ({ navigation }) => {
    const [message, setMessage] = useState('');
    const [attachment, setAttachment] = useState(null);
    const [loading, setLoading] = useState(false);

    const handlePickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['image/*', 'video/*', 'application/pdf'],
                copyToCacheDirectory: true
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const file = result.assets[0];
                // Limit file size to 10MB approx
                if (file.size > 10 * 1024 * 1024) {
                    Alert.alert('File too large', 'Please select a file smaller than 10MB');
                    return;
                }
                setAttachment(file);
            }
        } catch (err) {
            console.log('Document Picker Error:', err);
        }
    };

    const handleRemoveAttachment = () => {
        setAttachment(null);
    };

    const handleSend = async () => {
        if (!message.trim() && !attachment) {
            Alert.alert('Empty Announcement', 'Please enter a message or attach a file.');
            return;
        }

        Alert.alert(
            'Confirm Broadcast',
            'Send this announcement to ALL active residents?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Send Now',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            // Prepare FormData
                            const formData = new FormData();
                            if (message.trim()) formData.append('message', message);
                            if (attachment) {
                                formData.append('file', {
                                    uri: attachment.uri,
                                    name: attachment.name,
                                    type: attachment.mimeType || 'application/octet-stream'
                                });
                            }

                            // We need to update api.js to handle multipart/form-data for broadcast
                            // Currently broadcastMessage expects JSON. 
                            // We will assume api.js broadcastMessage is updated or we create a new one.
                            // Let's call a specific function for multipart.
                            await broadcastMessage(formData, true); // Pass true flag for multipart

                            Alert.alert('Success', 'Announcement sent successfully!');
                            setMessage('');
                            setAttachment(null);
                            navigation.goBack();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to send announcement');
                            console.error(error);
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <Header title="New Announcement" />
            <ScrollView contentContainerStyle={styles.content}>

                <View style={[styles.card, Shadows.md]}>
                    <View style={styles.headerRow}>
                        <Megaphone size={24} color={Colors.primary} />
                        <Text style={styles.title}>Broadcast Message</Text>
                    </View>

                    <Text style={styles.helperText}>
                        Send a notification to all residents via WhatsApp.
                    </Text>

                    <TextInput
                        style={styles.textArea}
                        placeholder="Type your announcement here..."
                        multiline
                        numberOfLines={6}
                        textAlignVertical="top"
                        value={message}
                        onChangeText={setMessage}
                    />

                    {/* Attachment Section */}
                    {attachment ? (
                        <View style={styles.attachmentBadge}>
                            <View style={styles.attachmentInfo}>
                                <Paperclip size={16} color={Colors.primary} />
                                <Text style={styles.attachmentName} numberOfLines={1}>
                                    {attachment.name}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={handleRemoveAttachment}>
                                <X size={20} color={Colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.attachButton} onPress={handlePickDocument}>
                            <Paperclip size={20} color={Colors.textSecondary} />
                            <Text style={styles.attachText}>Attach Image / Video / PDF</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={[styles.sendButton, (!message && !attachment) && styles.sendButtonDisabled]}
                        onPress={handleSend}
                        disabled={loading || (!message && !attachment)}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.sendButtonText}>Send Announcement</Text>
                        )}
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    content: { padding: Spacing.md },
    card: { backgroundColor: Colors.surface, borderRadius: 16, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing.sm },
    title: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
    helperText: { fontSize: 14, color: Colors.textSecondary, marginBottom: Spacing.lg },
    textArea: {
        backgroundColor: Colors.background,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: 12,
        padding: 12,
        fontSize: 16,
        minHeight: 120,
        marginBottom: Spacing.md,
        color: Colors.text
    },
    attachButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderWidth: 1,
        borderColor: Colors.border,
        borderStyle: 'dashed',
        borderRadius: 12,
        marginBottom: Spacing.lg,
        gap: 8
    },
    attachText: { color: Colors.textSecondary, fontWeight: '600' },
    attachmentBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#EFF6FF',
        padding: 12,
        borderRadius: 8,
        marginBottom: Spacing.lg,
        borderWidth: 1,
        borderColor: '#BFDBFE'
    },
    attachmentInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    attachmentName: { fontSize: 14, color: '#1E40AF', fontWeight: '500' },
    sendButton: {
        backgroundColor: Colors.primary,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: Colors.textSecondary,
        opacity: 0.7
    },
    sendButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16
    }
});

export default Announcements;

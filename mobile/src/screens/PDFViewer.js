import React, { useState } from 'react';
import { StyleSheet, View, ActivityIndicator, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { Colors } from '../theme/theme';
import Header from '../components/Header';

const PDFViewer = ({ route }) => {
    const { url, title } = route.params;

    // Use Google Docs Viewer for Android, direct for iOS
    const viewerUrl = Platform.OS === 'android'
        ? `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`
        : url;

    return (
        <View style={styles.container}>
            <Header title={title || "Document Viewer"} />
            <WebView
                source={{ uri: viewerUrl }}
                style={{ flex: 1 }}
                startInLoadingState={true}
                renderLoading={() => (
                    <ActivityIndicator
                        color={Colors.primary}
                        size="large"
                        style={styles.loading}
                    />
                )}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    loading: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center'
    }
});

export default PDFViewer;

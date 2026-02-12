import React from 'react';
import { StyleSheet, View, ActivityIndicator, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { Colors } from '../theme/theme';
import Header from '../components/Header';

const PDFViewer = ({ route, navigation }) => {
    const { url, title } = route.params;

    const viewerUrl = Platform.OS === 'android'
        ? `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`
        : url;

    return (
        <View style={styles.container}>
            <Header title={title || 'Document Viewer'} onBack={() => navigation.goBack()} />
            <WebView
                source={{ uri: viewerUrl }}
                style={{ flex: 1 }}
                startInLoadingState={true}
                renderLoading={() => (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator
                            color={Colors.primary}
                            size="large"
                        />
                    </View>
                )}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    loadingContainer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: Colors.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default PDFViewer;

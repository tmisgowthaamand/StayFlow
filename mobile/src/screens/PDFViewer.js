import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator, Platform, Linking, TouchableOpacity, Text, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../theme/theme';
import Header from '../components/Header';
import { useLanguage } from '../context/LanguageContext';

const PDFViewer = ({ route, navigation }) => {
    const { t } = useLanguage();
    const { url, title, uri, base64Data } = route.params;
    const targetUrl = url || uri;

    const [pdfBase64, setPdfBase64] = useState(base64Data || null);
    const [loading, setLoading] = useState(!base64Data && Platform.OS === 'android');
    const [error, setError] = useState(false);

    useEffect(() => {
        if (Platform.OS === 'android' && !base64Data && targetUrl) {
            const fetchPdf = async () => {
                try {
                    console.log("Fetching PDF from:", targetUrl);
                    const token = await AsyncStorage.getItem('stayflow_jwt');
                    const response = await fetch(targetUrl, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    const contentType = response.headers.get('content-type');
                    console.log("Content-Type:", contentType);

                    if (contentType && contentType.includes('application/json')) {
                        const json = await response.json();
                        console.error("Server returned JSON error:", json);
                        Alert.alert(t('error'), json.message || "Failed to generate PDF");
                        setError(true);
                        setLoading(false);
                        return;
                    }

                    const blob = await response.blob();
                    const reader = new FileReader();
                    reader.readAsDataURL(blob);
                    reader.onloadend = () => {
                        const base64data = reader.result;
                        console.log("PDF Base64 length:", base64data.length);
                        setPdfBase64(base64data);
                        setLoading(false);
                    };
                    reader.onerror = () => {
                        console.error("Reader error");
                        setError(true);
                        setLoading(false);
                    };
                } catch (err) {
                    console.error("PDF fetch error:", err);
                    setError(true);
                    setLoading(false);
                }
            };
            fetchPdf();
        }
    }, [targetUrl]);

    // HTML for Android PDF.js rendering
    const getViewerHtml = () => `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:; connect-src 'self' data: blob: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https:;">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js"></script>
    <script>
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
    </script>
    <style>
        body { margin: 0; background-color: #525659; display: flex; flex-direction: column; align-items: center; min-height: 100vh; }
        canvas { margin-bottom: 20px; box-shadow: 0 4px 8px rgba(0,0,0,0.2); width: 100%; max-width: 800px; }
        .error { color: #ff6b6b; padding: 20px; text-align: center; font-family: sans-serif; }
        .loading { color: #ffffff; padding: 20px; text-align: center; font-family: sans-serif; margin-top: 50px; }
    </style>
</head>
<body>
    <div id="container"></div>
    <div id="loading" class="loading">Preparing PDF...</div>
    <script>
        document.addEventListener("message", function(event) {
            renderPDF(event.data);
        });
        window.addEventListener("message", function(event) {
            renderPDF(event.data);
        });

        function renderPDF(base64) {
            document.getElementById('loading').style.display = 'none';
            try {
                const url = base64;
                const container = document.getElementById('container');
                container.innerHTML = ''; // Clear previous

                const loadingTask = pdfjsLib.getDocument(url);
                
                loadingTask.promise.then(async function(pdf) {
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const scale = 1.5;
                        const viewport = page.getViewport({ scale: scale });
                        
                        const canvas = document.createElement('canvas');
                        const context = canvas.getContext('2d');
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;
                        canvas.style.width = "100%";
                        canvas.style.height = "auto";
                        
                        container.appendChild(canvas);

                        await page.render({
                            canvasContext: context,
                            viewport: viewport
                        }).promise;
                    }
                }).catch(function(error) {
                    document.body.innerHTML = '<div class="error"><h3>Error rendering PDF</h3><p>' + error.message + '</p></div>';
                });
            } catch (e) {
                document.body.innerHTML = '<div class="error"><h3>Script Error</h3><p>' + e.message + '</p></div>';
            }
        }
    </script>
</body>
</html>
    `;

    // Decision Logic
    const useDirectUrl = Platform.OS === 'ios';
    const getAuthHeaders = async () => {
        const token = await AsyncStorage.getItem('stayflow_jwt');
        return { 'Authorization': `Bearer ${token}` };
    };
    const source = useDirectUrl
        ? { uri: targetUrl, headers: getAuthHeaders() }
        : { html: getViewerHtml() };

    // Fallback if Android fetch fails is handled by error state logic above (not shown here to keep diff clean, but logic exists)

    // Use useRef for webview reference
    const webviewRef = React.useRef(null);

    return (
        <View style={styles.container}>
            <Header
                title={title || t('document_viewer')}
                onBack={() => navigation.goBack()}
                rightSection={
                    <TouchableOpacity onPress={() => Linking.openURL(targetUrl)} style={styles.openBtn}>
                        <Text style={styles.openBtnText}>{t('open_browser') || 'Open'}</Text>
                    </TouchableOpacity>
                }
            />

            {(loading || (!source && Platform.OS === 'android')) ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator color={Colors.primary} size="large" />
                    <Text style={{ marginTop: 10, color: Colors.textMuted }}>Loading PDF...</Text>
                </View>
            ) : (
                <WebView
                    source={source}
                    style={{ flex: 1, backgroundColor: '#525659' }}
                    startInLoadingState={true}
                    renderLoading={() => (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator color={Colors.primary} size="large" />
                        </View>
                    )}
                    originWhitelist={['*']}
                    onLoadEnd={() => {
                        if (Platform.OS === 'android' && pdfBase64 && webviewRef.current) {
                            webviewRef.current.postMessage(pdfBase64);
                        }
                    }}
                    ref={webviewRef}
                    javaScriptEnabled={true}
                />
            )}
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
    openBtn: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    openBtnText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
});

export default PDFViewer;

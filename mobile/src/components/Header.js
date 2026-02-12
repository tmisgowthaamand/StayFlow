import React, { useRef, useEffect, useState, memo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar, Animated, Easing } from 'react-native';
import { Colors, Spacing, Typography, Gradients } from '../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Menu, Bell } from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getUnreadCount } from '../utils/notifications';

const Header = memo(({ title, onMenuPress, onBack, subtitle = 'StayFlow PG Management', showNotifBell = true }) => {
    const navigation = useNavigation();
    const [unreadCount, setUnreadCount] = useState(0);

    // Slide down + fade in
    const translateY = useRef(new Animated.Value(-30)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const accentWidth = useRef(new Animated.Value(0)).current;

    // Bell badge animation
    const badgeScale = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration: 450,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: 0,
                duration: 450,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start();

        Animated.timing(accentWidth, {
            toValue: 1,
            duration: 600,
            delay: 300,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start();
    }, []);

    // Load unread count on focus
    useFocusEffect(
        useCallback(() => {
            const loadCount = async () => {
                const count = await getUnreadCount();
                setUnreadCount(count);
                if (count > 0) {
                    Animated.spring(badgeScale, {
                        toValue: 1,
                        friction: 4,
                        tension: 80,
                        useNativeDriver: true,
                    }).start();
                } else {
                    badgeScale.setValue(0);
                }
            };
            loadCount();
        }, [])
    );

    const handleNotifPress = useCallback(() => {
        navigation.navigate('Notifications');
    }, [navigation]);

    return (
        <Animated.View style={[styles.container, { opacity, transform: [{ translateY }] }]}>
            <LinearGradient
                colors={Gradients.header}
                style={styles.gradient}
            >
                <View style={styles.content}>
                    {onBack && (
                        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
                            <ArrowLeft color={Colors.text} size={22} />
                        </TouchableOpacity>
                    )}
                    {onMenuPress && (
                        <TouchableOpacity onPress={onMenuPress} style={styles.menuButton} activeOpacity={0.7}>
                            <Menu color={Colors.text} size={22} />
                        </TouchableOpacity>
                    )}
                    <View style={styles.titleContainer}>
                        <Text style={styles.titleText}>{title}</Text>
                        {subtitle && <Text style={styles.subtitleText}>{subtitle}</Text>}
                    </View>

                    {showNotifBell && (
                        <TouchableOpacity onPress={handleNotifPress} style={styles.bellButton} activeOpacity={0.7}>
                            <Bell color={Colors.text} size={22} />
                            {unreadCount > 0 && (
                                <Animated.View style={[styles.badge, { transform: [{ scale: badgeScale }] }]}>
                                    <LinearGradient colors={['#EF4444', '#DC2626']} style={styles.badgeGradient}>
                                        <Text style={styles.badgeText}>
                                            {unreadCount > 9 ? '9+' : unreadCount}
                                        </Text>
                                    </LinearGradient>
                                </Animated.View>
                            )}
                        </TouchableOpacity>
                    )}
                </View>

                {/* Animated accent bar */}
                <Animated.View style={[styles.accentBarContainer, {
                    transform: [{ scaleX: accentWidth }],
                }]}>
                    <LinearGradient
                        colors={Gradients.cool}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.accentBar}
                    />
                </Animated.View>
            </LinearGradient>
        </Animated.View>
    );
});

const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 0);

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
    },
    gradient: {
        paddingTop: STATUSBAR_HEIGHT + 8,
        paddingBottom: 14,
        paddingHorizontal: Spacing.lg,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: Colors.surfaceGlass,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    menuButton: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: Colors.surfaceGlass,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    titleContainer: {
        flex: 1,
    },
    titleText: {
        ...Typography.h2,
        color: Colors.text,
    },
    subtitleText: {
        ...Typography.tiny,
        color: Colors.textMuted,
        marginTop: 2,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    bellButton: {
        width: 42,
        height: 42,
        borderRadius: 14,
        backgroundColor: Colors.surfaceGlass,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
    badge: {
        position: 'absolute',
        top: -3,
        right: -3,
    },
    badgeGradient: {
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        borderWidth: 2,
        borderColor: Colors.background,
    },
    badgeText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#fff',
    },
    accentBarContainer: {
        marginTop: 12,
        transformOrigin: 'left',
    },
    accentBar: {
        height: 3,
        borderRadius: 2,
    },
});

export default Header;

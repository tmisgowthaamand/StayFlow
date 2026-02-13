import React, { useRef, useEffect, useState, memo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar, Animated, Easing, TextInput } from 'react-native';
import { Colors, Spacing, Typography, Gradients, Shadows, BorderRadius } from '../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Bell, Search, User, Zap, Menu, X } from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getUnreadCount } from '../utils/notifications';
import { useTheme } from '../context/ThemeContext';

const Header = memo(({ title, onMenuPress, onBack, subtitle, showNotifBell = true, transparent = false, onSearchChange, placeholder = "Search...", rightSection, initialSearchValue = '' }) => {
    const navigation = useNavigation();
    const { colors } = useTheme();
    const [unreadCount, setUnreadCount] = useState(0);
    const [isSearching, setIsSearching] = useState(!!initialSearchValue);
    const [searchQuery, setSearchQuery] = useState(initialSearchValue);

    const entrance = useRef(new Animated.Value(0)).current;
    const searchAnim = useRef(new Animated.Value(isSearching ? 1 : 0)).current;

    useEffect(() => {
        Animated.timing(entrance, {
            toValue: 1,
            duration: 800,
            easing: Easing.out(Easing.back(1.5)),
            useNativeDriver: true,
        }).start();
    }, []);

    useEffect(() => {
        Animated.spring(searchAnim, {
            toValue: isSearching ? 1 : 0,
            useNativeDriver: true,
            friction: 8,
            tension: 50,
        }).start();
    }, [isSearching]);

    useFocusEffect(
        useCallback(() => {
            const loadCount = async () => {
                try {
                    const count = await getUnreadCount();
                    setUnreadCount(count);
                } catch (e) { }
            };
            loadCount();
            const interval = setInterval(loadCount, 30000);
            return () => clearInterval(interval);
        }, [])
    );

    const translateY = entrance.interpolate({
        inputRange: [0, 1],
        outputRange: [-20, 0],
    });

    const opacity = entrance.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
    });

    const titleScale = searchAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0.8],
    });

    const titleOpacity = searchAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0],
    });

    const searchInputTranslate = searchAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [30, 0],
    });

    const toggleSearch = () => {
        const nextState = !isSearching;
        setIsSearching(nextState);
        if (!nextState) {
            setSearchQuery('');
            onSearchChange?.('');
        }
    };

    const handleSearch = (text) => {
        setSearchQuery(text);
        onSearchChange?.(text);
    };

    return (
        <Animated.View style={[
            styles.container,
            { opacity, transform: [{ translateY }] },
            transparent ? styles.transparent : [styles.opaque, { backgroundColor: colors.background }]
        ]}>
            <View style={styles.content}>
                <View style={styles.leftSection}>
                    {onBack ? (
                        <TouchableOpacity onPress={onBack} style={[styles.circularButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <ArrowLeft color={colors.text} size={22} />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity onPress={onMenuPress} style={styles.brandGroup}>
                            <LinearGradient colors={colors.gradients?.vibrant || Gradients.vibrant} style={styles.brandIcon}>
                                <Zap color="#fff" size={18} fill="#fff" />
                            </LinearGradient>
                        </TouchableOpacity>
                    )}

                    {!isSearching ? (
                        <Animated.View style={[styles.titleGroup, { opacity: titleOpacity, transform: [{ scale: titleScale }] }]}>
                            <Text style={[styles.titleText, { color: colors.text }]}>{title}</Text>
                            {subtitle && <Text style={[styles.subtitleText, { color: colors.textMuted }]}>{subtitle}</Text>}
                        </Animated.View>
                    ) : (
                        <Animated.View style={[styles.searchInputWrapper, { opacity: searchAnim, transform: [{ translateX: searchInputTranslate }] }]}>
                            <View style={[styles.searchInner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <Search color={colors.primary} size={16} />
                                <TextInput
                                    style={[styles.headerInput, { color: colors.text }]}
                                    placeholder={placeholder}
                                    placeholderTextColor={colors.textMuted}
                                    value={searchQuery}
                                    onChangeText={handleSearch}
                                    autoFocus
                                />
                            </View>
                        </Animated.View>
                    )}
                </View>

                <View style={styles.rightSection}>
                    <TouchableOpacity style={[styles.iconButton, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)' }, isSearching && styles.searchingIconActive]} onPress={toggleSearch}>
                        {isSearching ? <X color={colors.accent} size={20} /> : <Search color={colors.textSecondary} size={20} />}
                    </TouchableOpacity>

                    {rightSection}

                    {!isSearching && showNotifBell && (
                        <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={[styles.iconButton, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)' }]}>
                            <Bell color={colors.text} size={20} />
                            {unreadCount > 0 && (
                                <View style={[styles.badge, { backgroundColor: colors.accent, borderColor: colors.background }]}>
                                    <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    )}

                    {!isSearching && (
                        <TouchableOpacity onPress={onMenuPress} style={styles.menuButton}>
                            <Menu color={colors.textSecondary} size={20} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </Animated.View>
    );
});

const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 0);

const styles = StyleSheet.create({
    container: {
        paddingTop: STATUSBAR_HEIGHT,
        zIndex: 1000,
    },
    opaque: {
        backgroundColor: Colors.background,
    },
    transparent: {
        backgroundColor: 'transparent',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingBottom: 12,
    },
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    brandGroup: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    brandIcon: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
        ...Shadows.glow(Colors.primary, 0.4),
    },
    circularButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    titleGroup: {
        justifyContent: 'center',
    },
    titleText: {
        ...Typography.h3,
        color: Colors.text,
        fontWeight: '900',
        letterSpacing: -1,
    },
    subtitleText: {
        ...Typography.caption,
        color: Colors.textMuted,
        fontSize: 11,
        marginTop: 0,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    rightSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    iconButton: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    menuButton: {
        width: 38,
        height: 38,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 4,
    },
    // Search Styles
    searchInputWrapper: {
        flex: 1,
        marginLeft: 8,
    },
    searchInner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 42,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    headerInput: {
        flex: 1,
        height: '100%',
        color: Colors.text,
        marginLeft: 10,
        ...Typography.bodySmall,
        fontSize: 14,
    },
    searchingIconActive: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: -4,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: Colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: Colors.background,
        paddingHorizontal: 4,
    },
    badgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '900',
    },
});

export default Header;

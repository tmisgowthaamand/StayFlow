import React, { useRef, useEffect, memo } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Colors, Spacing, Shadows, Typography, BorderRadius, Gradients } from '../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { usePressAnimation } from '../utils/animations';

const StatCard = memo(({ title, value, icon: Icon, color, subtitle, index = 0 }) => {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(30)).current;
    const scale = useRef(new Animated.Value(0.88)).current;
    const { scaleStyle, onPressIn, onPressOut } = usePressAnimation(0.95);

    useEffect(() => {
        const delay = index * 100;
        const timer = setTimeout(() => {
            Animated.parallel([
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 500,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.spring(scale, {
                    toValue: 1,
                    friction: 6,
                    tension: 50,
                    useNativeDriver: true,
                }),
                Animated.timing(translateY, {
                    toValue: 0,
                    duration: 500,
                    easing: Easing.out(Easing.back(1.2)),
                    useNativeDriver: true,
                }),
            ]).start();
        }, delay);

        return () => clearTimeout(timer);
    }, []);

    const getDarkerShade = (hex) => hex + '99';

    return (
        <Animated.View
            style={[
                styles.container,
                Shadows.cardGlow,
                scaleStyle,
                {
                    opacity,
                    transform: [
                        ...scaleStyle.transform,
                        { translateY },
                        { scale },
                    ],
                },
            ]}
            onTouchStart={onPressIn}
            onTouchEnd={onPressOut}
            onTouchCancel={onPressOut}
        >
            <LinearGradient
                colors={[color || Colors.primary, getDarkerShade(color || Colors.primary)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}
            >
                {/* Background decoration */}
                <View style={styles.bgCircle} />
                <View style={styles.bgCircle2} />

                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{title}</Text>
                        {Icon && (
                            <View style={styles.iconContainer}>
                                <Icon color="rgba(255,255,255,0.9)" size={18} />
                            </View>
                        )}
                    </View>
                    <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
                        {value}
                    </Text>
                    {subtitle && (
                        <View style={styles.subtitleRow}>
                            <View style={styles.subtitleDot} />
                            <Text style={styles.subtitle}>{subtitle}</Text>
                        </View>
                    )}
                </View>
            </LinearGradient>
        </Animated.View>
    );
});

const styles = StyleSheet.create({
    container: {
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        marginBottom: Spacing.sm,
        flex: 1,
        marginHorizontal: Spacing.xs,
    },
    gradient: {
        padding: Spacing.md,
        height: 128,
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
    },
    bgCircle: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255,255,255,0.06)',
        top: -30,
        right: -20,
    },
    bgCircle2: {
        position: 'absolute',
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(255,255,255,0.04)',
        bottom: -10,
        left: -15,
    },
    content: {
        flex: 1,
        justifyContent: 'space-between',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    iconContainer: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        color: 'rgba(255, 255, 255, 0.75)',
        ...Typography.tiny,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
    },
    value: {
        color: '#fff',
        ...Typography.stat,
    },
    subtitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    subtitleDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.5)',
    },
    subtitle: {
        color: 'rgba(255, 255, 255, 0.55)',
        ...Typography.tiny,
        letterSpacing: 0.5,
    },
});

export default StatCard;

import React, { useRef, useEffect, memo } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Colors, Spacing, Shadows, Typography, BorderRadius, Gradients } from '../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { usePressAnimation, useScaleIn } from '../utils/animations';

const StatCard = memo(({ title, value, icon: Icon, color, subtitle, index = 0, size = 'medium' }) => {
    const entranceAnim = useScaleIn(index * 80);
    const { scaleStyle, onPressIn, onPressOut } = usePressAnimation(0.97);

    const isLarge = size === 'large';
    const isSmall = size === 'small';

    const meshColors = color ? [color + '20', color + '05', 'transparent'] : Gradients.card;

    return (
        <Animated.View
            style={[
                styles.container,
                entranceAnim,
                scaleStyle,
                isLarge && styles.largeCard,
                isSmall && styles.smallCard,
                { borderColor: color + '40' || Colors.border }
            ]}
            onTouchStart={onPressIn}
            onTouchEnd={onPressOut}
            onTouchCancel={onPressOut}
        >
            <View style={styles.inner}>
                {/* Mesh Gradient Overlay */}
                <LinearGradient
                    colors={meshColors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />

                <View style={styles.header}>
                    <View style={[styles.iconBox, { backgroundColor: (color || Colors.primary) + '20' }]}>
                        {Icon && <Icon color={color || Colors.primary} size={isSmall ? 18 : 22} />}
                    </View>
                    {!isSmall && (
                        <View style={styles.titleColumn}>
                            <Text style={styles.titleText}>{title}</Text>
                        </View>
                    )}
                </View>

                <View style={styles.content}>
                    <Text style={[styles.valueText, isLarge && styles.largeValue]} numberOfLines={1}>
                        {value}
                    </Text>
                    {isSmall && <Text style={styles.smallTitle}>{title}</Text>}
                    {!isSmall && subtitle && (
                        <View style={styles.subtitleRow}>
                            <Text style={styles.subtitleText}>{subtitle}</Text>
                        </View>
                    )}
                </View>
            </View>
        </Animated.View>
    );
});

const styles = StyleSheet.create({
    container: {
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        backgroundColor: Colors.surface,
        borderWidth: 1,
        flex: 1,
        minHeight: 130,
        ...Shadows.sm,
    },
    inner: { flex: 1, padding: Spacing.md, justifyContent: 'space-between' },
    largeCard: { flex: 1.6, minHeight: 150 },
    smallCard: { minHeight: 100 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    titleColumn: { flex: 1 },
    titleText: { ...Typography.tiny, color: Colors.textSecondary, letterSpacing: 1.5, fontSize: 11 },
    smallTitle: { ...Typography.tiny, color: Colors.textMuted, fontSize: 10, marginTop: 4, letterSpacing: 1 },
    content: { marginTop: Spacing.xs },
    valueText: { ...Typography.h2, color: Colors.text, fontWeight: '900', letterSpacing: -1 },
    largeValue: { fontSize: 36 },
    subtitleText: { fontSize: 12, color: Colors.textMuted, fontWeight: '700', textTransform: 'uppercase' },
});

export default StatCard;

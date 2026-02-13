import React, { memo } from 'react';
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity } from 'react-native';
import { Colors, Spacing, Shadows, Typography, BorderRadius, Gradients } from '../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { usePressAnimation, useScaleIn } from '../utils/animations';
import { useTheme } from '../context/ThemeContext';

const StatCard = memo(({ title, value, icon: Icon, color, subtitle, index = 0, size = 'medium', onPress }) => {
    const entranceAnim = useScaleIn(index * 80);
    const { scaleStyle, onPressIn, onPressOut } = usePressAnimation(0.97);
    const { colors } = useTheme();

    const isLarge = size === 'large';
    const isSmall = size === 'small';

    const meshColors = color ? [color + '20', color + '05', 'transparent'] : (colors.gradients?.card || Gradients.card);

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.9}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            style={{ flex: 1 }}
        >
            <Animated.View
                style={[
                    styles.container,
                    entranceAnim,
                    scaleStyle,
                    isLarge && styles.largeCard,
                    isSmall && styles.smallCard,
                    {
                        borderColor: color ? color + '40' : colors.border,
                        backgroundColor: colors.surface
                    }
                ]}
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
                        <View style={[styles.iconBox, { backgroundColor: (color || colors.primary) + '20' }]}>
                            {Icon && <Icon color={color || colors.primary} size={isSmall ? 18 : 22} />}
                        </View>
                        {!isSmall && (
                            <View style={styles.titleColumn}>
                                <Text style={[styles.titleText, { color: colors.textSecondary }]}>{title}</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.content}>
                        <Text style={[styles.valueText, isLarge && styles.largeValue, { color: colors.text }]} numberOfLines={1}>
                            {value}
                        </Text>
                        {isSmall && <Text style={[styles.smallTitle, { color: colors.textMuted }]}>{title}</Text>}
                        {!isSmall && subtitle && (
                            <View style={styles.subtitleRow}>
                                <Text style={[styles.subtitleText, { color: colors.textMuted }]}>{subtitle}</Text>
                            </View>
                        )}
                    </View>
                </View>
            </Animated.View>
        </TouchableOpacity>
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

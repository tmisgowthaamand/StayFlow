import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Shadows } from '../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';

const StatCard = ({ title, value, icon: Icon, color, subtitle }) => {
    return (
        <View style={[styles.container, Shadows.md]}>
            <LinearGradient
                colors={[color || Colors.primary, Colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}
            >
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{title}</Text>
                        {Icon && <Icon color="#fff" size={20} opacity={0.8} />}
                    </View>
                    <Text style={styles.value}>{value}</Text>
                    {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
                </View>
            </LinearGradient>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: Spacing.md,
        flex: 1,
        marginHorizontal: Spacing.xs,
    },
    gradient: {
        padding: Spacing.md,
        height: 120,
        justifyContent: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.xs,
    },
    title: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    value: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
    },
    subtitle: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 10,
        marginTop: 4,
    },
});

export default StatCard;

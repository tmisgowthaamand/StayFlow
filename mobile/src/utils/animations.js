import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Animated, Easing as RNEasing, View, StyleSheet, Dimensions, Text } from 'react-native';
import { Colors, BorderRadius } from '../theme/theme';
import Reanimated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    withDelay,
    interpolate,
    Extrapolate,
    Easing as REasing
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

// ─── Reanimated High-Performance Hooks ─────────────────────────

/**
 * Spline-like Mesh Floating Hook (Reanimated)
 */
export const useMeshFloat = (rangeX = 50, rangeY = 50, duration = 10000) => {
    // Return empty style if animation is disabled or failing
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);

    useEffect(() => {
        translateX.value = withRepeat(
            withSequence(
                withTiming(rangeX, { duration, easing: REasing.inOut(REasing.ease) }),
                withTiming(-rangeX, { duration: duration * 1.2, easing: REasing.inOut(REasing.ease) }),
                withTiming(0, { duration, easing: REasing.inOut(REasing.ease) })
            ),
            -1,
            true
        );
        translateY.value = withRepeat(
            withSequence(
                withTiming(-rangeY, { duration: duration * 0.8, easing: REasing.inOut(REasing.ease) }),
                withTiming(rangeY, { duration: duration * 1.5, easing: REasing.inOut(REasing.ease) }),
                withTiming(0, { duration, easing: REasing.inOut(REasing.ease) })
            ),
            -1,
            true
        );
    }, []);

    return useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value }
        ]
    }));
};

/**
 * Pulsing Glow Effect (Reanimated)
 */
export const useGlowPulse = (minOpacity = 0.2, maxOpacity = 0.6, duration = 3000) => {
    const opacity = useSharedValue(minOpacity);

    useEffect(() => {
        opacity.value = withRepeat(
            withSequence(
                withTiming(maxOpacity, { duration }),
                withTiming(minOpacity, { duration })
            ),
            -1,
            true
        );
    }, []);

    return useAnimatedStyle(() => ({
        opacity: opacity.value
    }));
};

// ─── React Bits Inspired Components ───────────────────────────

/**
 * DecryptedText Effect (Simplified for RN)
 */
export const DecryptedText = ({ text, delay = 0, style }) => {
    const [displayText, setDisplayText] = useState('');
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*';

    useEffect(() => {
        let iterations = 0;
        const interval = setInterval(() => {
            setDisplayText(
                text.split('')
                    .map((char, index) => {
                        if (index < iterations) return text[index];
                        return chars[Math.floor(Math.random() * chars.length)];
                    })
                    .join('')
            );
            if (iterations >= text.length) clearInterval(interval);
            iterations += 1 / 3;
        }, 30);
        return () => clearInterval(interval);
    }, [text]);

    return <Text style={style}>{displayText}</Text>;
};

/**
 * SplitText Animation (Entrance)
 */
export const SplitText = ({ text, style, delay = 0 }) => {
    return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {text.split('').map((char, i) => (
                <AnimatedChar key={i} char={char} index={i} delay={delay} style={style} />
            ))}
        </View>
    );
};

const AnimatedChar = ({ char, index, delay, style }) => {
    // Simplified: No Reanimated if it's causing issues
    return <Text style={style}>{char}</Text>;
};

// ─── Entrance Animations (Legacy Animated API) ──────────────────

export const useFadeSlideIn = (delay = 0, duration = 800, distance = 40) => {
    const fade = useRef(new Animated.Value(0)).current;
    const slide = useRef(new Animated.Value(distance)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fade, {
                toValue: 1,
                duration: duration,
                delay: delay,
                easing: RNEasing.out(RNEasing.back(1.5)),
                useNativeDriver: true,
            }),
            Animated.timing(slide, {
                toValue: 0,
                duration: duration,
                delay: delay,
                easing: RNEasing.out(RNEasing.back(1.5)),
                useNativeDriver: true,
            })
        ]).start();
    }, []);

    return { opacity: fade, transform: [{ translateY: slide }] };
};

export const useScaleIn = (delay = 0) => {
    const scale = useRef(new Animated.Value(0.8)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.spring(scale, {
            toValue: 1,
            delay,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
        }).start();
        Animated.timing(opacity, {
            toValue: 1,
            duration: 500,
            delay,
            useNativeDriver: true,
        }).start();
    }, []);

    return { opacity, transform: [{ scale }] };
};

// ─── Interactive Animations ─────────────────────────────────────

export const usePressAnimation = (scaleTo = 0.95) => {
    const anim = useRef(new Animated.Value(1)).current;

    const onPressIn = () => {
        Animated.spring(anim, {
            toValue: scaleTo,
            useNativeDriver: true,
            friction: 4,
            tension: 100,
        }).start();
    };

    const onPressOut = () => {
        Animated.spring(anim, {
            toValue: 1,
            useNativeDriver: true,
            friction: 4,
            tension: 100,
        }).start();
    };

    return { scaleStyle: { transform: [{ scale: anim }] }, onPressIn, onPressOut };
};

// ─── Components ────────────────────────────────────────────────

export const AnimatedListItem = ({ children, index }) => {
    const anim = useFadeSlideIn(index * 100, 600, 30);
    return <Animated.View style={anim}>{children}</Animated.View>;
};

export const SkeletonLoader = ({ style }) => {
    const anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.timing(anim, {
                toValue: 1,
                duration: 1500,
                easing: RNEasing.linear,
                useNativeDriver: true,
            })
        ).start();
    }, []);

    const translateX = anim.interpolate({
        inputRange: [0, 1],
        outputRange: [-width, width],
    });

    return (
        <View style={[styles.skeleton, style]}>
            <Animated.View
                style={[
                    styles.skeletonGlow,
                    { transform: [{ translateX }] }
                ]}
            />
        </View>
    );
};

export const SkeletonCard = ({ lines = 3 }) => (
    <View style={styles.skelCard}>
        <SkeletonLoader style={styles.skelIcon} />
        <View style={{ flex: 1, gap: 10 }}>
            {Array(lines).fill(0).map((_, i) => (
                <SkeletonLoader key={i} style={[styles.skelLine, { width: i === lines - 1 ? '60%' : '100%' }]} />
            ))}
        </View>
    </View>
);

const styles = StyleSheet.create({
    skeleton: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        overflow: 'hidden',
        borderRadius: 8,
    },
    skeletonGlow: {
        width: '50%',
        height: '100%',
        backgroundColor: 'rgba(255,255,255,0.08)',
        opacity: 0.5,
    },
    skelCard: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 16,
        marginBottom: 16,
        gap: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    skelIcon: { width: 50, height: 50, borderRadius: 12 },
    skelLine: { height: 12, borderRadius: 6 },
});


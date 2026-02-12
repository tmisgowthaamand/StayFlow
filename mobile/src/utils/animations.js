/**
 * StayFlow Animation Utilities
 * All animations use useNativeDriver: true for 60fps, zero-lag performance.
 * No LayoutAnimation (causes Android glitches). Pure Animated API only.
 */
import React, { useRef, useEffect, useCallback, memo } from 'react';
import { Animated, Easing, View, StyleSheet } from 'react-native';

// ─── Reusable Hooks ────────────────────────────────────────────

/**
 * Fade + slide up entrance — the workhorse animation.
 * @param {number} delay - ms delay before animation starts
 * @param {number} duration - ms duration
 * @param {number} slideDistance - how far to slide (px)
 */
export const useFadeSlideIn = (delay = 0, duration = 450, slideDistance = 24) => {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(slideDistance)).current;

    useEffect(() => {
        const timer = setTimeout(() => {
            Animated.parallel([
                Animated.timing(opacity, {
                    toValue: 1,
                    duration,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.timing(translateY, {
                    toValue: 0,
                    duration,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]).start();
        }, delay);

        return () => clearTimeout(timer);
    }, []);

    return { opacity, transform: [{ translateY }] };
};

/**
 * Scale spring animation for entrance.
 */
export const useScaleIn = (delay = 0) => {
    const scale = useRef(new Animated.Value(0.85)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const timer = setTimeout(() => {
            Animated.parallel([
                Animated.spring(scale, {
                    toValue: 1,
                    friction: 7,
                    tension: 40,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        }, delay);

        return () => clearTimeout(timer);
    }, []);

    return { opacity, transform: [{ scale }] };
};

/**
 * Pressable scale effect — shrink on press, bounce back on release.
 * Returns { scaleStyle, onPressIn, onPressOut }
 */
export const usePressAnimation = (activeScale = 0.96) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const onPressIn = useCallback(() => {
        Animated.spring(scaleAnim, {
            toValue: activeScale,
            friction: 5,
            tension: 100,
            useNativeDriver: true,
        }).start();
    }, []);

    const onPressOut = useCallback(() => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 4,
            tension: 80,
            useNativeDriver: true,
        }).start();
    }, []);

    return {
        scaleStyle: { transform: [{ scale: scaleAnim }] },
        onPressIn,
        onPressOut,
    };
};

// ─── Animated List Item Wrapper ────────────────────────────────

/**
 * Wraps any list item with a staggered fade + slide entrance.
 * Use inside FlatList renderItem.
 */
export const AnimatedListItem = memo(({ children, index, style }) => {
    const anim = useFadeSlideIn(index * 60, 400, 20);

    return (
        <Animated.View style={[anim, style]}>
            {children}
        </Animated.View>
    );
});

// ─── Shimmer Skeleton Loader ───────────────────────────────────

export const SkeletonLoader = memo(({ width = '100%', height = 16, borderRadius = 8, style }) => {
    const shimmer = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(shimmer, {
                    toValue: 1,
                    duration: 1000,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(shimmer, {
                    toValue: 0,
                    duration: 1000,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, []);

    const opacity = shimmer.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    return (
        <Animated.View
            style={[
                {
                    width,
                    height,
                    borderRadius,
                    backgroundColor: 'rgba(148, 163, 184, 0.15)',
                    opacity,
                },
                style,
            ]}
        />
    );
});

/**
 * Full skeleton card placeholder for loading states.
 */
export const SkeletonCard = memo(({ lines = 3 }) => (
    <View style={skeletonStyles.card}>
        <View style={skeletonStyles.row}>
            <SkeletonLoader width={40} height={40} borderRadius={12} />
            <View style={{ flex: 1, marginLeft: 12, gap: 8 }}>
                <SkeletonLoader width="60%" height={14} />
                <SkeletonLoader width="40%" height={10} />
            </View>
        </View>
        {lines > 1 && <SkeletonLoader width="100%" height={12} style={{ marginTop: 14 }} />}
        {lines > 2 && <SkeletonLoader width="75%" height={12} style={{ marginTop: 8 }} />}
    </View>
));

const skeletonStyles = StyleSheet.create({
    card: {
        backgroundColor: 'rgba(26, 31, 46, 0.6)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(148, 163, 184, 0.08)',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});

// ─── Stagger Group ─────────────────────────────────────────────

/**
 * Animates children in a stagger pattern.
 * Wrap a group of items and each will fade + slide in sequence.
 */
export const StaggerGroup = memo(({ children, staggerMs = 80, style }) => {
    return (
        <View style={style}>
            {React.Children.map(children, (child, index) => {
                if (!child) return null;
                return (
                    <AnimatedListItem index={index} key={index}>
                        {child}
                    </AnimatedListItem>
                );
            })}
        </View>
    );
});

// ─── Number Counter Animation ──────────────────────────────────

/**
 * Animates a number counting up from 0 to target value.
 */
export const useCountUp = (targetValue, duration = 800, delay = 0) => {
    const animatedValue = useRef(new Animated.Value(0)).current;
    const displayValue = useRef(0);
    const [display, setDisplay] = React.useState('0');

    useEffect(() => {
        const listener = animatedValue.addListener(({ value }) => {
            setDisplay(Math.floor(value).toLocaleString());
        });

        const timer = setTimeout(() => {
            Animated.timing(animatedValue, {
                toValue: targetValue,
                duration,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: false, // Required for value listener
            }).start();
        }, delay);

        return () => {
            clearTimeout(timer);
            animatedValue.removeListener(listener);
        };
    }, [targetValue]);

    return display;
};

// ─── Pulse Animation ───────────────────────────────────────────

export const usePulse = (minScale = 0.97, maxScale = 1.03, speed = 2000) => {
    const pulse = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, {
                    toValue: maxScale,
                    duration: speed / 2,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulse, {
                    toValue: minScale,
                    duration: speed / 2,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, []);

    return { transform: [{ scale: pulse }] };
};

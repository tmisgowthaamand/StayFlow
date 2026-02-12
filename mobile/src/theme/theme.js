// Premium Dark Theme — StayFlow Mobile
// Inspired by latest iOS/Material 3 design language

export const Colors = {
    // Core palette
    primary: '#6C63FF',       // Vibrant Indigo
    primaryLight: '#A5A0FF',
    primaryDark: '#4B44CC',
    secondary: '#00D9A6',     // Mint Green
    secondaryLight: '#5EEAD4',
    accent: '#FF6B9D',        // Coral Pink
    accentAlt: '#FFB347',     // Warm Amber

    // Backgrounds (Dark mode)
    background: '#0A0E1A',     // Deep Navy
    backgroundAlt: '#111827',  // Slightly lighter
    surface: '#1A1F2E',       // Card surface
    surfaceElevated: '#232A3E', // Elevated cards
    surfaceGlass: 'rgba(26, 31, 46, 0.85)', // Glass effect

    // Text
    text: '#F1F5F9',          // Primary text
    textSecondary: '#94A3B8',  // Secondary text
    textMuted: '#64748B',      // Muted
    textBright: '#FFFFFF',     // Pure white

    // States
    success: '#10B981',
    successLight: '#D1FAE5',
    successBg: 'rgba(16, 185, 129, 0.12)',
    danger: '#EF4444',
    dangerLight: '#FEE2E2',
    dangerBg: 'rgba(239, 68, 68, 0.12)',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    warningBg: 'rgba(245, 158, 11, 0.12)',
    info: '#3B82F6',
    infoBg: 'rgba(59, 130, 246, 0.12)',

    // Borders
    border: 'rgba(148, 163, 184, 0.12)',
    borderLight: 'rgba(148, 163, 184, 0.06)',
    borderFocus: '#6C63FF',

    // Overlays
    overlay: 'rgba(0, 0, 0, 0.6)',
    overlayLight: 'rgba(0, 0, 0, 0.3)',

    // Tab bar
    tabBarBg: '#0F1322',
    tabBarBorder: 'rgba(108, 99, 255, 0.1)',
};

export const Gradients = {
    primary: ['#6C63FF', '#4B44CC'],
    secondary: ['#00D9A6', '#059669'],
    accent: ['#FF6B9D', '#F43F5E'],
    warm: ['#FFB347', '#FF6B9D'],
    cool: ['#6C63FF', '#00D9A6'],
    dark: ['#1A1F2E', '#0A0E1A'],
    card: ['rgba(108, 99, 255, 0.08)', 'rgba(0, 217, 166, 0.04)'],
    header: ['#0A0E1A', '#111827'],
    success: ['#10B981', '#059669'],
    danger: ['#EF4444', '#DC2626'],
    purple: ['#8B5CF6', '#6C63FF'],
    gold: ['#F59E0B', '#D97706'],
};

export const Spacing = {
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
};

export const BorderRadius = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    full: 9999,
};

export const Typography = {
    h1: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
    h2: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
    h3: { fontSize: 18, fontWeight: '700' },
    h4: { fontSize: 16, fontWeight: '600' },
    body: { fontSize: 14, fontWeight: '400' },
    bodyBold: { fontSize: 14, fontWeight: '600' },
    caption: { fontSize: 12, fontWeight: '500' },
    tiny: { fontSize: 10, fontWeight: '600' },
    stat: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
};

export const Shadows = {
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 3,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
        elevation: 10,
    },
    glow: (color = '#6C63FF') => ({
        shadowColor: color,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    }),
    cardGlow: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
};

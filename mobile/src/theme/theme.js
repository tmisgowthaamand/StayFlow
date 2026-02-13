export const Colors = {
    // Futuristic SaaS Palette - Refined
    primary: '#7C3AED',       // Rich Violet
    primaryLight: '#A78BFA',
    primaryDark: '#5B21B6',
    secondary: '#059669',     // Emerald 600
    secondaryLight: '#34D399',
    accent: '#F43F5E',        // Rose
    accentAlt: '#2563EB',     // Royal Blue

    // Neutrals for Depth
    background: '#020617',    // Deep Space
    backgroundAlt: '#0B0F1A', // Card Background
    surface: '#121826',       // Slate 900 modified
    surfaceElevated: '#1E293B',
    surfaceGlass: 'rgba(255, 255, 255, 0.03)',
    surfaceGlassBright: 'rgba(255, 255, 255, 0.08)',

    // Text Layers
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#475569',
    textBright: '#FFFFFF',
    textDark: '#020617',

    // Status Semantic
    success: '#10B981',
    successBg: 'rgba(16, 185, 129, 0.08)',
    warning: '#F59E0B',
    warningBg: 'rgba(245, 158, 11, 0.08)',
    danger: '#EF4444',
    dangerBg: 'rgba(239, 68, 68, 0.08)',
    info: '#3B82F6',
    infoBg: 'rgba(59, 130, 246, 0.08)',

    border: 'rgba(255, 255, 255, 0.06)',
    borderBright: 'rgba(255, 255, 255, 0.12)',
};

export const Gradients = {
    primary: ['#7C3AED', '#4C1D95'],
    secondary: ['#059669', '#064E3B'],
    accent: ['#F43F5E', '#BE123C'],
    cool: ['#3B82F6', '#1E40AF'],
    purple: ['#8B5CF6', '#C026D3'],

    // Designer Blends
    premium: ['#020617', '#0F172A'],
    glass: ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)'],
    vibrant: ['#8B5CF6', '#EC4899'], // Violet to Pink
    ocean: ['#0EA5E9', '#2563EB'], // Sky to Blue
    forest: ['#10B981', '#059669'],
    card: ['#1E293B', '#0F172A'],
};

export const Spacing = {
    xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64,
};

export const BorderRadius = {
    xs: 6, sm: 12, md: 18, lg: 24, xl: 32, xxl: 48, full: 9999,
};

export const Typography = {
    h1: { fontSize: 36, fontWeight: '900', letterSpacing: -1.5, lineHeight: 44 },
    h2: { fontSize: 28, fontWeight: '800', letterSpacing: -1, lineHeight: 34 },
    h3: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5, lineHeight: 28 },
    h4: { fontSize: 18, fontWeight: '700', letterSpacing: -0.2, lineHeight: 24 },

    body: { fontSize: 15, fontWeight: '400', lineHeight: 22, color: Colors.text },
    bodyBold: { fontSize: 15, fontWeight: '700', lineHeight: 22 },
    bodySmall: { fontSize: 13, fontWeight: '500', lineHeight: 18 },

    caption: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
    tiny: { fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
};

export const Shadows = {
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.3,
        shadowRadius: 24,
        elevation: 10,
    },
    glow: (color = Colors.primary, intensity = 0.3) => ({
        shadowColor: color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: intensity,
        shadowRadius: 15,
        elevation: 12,
    }),
};


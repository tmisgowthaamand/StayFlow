import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors as StaticColors, Gradients as StaticGradients } from '../theme/theme';

const ThemeContext = createContext();

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

// Define Light Theme Colors
const LightColors = {
    ...StaticColors,
    background: '#F8FAFC',
    backgroundAlt: '#FFFFFF',
    surface: '#F1F5F9',
    surfaceElevated: '#FFFFFF',
    text: '#020617',
    textSecondary: '#475569',
    textMuted: '#64748B',
    border: 'rgba(0, 0, 0, 0.08)',
    borderBright: 'rgba(0, 0, 0, 0.15)',
};

const DarkColors = StaticColors;

export const ThemeProvider = ({ children }) => {
    const [isDarkMode, setIsDarkMode] = useState(true);

    useEffect(() => {
        const loadTheme = async () => {
            try {
                const savedTheme = await AsyncStorage.getItem('userTheme');
                if (savedTheme !== null) {
                    setIsDarkMode(savedTheme === 'dark');
                }
            } catch (e) {
                console.error("Theme Loading Error", e);
            }
        };
        loadTheme();
    }, []);

    const toggleTheme = async () => {
        try {
            const nextMode = !isDarkMode;
            setIsDarkMode(nextMode);
            await AsyncStorage.setItem('userTheme', nextMode ? 'dark' : 'light');
        } catch (e) {
            console.error("Theme Saving Error", e);
        }
    };

    const themeColors = isDarkMode ? DarkColors : LightColors;

    return (
        <ThemeContext.Provider value={{ isDarkMode, toggleTheme, colors: themeColors, gradients: StaticGradients }}>
            {children}
        </ThemeContext.Provider>
    );
};

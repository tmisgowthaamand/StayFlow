import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Spacing } from '../theme/theme';
import { Menu } from 'lucide-react-native';

const Header = ({ title, onMenuPress }) => {
    return (
        <View style={styles.container}>
            <View style={styles.titleContainer}>
                {onMenuPress && (
                    <TouchableOpacity onPress={onMenuPress} style={styles.menuButton}>
                        <Menu color={Colors.text} size={24} />
                    </TouchableOpacity>
                )}
                <View>
                    <Text style={styles.titleText}>{title}</Text>
                    <Text style={styles.subtitleText}>StayFlow PG Management</Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.xl,
        paddingBottom: Spacing.md,
        backgroundColor: Colors.background,
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    menuButton: {
        marginRight: Spacing.md,
    },
    titleText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.text,
    },
    subtitleText: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
});

export default Header;

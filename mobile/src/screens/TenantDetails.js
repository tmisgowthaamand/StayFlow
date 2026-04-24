import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { Colors, Spacing, Shadows, Typography, BorderRadius, Gradients } from '../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import { useNavigation } from '@react-navigation/native';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import {
    User, Phone, MapPin, Home, Calendar, CreditCard, Zap,
    CheckCircle, Clock, AlertCircle, Edit, FileText, Send,
    Bell, ChevronRight, IndianRupee, Share2
} from 'lucide-react-native';

const TenantDetails = ({ route }) => {
    const { tenant } = route.params;
    const navigation = useNavigation();
    const { t } = useLanguage();
    const { colors } = useTheme();

    const isPaid = tenant.Status === 'PAID' || tenant.Status === 'VALID';
    const statusColor = isPaid ? Colors.secondary : tenant.Status === 'PENDING' ? Colors.warning : Colors.accent;
    const statusLabel = isPaid ? 'PAID' : tenant.Status || 'ACTIVE';

    const rent = parseFloat(tenant['Monthly Rent'] || 0);
    const eb = parseFloat(tenant['EB Amount'] || 0);
    const total = parseFloat(tenant['Total Amount'] || (rent + eb));

    const joinDate = tenant['Join Date'] || 'N/A';
    const paidDate = tenant['Paid Date'] || null;

    const daysSinceJoin = useMemo(() => {
        if (!tenant['Join Date'] || tenant['Join Date'] === 'N/A') return null;
        try {
            const join = new Date(tenant['Join Date']);
            const now = new Date();
            const diff = Math.floor((now - join) / (1000 * 60 * 60 * 24));
            if (diff < 30) return `${diff} days`;
            if (diff < 365) return `${Math.floor(diff / 30)} months`;
            const years = Math.floor(diff / 365);
            const months = Math.floor((diff % 365) / 30);
            return months > 0 ? `${years}y ${months}m` : `${years}y`;
        } catch { return null; }
    }, [tenant]);

    const handleCall = () => {
        if (tenant.Phone) Linking.openURL(`tel:${tenant.Phone}`);
    };

    const handleWhatsApp = () => {
        if (tenant.Phone) {
            const phone = tenant.Phone.replace(/\D/g, '');
            Linking.openURL(`https://wa.me/${phone}`);
        }
    };

    const InfoRow = ({ icon: Icon, iconColor, label, value, valueColor, bold }) => (
        <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
            <View style={[styles.infoIconBox, { backgroundColor: (iconColor || colors.primary) + '15' }]}>
                <Icon size={16} color={iconColor || colors.primary} />
            </View>
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
            <Text style={[styles.infoValue, { color: valueColor || colors.text }, bold && { fontWeight: '900' }]}>{value || 'N/A'}</Text>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Header title="Tenant Details" />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                {/* Profile Hero */}
                <View style={[styles.heroCard, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}>
                    <LinearGradient
                        colors={isPaid ? Gradients.secondary : Gradients.primary}
                        style={styles.heroGradient}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    >
                        <View style={styles.heroAvatar}>
                            <Text style={styles.heroAvatarText}>{tenant.Name?.[0] || '?'}</Text>
                        </View>
                        <View style={styles.heroInfo}>
                            <Text style={styles.heroName}>{tenant.Name}</Text>
                            <View style={styles.heroMeta}>
                                <MapPin size={12} color="rgba(255,255,255,0.7)" />
                                <Text style={styles.heroRoom}>Room {tenant.Room || 'N/A'}</Text>
                                {tenant.Location && (
                                    <>
                                        <Text style={styles.heroDot}>•</Text>
                                        <Text style={styles.heroRoom}>{tenant.Location}</Text>
                                    </>
                                )}
                            </View>
                        </View>
                        <View style={[styles.statusPill, { backgroundColor: isPaid ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)' }]}>
                            {isPaid ? <CheckCircle size={12} color="#fff" /> : <Clock size={12} color="#fff" />}
                            <Text style={styles.statusPillText}>{statusLabel}</Text>
                        </View>
                    </LinearGradient>

                    {/* Quick Actions */}
                    <View style={styles.quickActions}>
                        <TouchableOpacity style={[styles.quickBtn, { borderColor: colors.border }]} onPress={handleCall}>
                            <Phone size={18} color={Colors.secondary} />
                            <Text style={[styles.quickBtnText, { color: colors.text }]}>Call</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.quickBtn, { borderColor: colors.border }]} onPress={handleWhatsApp}>
                            <Send size={18} color={Colors.secondary} />
                            <Text style={[styles.quickBtnText, { color: colors.text }]}>WhatsApp</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.quickBtn, { borderColor: colors.border }]} onPress={() => navigation.navigate('EditTenant', { tenant })}>
                            <Edit size={18} color={colors.primary} />
                            <Text style={[styles.quickBtnText, { color: colors.text }]}>Edit</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Duration Badge */}
                {daysSinceJoin && (
                    <View style={[styles.durationCard, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}>
                        <Calendar size={16} color={colors.primary} />
                        <Text style={[styles.durationText, { color: colors.textSecondary }]}>
                            Staying since <Text style={{ fontWeight: '800', color: colors.text }}>{joinDate}</Text>
                            {'  '}(<Text style={{ fontWeight: '800', color: colors.primary }}>{daysSinceJoin}</Text>)
                        </Text>
                    </View>
                )}

                {/* Billing Summary */}
                <View style={[styles.sectionCard, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Billing Summary</Text>
                    <View style={[styles.billingGrid, { borderColor: colors.border }]}>
                        <View style={[styles.billingItem, { borderRightWidth: 1, borderRightColor: colors.border }]}>
                            <Text style={[styles.billingLabel, { color: colors.textMuted }]}>Monthly Rent</Text>
                            <Text style={[styles.billingValue, { color: colors.text }]}>₹{rent.toLocaleString()}</Text>
                        </View>
                        <View style={styles.billingItem}>
                            <Text style={[styles.billingLabel, { color: colors.textMuted }]}>EB Amount</Text>
                            <Text style={[styles.billingValue, { color: Colors.warning }]}>₹{eb.toLocaleString()}</Text>
                        </View>
                    </View>
                    <View style={[styles.totalRow, { backgroundColor: isPaid ? 'rgba(16,185,129,0.08)' : 'rgba(244,63,94,0.06)', borderColor: isPaid ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.15)' }]}>
                        <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Total Due</Text>
                        <Text style={[styles.totalValue, { color: isPaid ? Colors.secondary : Colors.accent }]}>₹{total.toLocaleString()}</Text>
                    </View>
                    {paidDate && isPaid && (
                        <View style={styles.paidDateRow}>
                            <CheckCircle size={13} color={Colors.secondary} />
                            <Text style={[styles.paidDateText, { color: Colors.secondary }]}>Paid on {paidDate}</Text>
                        </View>
                    )}
                </View>

                {/* Personal Details */}
                <View style={[styles.sectionCard, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Personal Details</Text>
                    <InfoRow icon={User} label="Name" value={tenant.Name} />
                    <InfoRow icon={Phone} iconColor={Colors.secondary} label="Phone" value={tenant.Phone} />
                    <InfoRow icon={Home} iconColor={Colors.warning} label="Room" value={tenant.Room} />
                    {tenant['Sharing Type'] && (
                        <InfoRow icon={User} iconColor="#8b5cf6" label="Sharing" value={tenant['Sharing Type']} />
                    )}
                    {tenant.Location && (
                        <InfoRow icon={MapPin} iconColor={Colors.accent} label="Location" value={tenant.Location} />
                    )}
                    <InfoRow icon={Calendar} iconColor={colors.primary} label="Joined" value={joinDate} />
                    <InfoRow
                        icon={isPaid ? CheckCircle : AlertCircle}
                        iconColor={statusColor}
                        label="Status"
                        value={statusLabel}
                        valueColor={statusColor}
                        bold
                    />
                </View>

                {/* Payment Details */}
                <View style={[styles.sectionCard, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Payment Details</Text>
                    <InfoRow icon={CreditCard} label="Monthly Rent" value={`₹${rent.toLocaleString()}`} />
                    <InfoRow icon={Zap} iconColor={Colors.warning} label="EB Amount" value={`₹${eb.toLocaleString()}`} />
                    <InfoRow icon={CreditCard} iconColor={isPaid ? Colors.secondary : Colors.accent} label="Total Amount" value={`₹${total.toLocaleString()}`} valueColor={isPaid ? Colors.secondary : Colors.accent} bold />
                    {tenant['Payment Mode'] && (
                        <InfoRow icon={CreditCard} iconColor="#8b5cf6" label="Payment Mode" value={tenant['Payment Mode']} />
                    )}
                    {paidDate && (
                        <InfoRow icon={Calendar} iconColor={Colors.secondary} label="Paid Date" value={paidDate} valueColor={Colors.secondary} />
                    )}
                </View>

                {/* Registration Doc */}
                {tenant['Registration Form'] && (
                    <TouchableOpacity
                        style={[styles.docCard, { borderColor: colors.border }]}
                        onPress={() => {
                            const url = tenant['Registration Form'];
                            if (url && (url.startsWith('http') || url.startsWith('//'))) {
                                Linking.openURL(url);
                            } else {
                                Alert.alert('Info', 'No valid document link available');
                            }
                        }}
                    >
                        <LinearGradient colors={Gradients.primary} style={styles.docGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                            <FileText size={20} color="#fff" />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.docTitle}>Registration Form</Text>
                                <Text style={styles.docSub}>Tap to view document</Text>
                            </View>
                            <ChevronRight size={18} color="rgba(255,255,255,0.6)" />
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { padding: Spacing.md, paddingBottom: 100 },

    // Hero
    heroCard: { borderRadius: BorderRadius.lg, overflow: 'hidden', borderWidth: 1, marginBottom: Spacing.md, ...Shadows.sm },
    heroGradient: { padding: 24, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
    heroAvatar: { width: 60, height: 60, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    heroAvatarText: { color: '#fff', fontWeight: '900', fontSize: 26 },
    heroInfo: { flex: 1, marginLeft: 16 },
    heroName: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
    heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
    heroRoom: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600' },
    heroDot: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
    statusPill: { position: 'absolute', top: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
    statusPillText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },

    // Quick Actions
    quickActions: { flexDirection: 'row', padding: 12, gap: 8 },
    quickBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: BorderRadius.md, borderWidth: 1, gap: 4 },
    quickBtnText: { fontSize: 11, fontWeight: '700' },

    // Duration
    durationCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.md },
    durationText: { fontSize: 13, fontWeight: '500' },

    // Section
    sectionCard: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.md, ...Shadows.sm },
    sectionTitle: { fontSize: 15, fontWeight: '900', letterSpacing: -0.3, marginBottom: 14 },

    // Info Row
    infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
    infoIconBox: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    infoLabel: { fontSize: 12, fontWeight: '600', width: 80 },
    infoValue: { flex: 1, fontSize: 14, fontWeight: '600', textAlign: 'right' },

    // Billing
    billingGrid: { flexDirection: 'row', borderWidth: 1, borderRadius: BorderRadius.md, overflow: 'hidden', marginBottom: 12 },
    billingItem: { flex: 1, padding: 14, alignItems: 'center' },
    billingLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' },
    billingValue: { fontSize: 20, fontWeight: '900' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: BorderRadius.md, borderWidth: 1 },
    totalLabel: { fontSize: 13, fontWeight: '700' },
    totalValue: { fontSize: 22, fontWeight: '900' },
    paidDateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingLeft: 4 },
    paidDateText: { fontSize: 12, fontWeight: '700' },

    // Doc
    docCard: { borderRadius: BorderRadius.lg, overflow: 'hidden', borderWidth: 1, marginBottom: Spacing.md },
    docGradient: { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 14 },
    docTitle: { color: '#fff', fontSize: 14, fontWeight: '800' },
    docSub: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '500', marginTop: 2 },
});

export default TenantDetails;

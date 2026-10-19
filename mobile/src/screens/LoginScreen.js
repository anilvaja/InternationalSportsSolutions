import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { colors } from '../theme';
import {
  setApiUrl,
  api,
  setStoredToken,
  setStoredUser,
  setStoredSlug,
  getApiUrl,
  getDefaultHost,
} from '../api';

const QUICK_ACCOUNTS = [
  {
    label: 'Academy Admin',
    badge: 'Admin',
    email: 'admin@pratik-karate-academy.internationalsportssolutions.test',
    password: 'password',
    slug: 'pratik-karate-academy',
  },
  {
    label: 'Head Coach (Pratik)',
    badge: 'Coach',
    email: 'pratik.singhania@gmail.com',
    password: 'password',
    slug: 'pratik-karate-academy',
  },
  {
    label: 'Super Admin',
    badge: 'Platform',
    email: 'anilvaja.007@gmail.com',
    password: 'password',
    slug: '',
  },
];

export default function LoginScreen({ onLoginSuccess }) {
  const [slug, setSlug] = useState('pratik-karate-academy');
  const [email, setEmail] = useState('admin@pratik-karate-academy.internationalsportssolutions.test');
  const [password, setPassword] = useState('password');
  const [hostUrl, setHostUrl] = useState(getDefaultHost());
  const [loading, setLoading] = useState(false);
  const [showNetworkSettings, setShowNetworkSettings] = useState(false);

  const applyPreset = (account) => {
    setEmail(account.email);
    setPassword(account.password);
    if (account.slug !== undefined) {
      setSlug(account.slug);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Required Fields', 'Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      const cleanHost = hostUrl.trim().replace(/\/+$/, '');
      await setApiUrl(cleanHost);

      const cleanSlug = slug.trim().toLowerCase();
      if (cleanSlug) {
        await setStoredSlug(cleanSlug);
      }

      const res = await api(
        'POST',
        '/api/auth/login',
        {
          email: email.trim(),
          password,
          academy_slug: cleanSlug || undefined,
        },
        cleanSlug
      );

      if (!res.success && !res.token) {
        throw new Error(res.error || 'Invalid credentials');
      }

      await setStoredToken(res.token);
      await setStoredUser(res.user);

      onLoginSuccess(res.user);
    } catch (err) {
      Alert.alert(
        'Login Failed',
        `${err.message}\n\nTip: If testing on a physical phone, open "Server Network Settings" below and ensure the IP matches your computer's Wi-Fi network.`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        {/* Brand Header */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>🏆</Text>
          </View>
          <Text style={styles.title}>International Sports</Text>
          <Text style={styles.subtitle}>Multi-Tenant Academy Mobile Portal</Text>
        </View>

        {/* Quick Demo Switcher */}
        <Text style={styles.sectionLabel}>QUICK DEMO ACCOUNTS</Text>
        <View style={styles.quickGrid}>
          {QUICK_ACCOUNTS.map((acc, i) => (
            <TouchableOpacity
              key={i}
              style={[
                styles.quickBtn,
                email === acc.email && styles.quickBtnActive,
              ]}
              onPress={() => applyPreset(acc)}
            >
              <Text style={styles.quickBadge}>{acc.badge}</Text>
              <Text style={styles.quickBtnText} numberOfLines={1}>
                {acc.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Inputs */}
        <View style={styles.field}>
          <Text style={styles.label}>Academy Tenant Slug</Text>
          <TextInput
            style={styles.input}
            value={slug}
            onChangeText={setSlug}
            placeholder="e.g. pratik-karate-academy"
            placeholderTextColor={colors.textSubtle}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your registered email"
            placeholderTextColor={colors.textSubtle}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            placeholderTextColor={colors.textSubtle}
            secureTextEntry
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>Sign In to Mobile</Text>
          )}
        </TouchableOpacity>

        {/* Network Config Accordion */}
        <TouchableOpacity
          style={styles.configToggle}
          onPress={() => setShowNetworkSettings(!showNetworkSettings)}
        >
          <Text style={styles.configToggleText}>
            {showNetworkSettings ? '▼ Hide Server Settings' : '⚙ Server Network Settings (Host / IP)'}
          </Text>
        </TouchableOpacity>

        {showNetworkSettings && (
          <View style={styles.configBox}>
            <Text style={styles.configLabel}>API Endpoint URL:</Text>
            <TextInput
              style={styles.configInput}
              value={hostUrl}
              onChangeText={setHostUrl}
              placeholder="http://192.168.29.75:3005"
              placeholderTextColor={colors.textSubtle}
              autoCapitalize="none"
            />

            <View style={styles.presetRow}>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => setHostUrl('http://192.168.29.75:3005')}
              >
                <Text style={styles.presetChipText}>📱 Wi-Fi (.75)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => setHostUrl('http://10.0.2.2:3005')}
              >
                <Text style={styles.presetChipText}>🤖 Android Emu</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => setHostUrl('http://localhost:3005')}
              >
                <Text style={styles.presetChipText}>💻 Localhost</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.bgDark,
    justifyContent: 'center',
    padding: 20,
    minHeight: '100%',
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.3)',
  },
  iconText: {
    fontSize: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSubtle,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },
  quickGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  quickBtn: {
    flex: 1,
    minWidth: 100,
    backgroundColor: colors.bgInput,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  quickBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  quickBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gold,
    textTransform: 'uppercase',
  },
  quickBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.text,
    marginTop: 2,
  },
  field: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  configToggle: {
    marginTop: 18,
    alignItems: 'center',
  },
  configToggleText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  configBox: {
    marginTop: 12,
    backgroundColor: colors.bgInput,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  configLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 4,
  },
  configInput: {
    backgroundColor: colors.bgDark,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: colors.text,
    marginBottom: 8,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-between',
  },
  presetChip: {
    flex: 1,
    backgroundColor: colors.bgCard,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  presetChipText: {
    fontSize: 10.5,
    color: colors.textMuted,
    fontWeight: '600',
  },
});

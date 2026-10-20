import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { colors } from '../theme';
import {
  getApiUrl,
  setApiUrl,
  getStoredSlug,
  setStoredSlug,
  getDefaultHost,
  api,
} from '../api';

export default function SettingsScreen({ user, onLogout, onOffsetChange, currentOffset }) {
  const [apiUrl, setApiUrlState] = useState('');
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Admin Reset Staff Password state
  const [targetUserId, setTargetUserId] = useState('');
  const [targetNewPassword, setTargetNewPassword] = useState('');
  const [resettingStaff, setResettingStaff] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      const u = await getApiUrl();
      const s = await getStoredSlug();
      setApiUrlState(u);
      setSlug(s || '');
    }
    loadConfig();
  }, []);

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 4) {
      Alert.alert('Validation Error', 'New password must be at least 4 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Validation Error', 'New passwords do not match.');
      return;
    }

    setUpdatingPassword(true);
    try {
      const res = await api('POST', '/api/auth/change-password', {
        current_password: currentPassword || undefined,
        new_password: newPassword,
      });
      Alert.alert('Success', res.message || 'Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      Alert.alert('Password Change Failed', e.message);
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleResetStaffPassword = async () => {
    if (!targetUserId.trim()) {
      Alert.alert('Validation Error', 'Please enter the Staff / User ID to reset.');
      return;
    }
    if (!targetNewPassword || targetNewPassword.length < 4) {
      Alert.alert('Validation Error', 'Password must be at least 4 characters long.');
      return;
    }

    setResettingStaff(true);
    try {
      const res = await api('POST', `/api/academy/users/${targetUserId.trim()}/reset-password`, {
        password: targetNewPassword,
      });
      Alert.alert('Success', res.message || 'Staff password reset successfully!');
      setTargetUserId('');
      setTargetNewPassword('');
    } catch (e) {
      Alert.alert('Reset Failed', e.message);
    } finally {
      setResettingStaff(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const cleanUrl = apiUrl.trim().replace(/\/+$/, '');
      await setApiUrl(cleanUrl);
      if (slug.trim()) {
        await setStoredSlug(slug.trim());
      }
      Alert.alert('Settings Saved', 'Mobile connection settings updated successfully.');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.headerTitle}>Account & Settings</Text>
      <Text style={styles.headerSub}>Manage user session, mobile network and preferences</Text>

      {/* User Card */}
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user.name || user.email || 'U').slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.userName}>{user.name || 'Staff Member'}</Text>
        <Text style={styles.userEmail}>{user.email}</Text>
        <View style={styles.badgeRow}>
          <Text style={styles.roleBadge}>
            {user.isSuperAdmin ? 'SUPER ADMIN' : (user.role || 'MEMBER').toUpperCase()}
          </Text>
          {user.academyName ? (
            <Text style={styles.academyBadge}>{user.academyName}</Text>
          ) : null}
        </View>
      </View>

      {/* Server Endpoint Settings */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>⚙ Server Connection Endpoint</Text>
        <Text style={styles.cardSub}>Configures the backend URL contacted by the mobile app</Text>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>API Base URL</Text>
          <TextInput
            style={styles.input}
            value={apiUrl}
            onChangeText={setApiUrlState}
            placeholder={getDefaultHost()}
            placeholderTextColor={colors.textSubtle}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.presetGrid}>
          <TouchableOpacity
            style={styles.presetChip}
            onPress={() => setApiUrlState('http://192.168.29.75:3005')}
          >
            <Text style={styles.presetChipText}>📱 Wi-Fi (.75)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.presetChip}
            onPress={() => setApiUrlState('http://10.0.2.2:3005')}
          >
            <Text style={styles.presetChipText}>🤖 Android Emu</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.presetChip}
            onPress={() => setApiUrlState('http://localhost:3005')}
          >
            <Text style={styles.presetChipText}>💻 Localhost</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Active Tenant Slug</Text>
          <TextInput
            style={styles.input}
            value={slug}
            onChangeText={setSlug}
            placeholder="pratik-karate-academy"
            placeholderTextColor={colors.textSubtle}
            autoCapitalize="none"
          />
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Settings'}</Text>
        </TouchableOpacity>
      </View>

      {/* Phone Button Clearance Sizer */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📱 Bottom Phone Buttons Clearance</Text>
        <Text style={styles.cardSub}>Lift bottom navigation tabs to prevent phone Back/Home button overlap</Text>

        <View style={styles.presetGrid}>
          {[20, 28, 40, 54].map((val) => {
            const isSelected = (currentOffset || 28) === val;
            return (
              <TouchableOpacity
                key={val}
                style={[styles.presetChip, isSelected && styles.offsetChipActive]}
                onPress={async () => {
                  if (onOffsetChange) onOffsetChange(val);
                  Alert.alert('Updated', `Bottom clearance set to +${val}px.`);
                }}
              >
                <Text style={[styles.presetChipText, isSelected && styles.offsetChipTextActive]}>
                  +{val}px {val === 28 ? '(Std)' : val === 40 ? '(Tall)' : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Change Password Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔑 Change My Password</Text>
        <Text style={styles.cardSub}>Update your personal login password</Text>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Current Password (Optional if first set)</Text>
          <TextInput
            style={styles.input}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Enter current password"
            placeholderTextColor={colors.textSubtle}
            secureTextEntry
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>New Password (Min 4 characters)</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Enter new password"
            placeholderTextColor={colors.textSubtle}
            secureTextEntry
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Confirm New Password</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter identical password"
            placeholderTextColor={colors.textSubtle}
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleChangePassword}
          disabled={updatingPassword}
        >
          <Text style={styles.saveBtnText}>
            {updatingPassword ? 'Updating Password...' : 'Save New Password'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Staff Password Reset Card (Academy Admin or Super Admin) */}
      {(user.isSuperAdmin || user.role === 'academy_admin' || user.role === 'admin') && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🛡 Staff / Coach Password Reset</Text>
          <Text style={styles.cardSub}>Academy Admin privilege: reset any staff or coach login password</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>User / Staff ID</Text>
            <TextInput
              style={styles.input}
              value={targetUserId}
              onChangeText={setTargetUserId}
              placeholder="e.g. 2"
              placeholderTextColor={colors.textSubtle}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>New Password for Staff</Text>
            <TextInput
              style={styles.input}
              value={targetNewPassword}
              onChangeText={setTargetNewPassword}
              placeholder="Enter temporary or new password"
              placeholderTextColor={colors.textSubtle}
            />
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: '#f59e0b' }]}
            onPress={handleResetStaffPassword}
            disabled={resettingStaff}
          >
            <Text style={styles.saveBtnText}>
              {resettingStaff ? 'Resetting Password...' : 'Reset Staff Password'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Logout Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Session Security</Text>
        <Text style={styles.cardSub}>Clear saved token and credentials from this device</Text>

        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutBtnText}>🔒 Sign Out from Mobile</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  headerSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 16,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  userEmail: {
    fontSize: 12.5,
    color: colors.textMuted,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  roleBadge: {
    backgroundColor: colors.primaryLight,
    color: colors.primary,
    fontSize: 10,
    fontWeight: '700',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  academyBadge: {
    backgroundColor: colors.bgInput,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  cardTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: colors.text,
  },
  cardSub: {
    fontSize: 11.5,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: 14,
  },
  field: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: colors.text,
  },
  presetGrid: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  presetChip: {
    flex: 1,
    backgroundColor: colors.bgInput,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  presetChipText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  offsetChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  offsetChipTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnText: {
    color: colors.white,
    fontSize: 13.5,
    fontWeight: '700',
  },
  logoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutBtnText: {
    color: colors.danger,
    fontSize: 13.5,
    fontWeight: '700',
  },
});

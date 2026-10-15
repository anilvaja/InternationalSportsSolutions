import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { mobileApiRequest, storeAuthToken, clearAuth, getAuthToken } from './src/api';

const Stack = createStackNavigator();

// ==========================================
// 1. LOGIN SCREEN
// ==========================================
function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('aarav.patel@student.com');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    try {
      const res = await mobileApiRequest('/api/auth/login', 'POST', { email, password });
      if (res.success) {
        await storeAuthToken(res.token, res.user);
        navigation.replace('Dashboard', { user: res.user });
      } else {
        Alert.alert('Login Failed', res.error || 'Invalid credentials');
      }
    } catch (e) {
      Alert.alert('Connection Error', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.loginCard}>
        <Text style={styles.brandTitle}>🏆 Sports Solutions</Text>
        <Text style={styles.brandSub}>Multi-Tenant Mobile Portal</Text>

        <TextInput
          style={styles.input}
          placeholder="Email Address"
          placeholderTextColor="#94a3b8"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#94a3b8"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity style={styles.primaryButton} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign In to Mobile</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ==========================================
// 2. DASHBOARD SCREEN
// ==========================================
function DashboardScreen({ route, navigation }) {
  const user = route.params?.user || {};
  const [stats, setStats] = useState(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    const res = await mobileApiRequest('/api/student/dashboard');
    if (res.success) {
      setStats(res);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.userName}>{user.name || 'Student'}</Text>
          </View>
          <TouchableOpacity
            style={styles.secondaryButtonSm}
            onPress={async () => {
              await clearAuth();
              navigation.replace('Login');
            }}
          >
            <Text style={styles.secondaryButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {stats && (
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Attendance</Text>
              <Text style={styles.statVal}>{stats.attendance.percentage}%</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Sessions</Text>
              <Text style={styles.statVal}>{stats.attendance.present}/{stats.attendance.totalSessions}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Due Fees</Text>
              <Text style={styles.statVal}>₹{stats.fees.outstanding_balance}</Text>
            </View>
          </View>
        )}

        <View style={styles.navGrid}>
          <TouchableOpacity style={styles.navCard} onPress={() => navigation.navigate('Attendance')}>
            <Text style={styles.navCardTitle}>📅 Attendance</Text>
            <Text style={styles.navCardSub}>Check session records</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navCard} onPress={() => navigation.navigate('Fees')}>
            <Text style={styles.navCardTitle}>💳 Fee Invoices</Text>
            <Text style={styles.navCardSub}>View dues & receipts</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navCard} onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.navCardTitle}>👤 My Profile</Text>
            <Text style={styles.navCardSub}>Certificates & uploads</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ==========================================
// 3. ATTENDANCE SCREEN
// ==========================================
function AttendanceScreen() {
  const [records, setRecords] = useState([]);

  useEffect(() => {
    loadAttendance();
  }, []);

  async function loadAttendance() {
    const res = await mobileApiRequest('/api/student/attendance');
    if (res.success) setRecords(res.records || []);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.screenHeader}>My Attendance History</Text>
        {records.map((r, i) => (
          <View key={i} style={styles.cardItem}>
            <View>
              <Text style={styles.itemTitle}>{r.date}</Text>
              <Text style={styles.itemSub}>{r.batch_name}</Text>
            </View>
            <Text style={r.status === 'present' ? styles.tagSuccess : styles.tagDanger}>
              {r.status.toUpperCase()}
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// ==========================================
// 4. FEES & SHARING SCREEN
// ==========================================
function FeesScreen() {
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    loadFees();
  }, []);

  async function loadFees() {
    const res = await mobileApiRequest('/api/student/fees');
    if (res.success) setInvoices(res.invoices || []);
  }

  async function shareReceipt(inv) {
    try {
      await Share.share({
        message: `🏆 Sports Academy Fee Receipt: ${inv.invoice_number} | Paid: ₹${inv.paid_amount} | Status: ${inv.status.toUpperCase()}`,
      });
    } catch (e) {
      console.warn('Share error:', e);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.screenHeader}>Invoices & Fee Statements</Text>
        {invoices.map((inv, idx) => (
          <View key={idx} style={styles.cardItemCol}>
            <View style={styles.itemRow}>
              <Text style={styles.itemTitle}>{inv.title}</Text>
              <Text style={inv.status === 'paid' ? styles.tagSuccess : styles.tagWarning}>
                {inv.status.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.itemSub}>Invoice: #{inv.invoice_number} | Due: {inv.due_date}</Text>
            <Text style={styles.feeHighlight}>
              Net: ₹{inv.net_amount} | Balance: ₹{inv.balance_amount}
            </Text>
            <TouchableOpacity style={styles.shareBtn} onPress={() => shareReceipt(inv)}>
              <Text style={styles.shareBtnText}>📤 Share Official Receipt</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// ==========================================
// 5. PROFILE & ATTACHMENT UPLOAD SCREEN
// ==========================================
function ProfileScreen() {
  const [pickedFile, setPickedFile] = useState(null);

  async function pickDocument() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
      });
      if (!result.canceled && result.assets) {
        setPickedFile(result.assets[0].name);
        Alert.alert('Document Selected', `Ready to sync: ${result.assets[0].name}`);
      }
    } catch (e) {
      console.warn('Picker error:', e);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.scrollContent}>
        <Text style={styles.screenHeader}>Student Documents & Profile</Text>
        <View style={styles.cardItemCol}>
          <Text style={styles.itemTitle}>Document / Medical Certificate Upload</Text>
          <Text style={styles.itemSub}>Upload proof of payment or sports medical certificate</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={pickDocument}>
            <Text style={styles.buttonText}>📎 Choose Attachment</Text>
          </TouchableOpacity>
          {pickedFile && (
            <Text style={{ color: '#10b981', marginTop: 12 }}>Selected: {pickedFile}</Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

// ==========================================
// NAVIGATION CONTAINER
// ==========================================
export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Academy Portal' }} />
        <Stack.Screen name="Attendance" component={AttendanceScreen} options={{ title: 'Attendance' }} />
        <Stack.Screen name="Fees" component={FeesScreen} options={{ title: 'Fee Management' }} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Student Profile' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scrollContent: { padding: 20 },
  loginCard: {
    margin: 20,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 28,
    borderWidth: 1,
    borderColor: '#334155',
  },
  brandTitle: { fontSize: 24, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 4 },
  brandSub: { fontSize: 13, color: '#94a3b8', textAlign: 'center', marginBottom: 24 },
  input: {
    backgroundColor: '#334155',
    color: '#fff',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  welcomeText: { color: '#94a3b8', fontSize: 13 },
  userName: { color: '#fff', fontSize: 20, fontWeight: '700' },
  secondaryButtonSm: { backgroundColor: '#334155', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  secondaryButtonText: { color: '#ef4444', fontSize: 12, fontWeight: '600' },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 20 },
  statBox: { flex: 1, backgroundColor: '#1e293b', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
  statLabel: { color: '#94a3b8', fontSize: 11, textTransform: 'uppercase' },
  statVal: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 4 },
  navGrid: { gap: 12 },
  navCard: { backgroundColor: '#1e293b', padding: 18, borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
  navCardTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  navCardSub: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  screenHeader: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 16 },
  cardItem: { backgroundColor: '#1e293b', padding: 16, borderRadius: 10, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  cardItemCol: { backgroundColor: '#1e293b', padding: 16, borderRadius: 10, marginBottom: 14, borderWidth: 1, borderColor: '#334155' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  itemSub: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  feeHighlight: { color: '#f59e0b', fontSize: 14, fontWeight: '700', marginTop: 8 },
  tagSuccess: { backgroundColor: 'rgba(16,185,129,0.2)', color: '#10b981', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, fontSize: 11, fontWeight: '700' },
  tagDanger: { backgroundColor: 'rgba(239,68,68,0.2)', color: '#ef4444', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, fontSize: 11, fontWeight: '700' },
  tagWarning: { backgroundColor: 'rgba(245,158,11,0.2)', color: '#f59e0b', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, fontSize: 11, fontWeight: '700' },
  shareBtn: { marginTop: 12, backgroundColor: '#334155', padding: 10, borderRadius: 6, alignItems: 'center' },
  shareBtnText: { color: '#38bdf8', fontSize: 12, fontWeight: '600' },
});

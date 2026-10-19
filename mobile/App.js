import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  TouchableOpacity,
  Modal,
  Animated,
  ScrollView,
  SafeAreaView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { colors } from './src/theme';
import {
  getStoredToken,
  getStoredUser,
  clearSession,
  api,
  setSessionExpiredHandler,
  getStoredScreen,
  setStoredScreen,
} from './src/api';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import StudentsScreen from './src/screens/StudentsScreen';
import BatchesScreen from './src/screens/BatchesScreen';
import AttendanceScreen from './src/screens/AttendanceScreen';
import FeesScreen from './src/screens/FeesScreen';
import EventsScreen from './src/screens/EventsScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Academy Overview', icon: '📊' },
  { id: 'students', label: 'Students Directory', icon: '🥋' },
  { id: 'batches', label: 'Batches & Schedules', icon: '⏰' },
  { id: 'attendance', label: 'Daily Attendance', icon: '📅' },
  { id: 'fees', label: 'Fee Invoices & Ledger', icon: '💳' },
  { id: 'events', label: 'Events & Tournaments', icon: '🏆' },
  { id: 'settings', label: 'Settings & Network', icon: '⚙' },
];

const BOTTOM_TABS = [
  { id: 'dashboard', label: 'Overview', icon: '📊' },
  { id: 'students', label: 'Students', icon: '🥋' },
  { id: 'attendance', label: 'Attendance', icon: '📅' },
  { id: 'fees', label: 'Fees', icon: '💳' },
];

export default function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarAnim] = useState(new Animated.Value(-260));

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'International Sports Solutions Mobile';
    }
    setSessionExpiredHandler(() => {
      setUser(null);
    });
  }, []);

  // Boot validation
  useEffect(() => {
    async function checkSession() {
      try {
        const token = await getStoredToken();
        const storedUser = await getStoredUser();
        const storedScreen = await getStoredScreen();

        if (storedScreen) {
          setCurrentPage(storedScreen);
        }

        if (token && storedUser) {
          // Verify with server
          const meRes = await api('GET', '/api/auth/me').catch(() => null);
          if (meRes && meRes.success && meRes.user) {
            setUser(meRes.user);
          } else {
            setUser(storedUser);
          }
        }
      } catch (e) {
        await clearSession();
        setUser(null);
      } finally {
        setBooting(false);
      }
    }
    checkSession();
  }, []);

  const handleLoginSuccess = async (userData) => {
    setUser(userData);
    const storedScreen = await getStoredScreen();
    setCurrentPage(storedScreen || 'dashboard');
  };

  const handleLogout = async () => {
    try {
      await api('POST', '/api/auth/logout').catch(() => {});
    } catch (e) {}
    await clearSession();
    setUser(null);
    setCurrentPage('dashboard');
    if (sidebarOpen) toggleSidebar();
  };

  const toggleSidebar = () => {
    if (sidebarOpen) {
      Animated.timing(sidebarAnim, {
        toValue: -260,
        duration: 220,
        useNativeDriver: true,
      }).start(() => setSidebarOpen(false));
    } else {
      setSidebarOpen(true);
      Animated.timing(sidebarAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  };

  const navigateTo = async (pageId) => {
    setCurrentPage(pageId);
    await setStoredScreen(pageId);
    if (sidebarOpen) {
      toggleSidebar();
    }
  };

  if (booting) {
    return (
      <View style={styles.bootingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.bootingTitle}>International Sports Solutions</Text>
        <Text style={styles.bootingText}>Connecting to Academy Database...</Text>
      </View>
    );
  }

  if (!user) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const renderActiveScreen = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardScreen user={user} onNavigate={navigateTo} />;
      case 'students':
        return <StudentsScreen user={user} />;
      case 'batches':
        return <BatchesScreen user={user} />;
      case 'attendance':
        return <AttendanceScreen user={user} />;
      case 'fees':
        return <FeesScreen user={user} />;
      case 'events':
        return <EventsScreen user={user} />;
      case 'settings':
        return <SettingsScreen user={user} onLogout={handleLogout} />;
      default:
        return <DashboardScreen user={user} onNavigate={navigateTo} />;
    }
  };

  const currentNav = NAV_ITEMS.find((n) => n.id === currentPage) || NAV_ITEMS[0];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bgDark} />

      {/* Top Navigation Bar */}
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.menuBtn} onPress={toggleSidebar}>
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>

        <View style={styles.navTitleContainer}>
          <Text style={styles.navTitle} numberOfLines={1}>
            {currentNav.icon} {currentNav.label}
          </Text>
          <Text style={styles.navSub} numberOfLines={1}>
            {user.academyName || 'Pratik Karate Academy'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.profileBtn}
          onPress={() => navigateTo('settings')}
        >
          <Text style={styles.profileInitials}>
            {(user.name || user.email || 'U').slice(0, 2).toUpperCase()}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Screen Body */}
      <View style={styles.screenBody}>{renderActiveScreen()}</View>

      {/* Bottom Quick Navigation Tabs */}
      <View style={styles.bottomBar}>
        {BOTTOM_TABS.map((tab) => {
          const isActive = currentPage === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.bottomTab, isActive && styles.bottomTabActive]}
              onPress={() => navigateTo(tab.id)}
            >
              <Text style={styles.bottomTabIcon}>{tab.icon}</Text>
              <Text style={[styles.bottomTabLabel, isActive && styles.bottomTabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Slide-out Sidebar Drawer Overlay */}
      {sidebarOpen && (
        <Modal transparent visible={sidebarOpen} animationType="none" onRequestClose={toggleSidebar}>
          <View style={styles.drawerOverlay}>
            <TouchableOpacity style={styles.drawerBackdrop} onPress={toggleSidebar} />
            <Animated.View style={[styles.drawer, { transform: [{ translateX: sidebarAnim }] }]}>
              {/* Drawer Header */}
              <View style={styles.drawerHeader}>
                <View style={styles.drawerLogoRow}>
                  <Text style={styles.drawerLogoIcon}>🏆</Text>
                  <Text style={styles.drawerLogoTitle}>International Sports</Text>
                </View>
                <Text style={styles.drawerUserName}>{user.name || user.email}</Text>
                <Text style={styles.drawerUserRole}>
                  Role: {user.isSuperAdmin ? 'SUPER ADMIN' : (user.role || 'STAFF').toUpperCase()}
                </Text>
              </View>

              {/* Navigation Links */}
              <ScrollView style={styles.drawerLinks}>
                {NAV_ITEMS.map((item) => {
                  const isActive = currentPage === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.drawerItem, isActive && styles.drawerItemActive]}
                      onPress={() => navigateTo(item.id)}
                    >
                      <Text style={styles.drawerItemIcon}>{item.icon}</Text>
                      <Text style={[styles.drawerItemText, isActive && styles.drawerItemTextActive]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Drawer Footer */}
              <View style={styles.drawerFooter}>
                <TouchableOpacity style={styles.drawerLogoutBtn} onPress={handleLogout}>
                  <Text style={styles.drawerLogoutText}>🔒 Sign Out</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  bootingContainer: {
    flex: 1,
    backgroundColor: colors.bgDark,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  bootingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
  },
  bootingText: {
    fontSize: 12.5,
    color: colors.textMuted,
    marginTop: 6,
  },
  navbar: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: colors.bgInput,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuIcon: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  navTitleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  navTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: colors.text,
  },
  navSub: {
    fontSize: 11,
    color: colors.gold,
    marginTop: 1,
  },
  profileBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.4)',
  },
  profileInitials: {
    color: colors.primary,
    fontSize: 12.5,
    fontWeight: '700',
  },
  screenBody: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  bottomBar: {
    height: 56,
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bottomTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  bottomTabActive: {
    backgroundColor: 'rgba(37,99,235,0.08)',
  },
  bottomTabIcon: {
    fontSize: 18,
  },
  bottomTabLabel: {
    fontSize: 10.5,
    color: colors.textSubtle,
    marginTop: 2,
    fontWeight: '600',
  },
  bottomTabLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  drawerOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  drawerBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  drawer: {
    width: 260,
    backgroundColor: colors.bgCard,
    height: '100%',
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingTop: Platform.OS === 'ios' ? 44 : 20,
    paddingBottom: 20,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  drawerHeader: {
    paddingHorizontal: 18,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  drawerLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  drawerLogoIcon: {
    fontSize: 22,
  },
  drawerLogoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  drawerUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  drawerUserRole: {
    fontSize: 11,
    color: colors.gold,
    marginTop: 2,
    fontWeight: '600',
  },
  drawerLinks: {
    flex: 1,
    paddingTop: 10,
    paddingHorizontal: 10,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
    gap: 12,
  },
  drawerItemActive: {
    backgroundColor: colors.primaryLight,
  },
  drawerItemIcon: {
    fontSize: 17,
  },
  drawerItemText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.textMuted,
  },
  drawerItemTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  drawerFooter: {
    paddingHorizontal: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  drawerLogoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  drawerLogoutText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
});

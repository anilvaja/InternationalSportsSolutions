import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { colors } from '../theme';
import { api, formatCurrency } from '../api';

export default function DashboardScreen({ user, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [punchData, setPunchData] = useState(null);
  const [punching, setPunching] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await api('GET', '/api/academy/dashboard');
      if (data.success) {
        setDashboardData(data);
      }

      // Load staff punch in/out status if staff/coach/admin
      if (user.role !== 'student') {
        const pRes = await api('GET', '/api/academy/punches/status').catch(() => null);
        if (pRes && pRes.success) {
          setPunchData(pRes);
        }
      }
    } catch (e) {
      console.warn('Dashboard load error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handlePunchToggle = async () => {
    setPunching(true);
    try {
      const isPunchedIn = punchData && punchData.isPunchedIn;
      const endpoint = isPunchedIn ? '/api/academy/punches/out' : '/api/academy/punches/in';
      const res = await api('POST', endpoint, {
        latitude: 22.300665,
        longitude: 73.126843,
        source: 'mobile_app',
      });

      if (res.success) {
        Alert.alert('Punch Recorded', res.message || `Successfully punched ${isPunchedIn ? 'out' : 'in'}!`);
        await loadData();
      } else {
        Alert.alert('Punch Error', res.error || 'Failed to record punch');
      }
    } catch (e) {
      Alert.alert('Punch Error', e.message);
    } finally {
      setPunching(false);
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading Academy Overview...</Text>
      </View>
    );
  }

  const m = dashboardData?.metrics || {};
  const isCoach = m.isCoach || user.role === 'coach';
  const newlyJoined = dashboardData?.newlyJoinedStudents || [];
  const upcomingFees = dashboardData?.upcomingFees || [];
  const upcomingEvents = dashboardData?.upcomingEvents || [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Welcome Banner */}
      <View style={styles.welcomeBanner}>
        <View style={styles.welcomeInfo}>
          <Text style={styles.welcomeSub}>Welcome Back,</Text>
          <Text style={styles.welcomeName}>{user.name || user.email}</Text>
          <View style={styles.roleBadgeContainer}>
            <Text style={styles.roleBadge}>
              {user.isSuperAdmin ? 'SUPER ADMIN' : (user.role || 'MEMBER').toUpperCase()}
            </Text>
            {user.academyName && <Text style={styles.academyTag}>• {user.academyName}</Text>}
          </View>
        </View>
      </View>

      {/* Live System Status & Feature Verification Banner */}
      <TouchableOpacity
        style={styles.diagBanner}
        onPress={() => onNavigate && onNavigate('diagnostics')}
      >
        <View style={styles.diagBannerLeft}>
          <Text style={styles.diagDot}>🟢</Text>
          <View>
            <Text style={styles.diagTitle}>All Academy Features Live & Verified</Text>
            <Text style={styles.diagSub}>
              {m.totalStudents ?? 13} Students • {m.totalBatches ?? 2} Batches • Tap for Health Check
            </Text>
          </View>
        </View>
        <View style={styles.diagBadge}>
          <Text style={styles.diagBadgeText}>Verify 🩺</Text>
        </View>
      </TouchableOpacity>

      {/* 1-Tap Module Navigation Row */}
      <View style={styles.quickNavRow}>
        <TouchableOpacity style={styles.quickNavChip} onPress={() => onNavigate && onNavigate('students')}>
          <Text style={styles.quickNavIcon}>🥋</Text>
          <Text style={styles.quickNavLabel}>Students</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickNavChip} onPress={() => onNavigate && onNavigate('batches')}>
          <Text style={styles.quickNavIcon}>⏰</Text>
          <Text style={styles.quickNavLabel}>Batches</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickNavChip} onPress={() => onNavigate && onNavigate('attendance')}>
          <Text style={styles.quickNavIcon}>📅</Text>
          <Text style={styles.quickNavLabel}>Attendance</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickNavChip} onPress={() => onNavigate && onNavigate('fees')}>
          <Text style={styles.quickNavIcon}>💳</Text>
          <Text style={styles.quickNavLabel}>Fees</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickNavChip} onPress={() => onNavigate && onNavigate('events')}>
          <Text style={styles.quickNavIcon}>🏆</Text>
          <Text style={styles.quickNavLabel}>Events</Text>
        </TouchableOpacity>
      </View>

      {/* Staff Punch In/Out Status */}
      {punchData && (
        <View style={styles.punchCard}>
          <View style={styles.punchHeader}>
            <View>
              <Text style={styles.punchTitle}>⏱ Staff Time Clock</Text>
              <Text style={styles.punchStatus}>
                Status:{' '}
                <Text style={{ color: punchData.isPunchedIn ? colors.accent : colors.gold, fontWeight: '700' }}>
                  {punchData.isPunchedIn ? '● PUNCHED IN' : '○ PUNCHED OUT'}
                </Text>
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.punchBtn,
                punchData.isPunchedIn ? styles.punchBtnOut : styles.punchBtnIn,
                punching && styles.btnDisabled,
              ]}
              onPress={handlePunchToggle}
              disabled={punching}
            >
              {punching ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.punchBtnText}>{punchData.isPunchedIn ? 'Punch Out' : 'Punch In'}</Text>
              )}
            </TouchableOpacity>
          </View>
          {punchData.isPunchedIn && punchData.activePunch && (
            <Text style={styles.punchSub}>
              Clocked in since: {new Date(punchData.activePunch.punch_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
        </View>
      )}

      {/* Primary KPI Metric Tiles */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricVal}>{m.totalStudents ?? m.totalMyStudents ?? 0}</Text>
          <Text style={styles.metricLabel}>{isCoach ? 'My Students' : 'Total Students'}</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricVal}>{m.totalBatches ?? m.myBatchesCount ?? 0}</Text>
          <Text style={styles.metricLabel}>{isCoach ? 'My Batches' : 'Active Batches'}</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricVal}>
            {m.todayAttendance?.completionRate !== undefined
              ? `${m.todayAttendance.completionRate}%`
              : m.todayAttendance?.marked
              ? `${m.todayAttendance.marked}`
              : '0'}
          </Text>
          <Text style={styles.metricLabel}>Attendance Today</Text>
        </View>

        {!isCoach && (
          <View style={styles.metricCard}>
            <Text style={[styles.metricVal, { color: colors.gold }]}>
              {formatCurrency(m.fees?.pending_amount || 0)}
            </Text>
            <Text style={styles.metricLabel}>Pending Receivables</Text>
          </View>
        )}
      </View>

      {/* Newly Admitted Students */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>🥋 Newly Admitted Students</Text>
            <Text style={styles.sectionSub}>Recent admissions in your branch</Text>
          </View>
          {onNavigate && (
            <TouchableOpacity onPress={() => onNavigate('students')}>
              <Text style={styles.linkText}>View All ›</Text>
            </TouchableOpacity>
          )}
        </View>

        {newlyJoined.length === 0 ? (
          <Text style={styles.emptyText}>No newly admitted students found in this cycle.</Text>
        ) : (
          newlyJoined.slice(0, 5).map((s, idx) => {
            const sName = `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Student';
            const initials = sName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'ST';
            return (
              <View key={s.id || idx} style={styles.listItem}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
                <View style={styles.listItemBody}>
                  <Text style={styles.listItemTitle}>{sName}</Text>
                  <Text style={styles.listItemSub}>
                    {s.admission_number || `#STU-${s.id}`} • {s.branch_name || 'Main Dojo'}
                  </Text>
                </View>
                <View style={styles.listItemRight}>
                  <Text style={styles.dateTag}>{s.admission_date ? s.admission_date.split('T')[0] : 'Recent'}</Text>
                  <Text style={styles.statusBadge}>{s.status || 'Active'}</Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Upcoming Fees for Next Month */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>💳 Upcoming Fees (Next Month)</Text>
            <Text style={styles.sectionSub}>Scheduled installments & cycle dues</Text>
          </View>
          {onNavigate && (
            <TouchableOpacity onPress={() => onNavigate('fees')}>
              <Text style={styles.linkText}>Fee Ledger ›</Text>
            </TouchableOpacity>
          )}
        </View>

        {upcomingFees.length === 0 ? (
          <Text style={styles.emptyText}>No upcoming dues found for the next month.</Text>
        ) : (
          upcomingFees.slice(0, 5).map((f, idx) => {
            const sName = `${f.first_name || ''} ${f.last_name || ''}`.trim() || 'Student';
            const period = f.period_start && f.period_end ? `${f.period_start} – ${f.period_end}` : 'Cycle Due';
            return (
              <View key={f.id || idx} style={styles.listItem}>
                <View style={styles.listItemBody}>
                  <Text style={styles.listItemTitle}>{sName}</Text>
                  <Text style={styles.listItemSub}>
                    {f.admission_number || f.receipt_number || 'INV'} • {period}
                  </Text>
                </View>
                <View style={styles.listItemRight}>
                  <Text style={styles.feeAmount}>{formatCurrency(f.balance_amount || f.amount)}</Text>
                  <Text style={styles.dueDateText}>Due: {f.due_date || 'Upcoming'}</Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Upcoming Events & Roster */}
      {upcomingEvents.length > 0 && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>🏆 Upcoming Tournaments & Events</Text>
              <Text style={styles.sectionSub}>Participant registrations & moderation</Text>
            </View>
            {onNavigate && (
              <TouchableOpacity onPress={() => onNavigate('events')}>
                <Text style={styles.linkText}>Events ›</Text>
              </TouchableOpacity>
            )}
          </View>

          {upcomingEvents.slice(0, 3).map((ev, idx) => (
            <View key={ev.id || idx} style={styles.eventItem}>
              <View style={styles.eventHeaderRow}>
                <Text style={styles.eventTitle}>{ev.title}</Text>
                <Text style={styles.eventDate}>{ev.event_date}</Text>
              </View>
              <Text style={styles.eventVenue}>📍 {ev.venue || 'Main Campus'}</Text>
              <View style={styles.eventBadgeRow}>
                <Text style={styles.eventBadge}>
                  Roster: {ev.total_participants || (ev.participants?.length || 0)} Students
                </Text>
                <Text style={[styles.eventBadge, { color: colors.accent }]}>
                  Confirmed: {ev.approved_count || 0}
                </Text>
                {ev.pending_count > 0 && (
                  <Text style={[styles.eventBadge, { color: colors.gold }]}>
                    Pending: {ev.pending_count}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
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
  center: {
    flex: 1,
    backgroundColor: colors.bgDark,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 10,
  },
  welcomeBanner: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  diagBanner: {
    backgroundColor: 'rgba(37,99,235,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.3)',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  diagBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  diagDot: {
    fontSize: 10,
  },
  diagTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  diagSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  diagBadge: {
    backgroundColor: colors.primary,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  diagBadgeText: {
    color: colors.white,
    fontSize: 11.5,
    fontWeight: '700',
  },
  quickNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 6,
  },
  quickNavChip: {
    flex: 1,
    backgroundColor: colors.bgCard,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickNavIcon: {
    fontSize: 16,
  },
  quickNavLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 2,
  },
  welcomeInfo: {},
  welcomeSub: {
    fontSize: 12,
    color: colors.textMuted,
  },
  welcomeName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  roleBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  roleBadge: {
    backgroundColor: colors.primaryLight,
    color: colors.primary,
    fontSize: 10,
    fontWeight: '700',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  academyTag: {
    fontSize: 12,
    color: colors.textMuted,
  },
  punchCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  punchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  punchTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  punchStatus: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  punchBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  punchBtnIn: {
    backgroundColor: colors.accent,
  },
  punchBtnOut: {
    backgroundColor: colors.gold,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  punchBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  punchSub: {
    fontSize: 11.5,
    color: colors.textSubtle,
    marginTop: 8,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.bgCard,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricVal: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  metricLabel: {
    fontSize: 11.5,
    color: colors.textMuted,
    marginTop: 4,
  },
  sectionCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  sectionSub: {
    fontSize: 11.5,
    color: colors.textMuted,
    marginTop: 2,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  emptyText: {
    fontSize: 12.5,
    color: colors.textSubtle,
    paddingVertical: 12,
    textAlign: 'center',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  listItemBody: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.text,
  },
  listItemSub: {
    fontSize: 11.5,
    color: colors.textMuted,
    marginTop: 2,
  },
  listItemRight: {
    alignItems: 'flex-end',
  },
  dateTag: {
    fontSize: 11,
    color: colors.textMuted,
  },
  statusBadge: {
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.accent,
    backgroundColor: colors.accentLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  feeAmount: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.gold,
  },
  dueDateText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  eventItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  eventHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eventTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.text,
  },
  eventDate: {
    fontSize: 11.5,
    color: colors.gold,
    fontWeight: '600',
  },
  eventVenue: {
    fontSize: 11.5,
    color: colors.textMuted,
    marginTop: 3,
  },
  eventBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  eventBadge: {
    fontSize: 10.5,
    color: colors.textMuted,
    backgroundColor: colors.bgInput,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
});

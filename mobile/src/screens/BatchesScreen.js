import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { colors } from '../theme';
import { api } from '../api';

export default function BatchesScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [batches, setBatches] = useState([]);

  const loadBatches = useCallback(async () => {
    try {
      const res = await api('GET', '/api/academy/batches');
      if (res.success) {
        setBatches(res.batches || []);
      }
    } catch (e) {
      console.warn('Error loading batches:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const onRefresh = () => {
    setRefreshing(true);
    loadBatches();
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading Active Batches & Schedules...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Text style={styles.headerTitle}>Training Batches & Schedules</Text>
      <Text style={styles.headerSub}>Manage sports dojos, daily timings and coach assignments</Text>

      {batches.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No batches configured</Text>
          <Text style={styles.emptySub}>Batches created in the web portal will display here.</Text>
        </View>
      ) : (
        batches.map((b) => {
          const days = b.days_of_week || 'All Days';
          const time = b.start_time && b.end_time ? `${b.start_time} – ${b.end_time}` : 'Flexible Timing';

          return (
            <View key={b.id} style={styles.batchCard}>
              <View style={styles.cardHeader}>
                <View style={styles.badgeRow}>
                  <Text style={styles.sportBadge}>{b.sport_name || 'Martial Arts'}</Text>
                  <Text style={styles.branchBadge}>{b.branch_name || 'Main Campus'}</Text>
                </View>
                <Text style={styles.capacityBadge}>
                  {b.enrolled_count || 0} / {b.max_capacity || 30} Enrolled
                </Text>
              </View>

              <Text style={styles.batchTitle}>{b.name}</Text>

              <View style={styles.metaRow}>
                <Text style={styles.metaItem}>⏰ {time}</Text>
                <Text style={styles.metaItem}>📅 {days}</Text>
              </View>

              <View style={styles.coachRow}>
                <Text style={styles.coachLabel}>Assigned Coach:</Text>
                <Text style={styles.coachName}>{b.coach_name || 'Head Coach'}</Text>
              </View>
            </View>
          );
        })
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgDark,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 10,
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
  emptyCard: {
    backgroundColor: colors.bgCard,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  emptySub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  batchCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  sportBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    textTransform: 'uppercase',
  },
  branchBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    backgroundColor: colors.bgInput,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  capacityBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
  },
  batchTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  metaItem: {
    fontSize: 12,
    color: colors.textMuted,
  },
  coachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 10,
    marginTop: 4,
  },
  coachLabel: {
    fontSize: 12,
    color: colors.textSubtle,
    marginRight: 6,
  },
  coachName: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.text,
  },
});

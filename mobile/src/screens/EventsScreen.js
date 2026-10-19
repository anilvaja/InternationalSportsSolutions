import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import { colors } from '../theme';
import { api, formatCurrency } from '../api';

export default function EventsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [roster, setRoster] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  const loadEvents = useCallback(async () => {
    try {
      const res = await api('GET', '/api/academy/dashboard/upcoming-events');
      if (res.success) {
        setEvents(res.upcomingEvents || []);
      }
    } catch (e) {
      console.warn('Load events error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const onRefresh = () => {
    setRefreshing(true);
    loadEvents();
  };

  const openRosterModal = async (ev) => {
    setSelectedEvent(ev);
    setRosterLoading(true);
    try {
      const res = await api('GET', `/api/academy/events/${ev.id}/roster`);
      if (res.success) {
        setRoster(res.roster || res.participants || []);
      }
    } catch (e) {
      setRoster(ev.participants || []);
    } finally {
      setRosterLoading(false);
    }
  };

  const handleModerate = async (participantId, newStatus) => {
    try {
      const res = await api('PATCH', `/api/academy/events/roster/${participantId}/status`, {
        status: newStatus,
      });

      if (res.success) {
        Alert.alert('Status Updated', `Registration marked as ${newStatus}.`);
        setRoster((prev) =>
          prev.map((p) => (p.id === participantId ? { ...p, registration_status: newStatus } : p))
        );
        loadEvents();
      } else {
        Alert.alert('Error', res.error || 'Failed to update status');
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading Tournaments & Events...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Text style={styles.headerTitle}>Tournaments, Gradings & Events</Text>
        <Text style={styles.headerSub}>Manage sports competitions, participant roster and approvals</Text>

        {events.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No upcoming events scheduled</Text>
            <Text style={styles.emptySub}>Events created in the academy portal will show here.</Text>
          </View>
        ) : (
          events.map((ev) => (
            <View key={ev.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.typeBadge}>{(ev.type || 'TOURNAMENT').toUpperCase()}</Text>
                <Text style={styles.dateBadge}>{ev.event_date}</Text>
              </View>

              <Text style={styles.eventTitle}>{ev.title}</Text>
              <Text style={styles.venueText}>📍 Venue: {ev.venue || 'Main Dojo Complex'}</Text>

              {ev.fee > 0 ? (
                <Text style={styles.feeText}>Entry Fee: {formatCurrency(ev.fee)}</Text>
              ) : null}

              <View style={styles.badgeRow}>
                <Text style={styles.statChip}>
                  Participants: {ev.total_participants || ev.participants?.length || 0}
                </Text>
                <Text style={[styles.statChip, { color: colors.accent }]}>
                  Confirmed: {ev.approved_count || 0}
                </Text>
                {ev.pending_count > 0 && (
                  <Text style={[styles.statChip, { color: colors.gold }]}>
                    Pending: {ev.pending_count}
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={styles.rosterBtn}
                onPress={() => openRosterModal(ev)}
              >
                <Text style={styles.rosterBtnText}>📋 View Participant Roster</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* Roster & Moderation Modal */}
      {selectedEvent && (
        <Modal
          visible={Boolean(selectedEvent)}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedEvent(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Event Roster</Text>
                  <Text style={styles.modalSub}>{selectedEvent.title}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedEvent(null)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              {rosterLoading ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 30 }} />
              ) : (
                <ScrollView style={styles.modalBody}>
                  {roster.length === 0 ? (
                    <Text style={styles.emptyText}>No registered participants for this event.</Text>
                  ) : (
                    roster.map((p) => {
                      const sName = p.student_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Student';
                      const isConfirmed = p.registration_status === 'confirmed';

                      return (
                        <View key={p.id} style={styles.rosterRow}>
                          <View style={styles.rosterInfo}>
                            <Text style={styles.rosterName}>{sName}</Text>
                            <Text style={styles.rosterMeta}>
                              {p.admission_number || p.student_code || `#${p.student_id}`} • {p.branch_name || 'Main Dojo'}
                            </Text>
                          </View>

                          <View style={styles.rosterActions}>
                            {isConfirmed ? (
                              <View style={styles.confirmedRow}>
                                <Text style={styles.confirmedBadge}>✓ Confirmed</Text>
                                <TouchableOpacity
                                  style={styles.actionBtnSmall}
                                  onPress={() => handleModerate(p.id, 'rejected')}
                                >
                                  <Text style={styles.actionTextDanger}>Reject</Text>
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <View style={styles.pendingRow}>
                                <TouchableOpacity
                                  style={[styles.actionBtn, styles.actionApprove]}
                                  onPress={() => handleModerate(p.id, 'confirmed')}
                                >
                                  <Text style={styles.actionApproveText}>Approve</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.actionBtn, styles.actionReject]}
                                  onPress={() => handleModerate(p.id, 'rejected')}
                                >
                                  <Text style={styles.actionRejectText}>Reject</Text>
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    })
                  )}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      )}
    </View>
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
  card: {
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
  typeBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dateBadge: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.gold,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  venueText: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },
  feeText: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '600',
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 8,
  },
  statChip: {
    fontSize: 11,
    color: colors.textMuted,
    backgroundColor: colors.bgInput,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  rosterBtn: {
    backgroundColor: colors.bgInput,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginTop: 6,
  },
  rosterBtnText: {
    color: colors.text,
    fontSize: 12.5,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  modalSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  modalClose: {
    fontSize: 18,
    color: colors.textMuted,
    padding: 4,
  },
  modalBody: {
    marginBottom: 20,
  },
  emptyText: {
    color: colors.textSubtle,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
  },
  rosterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  rosterInfo: {
    flex: 1,
  },
  rosterName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  rosterMeta: {
    fontSize: 11.5,
    color: colors.textMuted,
    marginTop: 2,
  },
  rosterActions: {
    alignItems: 'flex-end',
  },
  confirmedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confirmedBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
    backgroundColor: colors.accentLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  actionBtnSmall: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  actionTextDanger: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '600',
  },
  pendingRow: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  actionApprove: {
    backgroundColor: colors.accentLight,
  },
  actionApproveText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  actionReject: {
    backgroundColor: colors.dangerLight,
  },
  actionRejectText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '700',
  },
});

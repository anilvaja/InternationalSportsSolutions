import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { colors } from '../theme';
import { api } from '../api';

export default function AttendanceScreen({ user }) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [students, setStudents] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({});

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const loadBatches = useCallback(async () => {
    try {
      const res = await api('GET', '/api/academy/batches');
      if (res.success && res.batches && res.batches.length > 0) {
        setBatches(res.batches);
        setSelectedBatchId(res.batches[0].id);
      }
    } catch (e) {
      console.warn('Load batches error:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const loadRoster = useCallback(async (batchId) => {
    if (!batchId) return;
    setLoading(true);
    try {
      const res = await api('GET', `/api/academy/batches/${batchId}/roster`);
      if (res.success) {
        const roster = res.students || [];
        setStudents(roster);
        const initialMap = {};
        roster.forEach((s) => {
          initialMap[s.id] = s.today_status || 'present';
        });
        setAttendanceMap(initialMap);
      }
    } catch (e) {
      console.warn('Error loading roster:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedBatchId) {
      loadRoster(selectedBatchId);
    }
  }, [selectedBatchId, loadRoster]);

  const toggleStudentStatus = (studentId) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: prev[studentId] === 'present' ? 'absent' : 'present',
    }));
  };

  const markAll = (status) => {
    const updated = {};
    students.forEach((s) => {
      updated[s.id] = status;
    });
    setAttendanceMap(updated);
  };

  const submitAttendance = async () => {
    if (!selectedBatchId || students.length === 0) return;
    setSubmitting(true);
    try {
      const records = Object.entries(attendanceMap).map(([studentId, status]) => ({
        student_id: Number(studentId),
        status,
      }));

      const res = await api('POST', '/api/academy/attendance', {
        batch_id: selectedBatchId,
        date: todayStr,
        records,
      });

      if (res.success) {
        Alert.alert('Attendance Saved', `Successfully marked attendance for ${records.length} students.`);
      } else {
        Alert.alert('Save Failed', res.error || 'Failed to submit attendance');
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && batches.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading Daily Attendance Roster...</Text>
      </View>
    );
  }

  const presentCount = Object.values(attendanceMap).filter((s) => s === 'present').length;
  const absentCount = Object.values(attendanceMap).filter((s) => s === 'absent').length;

  return (
    <View style={styles.container}>
      {/* Batch Selector Bar */}
      <View style={styles.selectorBar}>
        <Text style={styles.barLabel}>SELECT BATCH (TODAY: {todayStr})</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.batchChipRow}>
          {batches.map((b) => (
            <TouchableOpacity
              key={b.id}
              style={[
                styles.batchChip,
                selectedBatchId === b.id && styles.batchChipActive,
              ]}
              onPress={() => setSelectedBatchId(b.id)}
            >
              <Text
                style={[
                  styles.batchChipText,
                  selectedBatchId === b.id && styles.batchChipTextActive,
                ]}
              >
                {b.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Summary Counters & Quick Actions */}
      <View style={styles.actionRow}>
        <View style={styles.counterRow}>
          <Text style={[styles.counterBadge, { color: colors.accent }]}>✓ {presentCount} Present</Text>
          <Text style={[styles.counterBadge, { color: colors.danger }]}>✕ {absentCount} Absent</Text>
        </View>

        <View style={styles.quickBtns}>
          <TouchableOpacity style={styles.quickAction} onPress={() => markAll('present')}>
            <Text style={styles.quickActionText}>All Present</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => markAll('absent')}>
            <Text style={styles.quickActionText}>All Absent</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Save Button Header Banner */}
      <View style={styles.saveHeaderBanner}>
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.btnDisabled]}
          onPress={submitAttendance}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.submitBtnText}>💾 Save Attendance ({presentCount} Present)</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Student Attendance List */}
      <ScrollView contentContainerStyle={styles.scrollList}>
        {students.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No students actively enrolled in this batch.</Text>
          </View>
        ) : (
          <>
            {students.map((s) => {
              const status = attendanceMap[s.id] || 'present';
              const isPresent = status === 'present';
              const sName = `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Student';

              return (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.studentRow,
                    isPresent ? styles.rowPresent : styles.rowAbsent,
                  ]}
                  onPress={() => toggleStudentStatus(s.id)}
                >
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{sName}</Text>
                    <Text style={styles.studentId}>{s.admission_number || `#STU-${s.id}`}</Text>
                  </View>

                  <View
                    style={[
                      styles.toggleBadge,
                      isPresent ? styles.togglePresent : styles.toggleAbsent,
                    ]}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        isPresent ? styles.toggleTextPresent : styles.toggleTextAbsent,
                      ]}
                    >
                      {isPresent ? '✓ PRESENT' : '✕ ABSENT'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[styles.submitBtn, styles.footerSubmitBtn, submitting && styles.btnDisabled]}
              onPress={submitAttendance}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.submitBtnText}>💾 Save Attendance ({presentCount} Present)</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
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
  selectorBar: {
    backgroundColor: colors.bgCard,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  barLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSubtle,
    paddingHorizontal: 16,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  batchChipRow: {
    paddingHorizontal: 16,
    gap: 8,
  },
  batchChip: {
    backgroundColor: colors.bgInput,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  batchChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  batchChipText: {
    fontSize: 12.5,
    color: colors.textMuted,
    fontWeight: '600',
  },
  batchChipTextActive: {
    color: colors.white,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  counterRow: {
    flexDirection: 'row',
    gap: 12,
  },
  counterBadge: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  quickBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  quickAction: {
    backgroundColor: colors.bgCard,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickActionText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  scrollList: {
    paddingHorizontal: 16,
    paddingBottom: 90,
  },
  emptyCard: {
    backgroundColor: colors.bgCard,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyText: {
    color: colors.textSubtle,
    fontSize: 13,
  },
  studentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  rowPresent: {
    backgroundColor: colors.bgCard,
  },
  rowAbsent: {
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  studentId: {
    fontSize: 11.5,
    color: colors.textMuted,
    marginTop: 2,
  },
  toggleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  togglePresent: {
    backgroundColor: colors.accentLight,
  },
  toggleAbsent: {
    backgroundColor: colors.dangerLight,
  },
  toggleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  toggleTextPresent: {
    color: colors.accent,
  },
  toggleTextAbsent: {
    color: colors.danger,
  },
  saveHeaderBanner: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  footerSubmitBtn: {
    marginTop: 14,
    marginBottom: 40,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: colors.white,
    fontSize: 14.5,
    fontWeight: '700',
  },
});


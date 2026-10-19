import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { colors } from '../theme';
import { api } from '../api';

export default function StudentsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);

  const loadStudents = useCallback(async () => {
    try {
      const res = await api('GET', '/api/academy/students');
      if (res.success) {
        setStudents(res.students || []);
      }
    } catch (e) {
      console.warn('Error loading students:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const onRefresh = () => {
    setRefreshing(true);
    loadStudents();
  };

  const filteredStudents = students.filter((s) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const name = `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase();
    const adm = (s.admission_number || s.student_code || '').toLowerCase();
    const branch = (s.branch_name || '').toLowerCase();
    return name.includes(q) || adm.includes(q) || branch.includes(q);
  });

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading Student Directory...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="🔍 Search student name, ID or branch..."
          placeholderTextColor={colors.textSubtle}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Text style={styles.countText}>
          Showing {filteredStudents.length} of {students.length} students
        </Text>

        {filteredStudents.map((s) => {
          const sName = `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Student';
          const initials = sName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'ST';
          const admNo = s.admission_number || s.student_code || `#STU-${s.id}`;

          return (
            <TouchableOpacity
              key={s.id}
              style={styles.studentCard}
              onPress={() => setSelectedStudent(s)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.studentName}>{sName}</Text>
                <Text style={styles.studentMeta}>
                  {admNo} • {s.branch_name || 'Main Dojo'}
                </Text>
                {s.phone ? (
                  <Text style={styles.studentPhone}>📞 {s.phone}</Text>
                ) : null}
              </View>

              <View style={styles.cardRight}>
                <Text
                  style={[
                    styles.statusTag,
                    s.status === 'active' ? styles.statusActive : styles.statusInactive,
                  ]}
                >
                  {s.status || 'Active'}
                </Text>
                <Text style={styles.chevron}>›</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Student Details Modal */}
      {selectedStudent && (
        <Modal
          visible={Boolean(selectedStudent)}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedStudent(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Student Profile</Text>
                <TouchableOpacity onPress={() => setSelectedStudent(null)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <View style={styles.modalHero}>
                  <View style={[styles.avatar, { width: 52, height: 52, borderRadius: 26 }]}>
                    <Text style={[styles.avatarText, { fontSize: 18 }]}>
                      {`${selectedStudent.first_name || ''} ${selectedStudent.last_name || ''}`
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase() || 'ST'}
                    </Text>
                  </View>
                  <Text style={styles.modalStudentName}>
                    {selectedStudent.first_name} {selectedStudent.last_name}
                  </Text>
                  <Text style={styles.modalStudentId}>
                    {selectedStudent.admission_number || selectedStudent.student_code || `#${selectedStudent.id}`}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Branch Dojo:</Text>
                  <Text style={styles.detailValue}>{selectedStudent.branch_name || 'Main Campus'}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Email:</Text>
                  <Text style={styles.detailValue}>{selectedStudent.email || '—'}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Phone:</Text>
                  <Text style={styles.detailValue}>{selectedStudent.phone || '—'}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Guardian:</Text>
                  <Text style={styles.detailValue}>
                    {selectedStudent.father_name || selectedStudent.guardian_name || '—'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Guardian Phone:</Text>
                  <Text style={styles.detailValue}>
                    {selectedStudent.father_phone || selectedStudent.guardian_phone || '—'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Enrolled Since:</Text>
                  <Text style={styles.detailValue}>
                    {selectedStudent.enrolled_at || selectedStudent.created_at || 'Recent'}
                  </Text>
                </View>
              </ScrollView>
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    margin: 16,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    height: 42,
    color: colors.text,
    fontSize: 13.5,
  },
  clearBtn: {
    padding: 6,
  },
  clearBtnText: {
    color: colors.textSubtle,
    fontSize: 14,
  },
  countText: {
    fontSize: 11.5,
    color: colors.textSubtle,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  scrollList: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  cardBody: {
    flex: 1,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  studentMeta: {
    fontSize: 11.5,
    color: colors.textMuted,
    marginTop: 2,
  },
  studentPhone: {
    fontSize: 11,
    color: colors.textSubtle,
    marginTop: 2,
  },
  cardRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  statusTag: {
    fontSize: 9.5,
    fontWeight: '700',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    textTransform: 'uppercase',
  },
  statusActive: {
    color: colors.accent,
    backgroundColor: colors.accentLight,
  },
  statusInactive: {
    color: colors.danger,
    backgroundColor: colors.dangerLight,
  },
  chevron: {
    fontSize: 20,
    color: colors.textSubtle,
    marginTop: 4,
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
    maxHeight: '80%',
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  modalClose: {
    fontSize: 18,
    color: colors.textMuted,
    padding: 4,
  },
  modalBody: {
    marginBottom: 20,
  },
  modalHero: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalStudentName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
  },
  modalStudentId: {
    fontSize: 12,
    color: colors.gold,
    marginTop: 2,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  detailLabel: {
    fontSize: 12.5,
    color: colors.textMuted,
  },
  detailValue: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.text,
    maxWidth: '60%',
    textAlign: 'right',
  },
});

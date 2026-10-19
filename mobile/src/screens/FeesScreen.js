import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Share,
  Modal,
} from 'react-native';
import { colors } from '../theme';
import { api, formatCurrency } from '../api';

export default function FeesScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fees, setFees] = useState([]);
  const [selectedFee, setSelectedFee] = useState(null);

  const loadFees = useCallback(async () => {
    try {
      const res = await api('GET', '/api/academy/fees');
      if (res.success) {
        setFees(res.fees || []);
      }
    } catch (e) {
      console.warn('Error loading fees:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadFees();
  }, [loadFees]);

  const onRefresh = () => {
    setRefreshing(true);
    loadFees();
  };

  const handleShareReceipt = async (item) => {
    try {
      const sName = `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'Student';
      const rNum = item.receipt_number || item.invoice_number || `INV-${item.id}`;
      const period = item.period_start && item.period_end ? `${item.period_start} to ${item.period_end}` : 'Coaching Cycle';
      const msg = `🏆 International Sports Solutions\nOfficial Coaching Fee Receipt: ${rNum}\nStudent: ${sName}\nCoverage Period: ${period}\nAmount Paid: ${formatCurrency(item.paid_amount || item.amount)}\nBalance: ${formatCurrency(item.balance_amount || 0)}\nStatus: ${(item.status || 'PAID').toUpperCase()}\nVerified Digital Letterhead.`;
      
      await Share.share({
        message: msg,
        title: `Fee Receipt - ${rNum}`,
      });
    } catch (e) {
      console.warn('Share error:', e);
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading Fee Ledger & Invoices...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Text style={styles.headerTitle}>Fee Invoices & Statements</Text>
        <Text style={styles.headerSub}>Itemized dues, discount breakdown and coaching coverage</Text>

        {fees.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No fee invoices recorded</Text>
            <Text style={styles.emptySub}>Fee payments made in the portal will appear here.</Text>
          </View>
        ) : (
          fees.map((f) => {
            const sName = `${f.first_name || ''} ${f.last_name || ''}`.trim() || 'Student';
            const rNum = f.receipt_number || f.invoice_number || `INV-${f.id}`;
            const isPaid = f.status === 'paid';
            const isOverdue = f.status === 'overdue';
            const period = f.period_start && f.period_end ? `${f.period_start} – ${f.period_end}` : 'Coaching Cycle';
            const discountAmt = Number(f.discount_amount || 0);

            return (
              <View key={f.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.studentName}>{sName}</Text>
                    <Text style={styles.receiptRef}>
                      {rNum} • {f.admission_number || 'N/A'}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.statusBadge,
                      isPaid ? styles.statusPaid : isOverdue ? styles.statusOverdue : styles.statusPending,
                    ]}
                  >
                    {(f.status || 'PENDING').toUpperCase()}
                  </Text>
                </View>

                {/* Coverage & Due Date */}
                <View style={styles.metaBox}>
                  <Text style={styles.metaText}>
                    📅 Coverage: <Text style={styles.metaBold}>{period}</Text>
                  </Text>
                  {f.due_date ? (
                    <Text style={styles.metaText}>
                      ⏰ Due Date: <Text style={styles.metaBold}>{f.due_date}</Text>
                    </Text>
                  ) : null}
                </View>

                {/* Financials Row */}
                <View style={styles.financeRow}>
                  <View>
                    <Text style={styles.financeLabel}>Net Total</Text>
                    <Text style={styles.financeVal}>{formatCurrency(f.net_amount || f.amount)}</Text>
                  </View>

                  {discountAmt > 0 && (
                    <View>
                      <Text style={[styles.financeLabel, { color: colors.accent }]}>Discount</Text>
                      <Text style={[styles.financeVal, { color: colors.accent }]}>
                        -{formatCurrency(discountAmt)}
                      </Text>
                    </View>
                  )}

                  <View>
                    <Text style={styles.financeLabel}>Paid</Text>
                    <Text style={[styles.financeVal, { color: colors.accent }]}>
                      {formatCurrency(f.paid_amount)}
                    </Text>
                  </View>

                  <View>
                    <Text style={styles.financeLabel}>Balance</Text>
                    <Text style={[styles.financeVal, { color: colors.gold }]}>
                      {formatCurrency(f.balance_amount || 0)}
                    </Text>
                  </View>
                </View>

                {/* Actions Row */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.detailBtn}
                    onPress={() => setSelectedFee(f)}
                  >
                    <Text style={styles.detailBtnText}>View Breakdown</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.shareBtn}
                    onPress={() => handleShareReceipt(f)}
                  >
                    <Text style={styles.shareBtnText}>📤 Share Receipt</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Invoice Breakdown Modal */}
      {selectedFee && (
        <Modal
          visible={Boolean(selectedFee)}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedFee(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Receipt & Ledger Details</Text>
                <TouchableOpacity onPress={() => setSelectedFee(null)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <View style={styles.modalHero}>
                  <Text style={styles.modalStudentName}>
                    {selectedFee.first_name} {selectedFee.last_name}
                  </Text>
                  <Text style={styles.modalReceiptNo}>
                    {selectedFee.receipt_number || selectedFee.invoice_number || `INV-${selectedFee.id}`}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Coaching Coverage:</Text>
                  <Text style={styles.detailValue}>
                    {selectedFee.period_start && selectedFee.period_end
                      ? `${selectedFee.period_start} to ${selectedFee.period_end}`
                      : 'Standard Cycle'}
                  </Text>
                </View>

                {selectedFee.months_count ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Months Covered:</Text>
                    <Text style={styles.detailValue}>{selectedFee.months_count} Month(s)</Text>
                  </View>
                ) : null}

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Base Coaching Fee:</Text>
                  <Text style={styles.detailValue}>{formatCurrency(selectedFee.base_fee || selectedFee.amount)}</Text>
                </View>

                {Number(selectedFee.discount_amount || 0) > 0 && (
                  <>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: colors.accent }]}>
                        Discount Applied ({selectedFee.discount_percentage || 0}%):
                      </Text>
                      <Text style={[styles.detailValue, { color: colors.accent }]}>
                        -{formatCurrency(selectedFee.discount_amount)}
                      </Text>
                    </View>
                    {selectedFee.discount_reason ? (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Discount Reason:</Text>
                        <Text style={styles.detailValue}>{selectedFee.discount_reason}</Text>
                      </View>
                    ) : null}
                  </>
                )}

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Net Payable Fee:</Text>
                  <Text style={styles.detailValue}>{formatCurrency(selectedFee.net_amount || selectedFee.amount)}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Total Paid:</Text>
                  <Text style={[styles.detailValue, { color: colors.accent }]}>
                    {formatCurrency(selectedFee.paid_amount)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Remaining Balance:</Text>
                  <Text style={[styles.detailValue, { color: colors.gold, fontWeight: '700' }]}>
                    {formatCurrency(selectedFee.balance_amount || 0)}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.shareBtn, { marginTop: 20, paddingVertical: 12 }]}
                  onPress={() => {
                    handleShareReceipt(selectedFee);
                    setSelectedFee(null);
                  }}
                >
                  <Text style={[styles.shareBtnText, { textAlign: 'center', width: '100%' }]}>
                    📤 Share Official Receipt
                  </Text>
                </TouchableOpacity>
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
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  receiptRef: {
    fontSize: 11.5,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusPaid: {
    color: colors.accent,
    backgroundColor: colors.accentLight,
  },
  statusPending: {
    color: colors.gold,
    backgroundColor: colors.goldLight,
  },
  statusOverdue: {
    color: colors.danger,
    backgroundColor: colors.dangerLight,
  },
  metaBox: {
    backgroundColor: colors.bgInput,
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  metaText: {
    fontSize: 11.5,
    color: colors.textMuted,
    marginVertical: 1,
  },
  metaBold: {
    color: colors.text,
    fontWeight: '600',
  },
  financeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 12,
  },
  financeLabel: {
    fontSize: 10.5,
    color: colors.textSubtle,
  },
  financeVal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  detailBtn: {
    flex: 1,
    backgroundColor: colors.bgInput,
    paddingVertical: 9,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  detailBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  shareBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 9,
    borderRadius: 6,
    alignItems: 'center',
  },
  shareBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
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
    backgroundColor: colors.bgInput,
    padding: 12,
    borderRadius: 8,
  },
  modalStudentName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  modalReceiptNo: {
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
    maxWidth: '55%',
    textAlign: 'right',
  },
});

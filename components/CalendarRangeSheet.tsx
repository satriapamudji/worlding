import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ScrollView,
} from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { getMonthDays } from '@/lib/date-utils';

type Props = {
  visible: boolean;
  month: Date;
  tempStart: Date | null;
  tempEnd: Date | null;
  onChangeMonth: (next: Date) => void;
  onDayPress: (day: Date) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear - 10; y <= currentYear + 2; y++) {
    years.push(y);
  }
  return years;
}

export function CalendarRangeSheet({
  visible,
  month,
  tempStart,
  tempEnd,
  onChangeMonth,
  onDayPress,
  onCancel,
  onConfirm,
}: Props) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['90%'], []);
  const [showPicker, setShowPicker] = useState(false);

  const days = getMonthDays(month);
  const years = useMemo(() => getYearOptions(), []);

  // Auto-expand on mount since we conditionally render
  useEffect(() => {
    // Small delay to ensure the ref is ready
    const timer = setTimeout(() => {
      bottomSheetRef.current?.expand();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const triggerHaptic = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      setShowPicker(false);
      onCancel();
    }
  }, [onCancel]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
        pressBehavior="close"
      />
    ),
    []
  );

  const getDayState = (day: Date) => {
    if (!tempStart) return { isStart: false, isEnd: false, inRange: false };
    const isStart = day.toDateString() === tempStart.toDateString();
    const isEnd = tempEnd && day.toDateString() === tempEnd.toDateString();
    const inRange = tempEnd && day > tempStart && day < tempEnd;
    return { isStart, isEnd, inRange };
  };

  const handleYearSelect = (year: number) => {
    triggerHaptic();
    onChangeMonth(new Date(year, month.getMonth(), 1));
    setShowPicker(false);
  };

  const handleMonthSelect = (monthIdx: number) => {
    triggerHaptic();
    onChangeMonth(new Date(month.getFullYear(), monthIdx, 1));
    setShowPicker(false);
  };

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.background}
    >
      <BottomSheetView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onCancel} hitSlop={12}>
            <Text style={styles.headerCancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Select Dates</Text>
          <Pressable onPress={onConfirm} hitSlop={12}>
            <Text style={styles.headerDone}>Done</Text>
          </Pressable>
        </View>

        {/* Month/Year Selector */}
        <Pressable
          style={styles.monthSelector}
          onPress={() => {
            triggerHaptic();
            setShowPicker(!showPicker);
          }}
        >
          <Text style={styles.monthText}>
            {MONTHS[month.getMonth()]} {month.getFullYear()}
          </Text>
          <Text style={styles.chevron}>{showPicker ? '▲' : '▼'}</Text>
        </Pressable>

        {showPicker ? (
          /* Year/Month Picker */
          <View style={styles.pickerContainer}>
            <View style={styles.pickerColumn}>
              <Text style={styles.pickerLabel}>Year</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {years.map((year) => (
                  <Pressable
                    key={year}
                    style={[
                      styles.pickerItem,
                      year === month.getFullYear() && styles.pickerItemActive,
                    ]}
                    onPress={() => handleYearSelect(year)}
                  >
                    <Text style={[
                      styles.pickerItemText,
                      year === month.getFullYear() && styles.pickerItemTextActive,
                    ]}>
                      {year}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <View style={styles.pickerColumn}>
              <Text style={styles.pickerLabel}>Month</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {MONTHS.map((m, idx) => (
                  <Pressable
                    key={m}
                    style={[
                      styles.pickerItem,
                      idx === month.getMonth() && styles.pickerItemActive,
                    ]}
                    onPress={() => handleMonthSelect(idx)}
                  >
                    <Text style={[
                      styles.pickerItemText,
                      idx === month.getMonth() && styles.pickerItemTextActive,
                    ]}>
                      {m}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        ) : (
          /* Calendar */
          <>
            {/* Navigation */}
            <View style={styles.navRow}>
              <Pressable
                style={styles.navButton}
                onPress={() => {
                  triggerHaptic();
                  onChangeMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1));
                }}
              >
                <Text style={styles.navArrow}>‹</Text>
              </Pressable>
              <Pressable
                style={styles.navButton}
                onPress={() => {
                  triggerHaptic();
                  onChangeMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1));
                }}
              >
                <Text style={styles.navArrow}>›</Text>
              </Pressable>
            </View>

            {/* Weekdays */}
            <View style={styles.weekRow}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <Text key={i} style={styles.weekDay}>{d}</Text>
              ))}
            </View>

            {/* Days */}
            <View style={styles.daysGrid}>
              {days.map((day, idx) => {
                if (!day) {
                  return <View key={`empty-${idx}`} style={styles.dayCell} />;
                }

                const { isStart, isEnd, inRange } = getDayState(day);
                const isSelected = isStart || isEnd;
                const isToday = day.toDateString() === new Date().toDateString();

                return (
                  <Pressable
                    key={day.toISOString()}
                    style={styles.dayCell}
                    onPress={() => {
                      triggerHaptic();
                      onDayPress(day);
                    }}
                  >
                    {(inRange || (isStart && tempEnd) || (isEnd && tempStart)) && (
                      <View style={[
                        styles.rangeBg,
                        isStart && styles.rangeBgStart,
                        isEnd && styles.rangeBgEnd,
                      ]} />
                    )}
                    <View style={[
                      styles.dayInner,
                      isSelected && styles.daySelected,
                      isToday && !isSelected && styles.dayToday,
                    ]}>
                      <Text style={[
                        styles.dayText,
                        isSelected && styles.dayTextSelected,
                        inRange && styles.dayTextInRange,
                      ]}>
                        {day.getDate()}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Quick Select */}
            <View style={styles.quickRow}>
              {[
                { label: 'Today', days: 0 },
                { label: 'Last 7 days', days: 7 },
                { label: 'Last 30 days', days: 30 },
              ].map((opt) => (
                <Pressable
                  key={opt.label}
                  style={styles.quickButton}
                  onPress={() => {
                    triggerHaptic();
                    const end = new Date();
                    const start = new Date();
                    start.setDate(end.getDate() - opt.days);
                    onDayPress(start);
                    setTimeout(() => onDayPress(end), 50);
                  }}
                >
                  <Text style={styles.quickText}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </BottomSheetView>
    </BottomSheet>
  );
}

const DAY_SIZE = 44;

const styles = StyleSheet.create({
  background: {
    backgroundColor: Colors.background,
  },
  handle: {
    backgroundColor: Colors.textMuted,
    width: 36,
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerCancel: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.lg,
    fontWeight: '600',
  },
  headerDone: {
    color: Colors.accent,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  monthText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xl,
    fontWeight: '600',
  },
  chevron: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navArrow: {
    color: Colors.textPrimary,
    fontSize: 24,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.sm,
  },
  weekDay: {
    width: DAY_SIZE,
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
    fontWeight: '500',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  dayCell: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  rangeBg: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,87,61,0.15)',
  },
  rangeBgStart: {
    left: '50%',
  },
  rangeBgEnd: {
    right: '50%',
  },
  dayInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  daySelected: {
    backgroundColor: Colors.accent,
  },
  dayToday: {
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  dayText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
  },
  dayTextSelected: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  dayTextInRange: {
    color: Colors.textPrimary,
  },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  quickButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
  },
  quickText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
  },
  pickerContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  pickerColumn: {
    flex: 1,
  },
  pickerLabel: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  pickerItem: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: 4,
  },
  pickerItemActive: {
    backgroundColor: Colors.accent,
  },
  pickerItemText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    textAlign: 'center',
  },
  pickerItemTextActive: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },
});

export default CalendarRangeSheet;

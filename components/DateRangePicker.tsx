import React, { useCallback, useState } from 'react';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';

import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';

interface DateRangePickerProps {
  startDate: Date;
  endDate: Date;
  onRangeChange: (start: Date, end: Date) => void;
}

interface QuickOption {
  label: string;
  id: string;
  getRange: () => { start: Date; end: Date };
}

const getQuickOptions = (): QuickOption[] => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  return [
    {
      id: 'today',
      label: 'Today',
      getRange: () => ({
        start: today,
        end: now,
      }),
    },
    {
      id: 'yesterday',
      label: 'Yesterday',
      getRange: () => {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return {
          start: yesterday,
          end: today,
        };
      },
    },
    {
      id: 'this-weekend',
      label: 'This Weekend',
      getRange: () => {
        const dayOfWeek = today.getDay();
        const saturday = new Date(today);
        saturday.setDate(today.getDate() - dayOfWeek + 6 - (dayOfWeek === 0 ? 7 : 0));
        const monday = new Date(saturday);
        monday.setDate(saturday.getDate() + 2);
        return {
          start: saturday,
          end: monday,
        };
      },
    },
    {
      id: 'last-week',
      label: 'Last Week',
      getRange: () => {
        const lastWeekStart = new Date(today);
        lastWeekStart.setDate(today.getDate() - 7);
        return {
          start: lastWeekStart,
          end: today,
        };
      },
    },
    {
      id: 'last-month',
      label: 'Last Month',
      getRange: () => {
        const lastMonthStart = new Date(today);
        lastMonthStart.setMonth(today.getMonth() - 1);
        return {
          start: lastMonthStart,
          end: today,
        };
      },
    },
  ];
};

/**
 * DateRangePicker - Horizontal scrollable date range selector
 * 
 * UI/UX Standards:
 * - 8px gap between pills
 * - 12px horizontal padding inside pills
 * - Clear visual feedback on selection
 */
export function DateRangePicker({
  startDate,
  endDate,
  onRangeChange,
}: DateRangePickerProps) {
  const [selectedOption, setSelectedOption] = useState<string>('last-week');
  const quickOptions = getQuickOptions();

  const handleOptionPress = useCallback((option: QuickOption) => {
    setSelectedOption(option.id);
    const { start, end } = option.getRange();
    onRangeChange(start, end);
  }, [onRangeChange]);

  const formatDateRange = (start: Date, end: Date): string => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    };
    const startStr = start.toLocaleDateString('en-US', options);
    const endStr = end.toLocaleDateString('en-US', options);
    
    if (startStr === endStr) {
      return startStr;
    }
    return `${startStr} – ${endStr}`;
  };

  return (
    <View style={styles.container}>
      {/* Selected Range Display */}
      <View style={styles.rangeDisplay}>
        <Text style={styles.rangeText}>
          {formatDateRange(startDate, endDate)}
        </Text>
      </View>

      {/* Quick Options */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.optionsContainer}
      >
        {quickOptions.map((option) => (
          <OptionPill
            key={option.id}
            label={option.label}
            isSelected={selectedOption === option.id}
            onPress={() => handleOptionPress(option)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

interface OptionPillProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}

function OptionPill({ label, isSelected, onPress }: OptionPillProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          styles.pill,
          isSelected && styles.pillSelected,
          animatedStyle,
        ]}
      >
        <Text style={[
          styles.pillText,
          isSelected && styles.pillTextSelected,
        ]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  rangeDisplay: {
    backgroundColor: Colors.glassHighlight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    alignSelf: 'flex-start',
  },
  rangeText: {
    color: Colors.accent,
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
  },
  optionsContainer: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
    ...Shadows.glowSubtle,
  },
  pillText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    fontWeight: '500',
  },
  pillTextSelected: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },
});

export default DateRangePicker;

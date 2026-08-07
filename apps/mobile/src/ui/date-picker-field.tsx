import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Calendar, LocaleConfig, type DateData } from "react-native-calendars";
import { spacing } from "../theme/tokens";
import { useAppTheme, type AppPalette } from "../theme/use-app-theme";
import { CalendarDays, Close } from "./icon";
import { IconButton } from "./icon-button";

LocaleConfig.locales.pl = {
  dayNames: [
    "Niedziela",
    "Poniedziałek",
    "Wtorek",
    "Środa",
    "Czwartek",
    "Piątek",
    "Sobota",
  ],
  dayNamesShort: ["Nie", "Pon", "Wto", "Śro", "Czw", "Pią", "Sob"],
  monthNames: [
    "Styczeń",
    "Luty",
    "Marzec",
    "Kwiecień",
    "Maj",
    "Czerwiec",
    "Lipiec",
    "Sierpień",
    "Wrzesień",
    "Październik",
    "Listopad",
    "Grudzień",
  ],
  monthNamesShort: [
    "Sty",
    "Lut",
    "Mar",
    "Kwi",
    "Maj",
    "Cze",
    "Lip",
    "Sie",
    "Wrz",
    "Paź",
    "Lis",
    "Gru",
  ],
  today: "Dzisiaj",
};

type DatePickerFieldProps = {
  allowClear?: boolean;
  label: string;
  onChange: (date: string) => void;
  value: string;
};

export function DatePickerField({
  allowClear = false,
  label,
  onChange,
  value,
}: DatePickerFieldProps) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const [visible, setVisible] = useState(false);
  const selectedDate = isIsoDate(value) ? value : "";
  const initialDate = selectedDate || todayIso();

  useEffect(() => {
    LocaleConfig.defaultLocale = "pl";
  }, []);

  function selectDate(day: DateData) {
    onChange(day.dateString);
    setVisible(false);
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.triggerRow}>
        <Pressable
          accessibilityLabel={`${label}: ${selectedDate ? formatDateFull(selectedDate) : "nie wybrano"}`}
          accessibilityRole="button"
          onPress={() => setVisible((current) => !current)}
          style={({ pressed }) => [
            styles.trigger,
            visible && styles.triggerActive,
            pressed && styles.pressed,
          ]}
        >
          <CalendarDays color={theme.colors.finance} size={19} />
          <Text
            numberOfLines={1}
            style={[
              styles.triggerText,
              !selectedDate && styles.triggerPlaceholder,
            ]}
          >
            {selectedDate ? formatDateFull(selectedDate) : "Wybierz datę"}
          </Text>
        </Pressable>
        {allowClear && selectedDate ? (
          <IconButton
            accessibilityLabel={`Wyczyść pole ${label}`}
            onPress={() => onChange("")}
            style={styles.clearButton}
          >
            <Close color={theme.colors.textMuted} size={17} />
          </IconButton>
        ) : null}
      </View>
      {visible ? (
        <View style={styles.calendarCard}>
          <Calendar
            current={initialDate}
            enableSwipeMonths
            firstDay={1}
            markedDates={
              selectedDate
                ? {
                    [selectedDate]: {
                      selected: true,
                      selectedColor: theme.colors.finance,
                      selectedTextColor: theme.colors.inverseText,
                    },
                  }
                : undefined
            }
            onDayPress={selectDate}
            theme={{
              arrowColor: theme.colors.finance,
              backgroundColor: theme.colors.card,
              calendarBackground: theme.colors.card,
              dayTextColor: theme.colors.text,
              monthTextColor: theme.colors.text,
              selectedDayBackgroundColor: theme.colors.finance,
              selectedDayTextColor: theme.colors.inverseText,
              textDisabledColor: theme.colors.textSubtle,
              textMonthFontSize: 15,
              textMonthFontWeight: "800",
              textSectionTitleColor: theme.colors.textMuted,
              todayTextColor: theme.colors.finance,
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateFull(value: string): string {
  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    calendarCard: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 10,
      borderWidth: 1,
      overflow: "hidden",
    },
    clearButton: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      height: 44,
      width: 44,
    },
    field: {
      gap: 6,
    },
    label: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0,
    },
    pressed: {
      opacity: 0.78,
    },
    trigger: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      flex: 1,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 44,
      paddingHorizontal: spacing.md,
    },
    triggerActive: {
      borderColor: colors.finance,
    },
    triggerPlaceholder: {
      color: colors.textMuted,
      fontWeight: "500",
    },
    triggerRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    triggerText: {
      color: colors.text,
      flex: 1,
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 0,
    },
  });
}

import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { radii, spacing } from "../theme/tokens";
import { useAppTheme, type AppPalette } from "../theme/use-app-theme";
import { Check, ChevronDown, Search } from "./icon";
import { FormModal } from "./form-modal";
import { InlineAlert } from "./inline-alert";

export type SelectOption = {
  id: string;
  label: string;
  meta?: string;
};

type SelectFieldProps = {
  disabled?: boolean;
  emptyText: string;
  label: string;
  onSelect: (id: string) => void;
  options: SelectOption[];
  placeholder: string;
  searchPlaceholder?: string;
  value: string | null;
};

export function SelectField({
  disabled = false,
  emptyText,
  label,
  onSelect,
  options,
  placeholder,
  searchPlaceholder = "Szukaj",
  value,
}: SelectFieldProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find((option) => option.id === value) ?? null;
  const normalizedSearch = search.trim().toLocaleLowerCase("pl-PL");
  const filteredOptions = useMemo(
    () =>
      normalizedSearch
        ? options.filter((option) =>
            `${option.label} ${option.meta ?? ""}`
              .toLocaleLowerCase("pl-PL")
              .includes(normalizedSearch),
          )
        : options,
    [normalizedSearch, options],
  );
  const isDisabled = disabled || options.length === 0;

  function close() {
    setVisible(false);
    setSearch("");
  }

  return (
    <View style={styles.root}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityLabel={`${label}: ${selected?.label ?? placeholder}`}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, expanded: visible }}
        disabled={isDisabled}
        onPress={() => setVisible(true)}
        style={({ pressed }) => [
          styles.field,
          isDisabled && styles.fieldDisabled,
          pressed && !isDisabled && styles.fieldPressed,
        ]}
      >
        <Text
          numberOfLines={1}
          style={[styles.value, !selected && styles.placeholder]}
        >
          {selected?.label ?? placeholder}
        </Text>
        <ChevronDown
          color={isDisabled ? theme.colors.textSubtle : theme.colors.textMuted}
          size={20}
        />
      </Pressable>

      <FormModal compact onClose={close} title={label} visible={visible}>
        <View style={styles.searchField}>
          <Search color={theme.colors.textMuted} size={19} />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setSearch}
            placeholder={searchPlaceholder}
            placeholderTextColor={theme.colors.textSubtle}
            selectionColor={theme.colors.primary}
            style={styles.searchInput}
            value={search}
          />
        </View>

        {filteredOptions.length === 0 ? (
          <InlineAlert text={normalizedSearch ? "Brak wyników." : emptyText} />
        ) : (
          <View style={styles.options}>
            {filteredOptions.map((option) => {
              const isSelected = option.id === value;

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  key={option.id}
                  onPress={() => {
                    onSelect(option.id);
                    close();
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    isSelected && styles.optionSelected,
                    pressed && styles.optionPressed,
                  ]}
                >
                  <View style={styles.optionText}>
                    <Text numberOfLines={2} style={styles.optionLabel}>
                      {option.label}
                    </Text>
                    {option.meta ? (
                      <Text numberOfLines={1} style={styles.optionMeta}>
                        {option.meta}
                      </Text>
                    ) : null}
                  </View>
                  {isSelected ? (
                    <Check color={theme.colors.primaryDark} size={21} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}
      </FormModal>
    </View>
  );
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    field: {
      alignItems: "center",
      backgroundColor: colors.field,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 50,
      paddingHorizontal: spacing.md,
    },
    fieldDisabled: {
      backgroundColor: colors.surfaceMuted,
      opacity: 0.72,
    },
    fieldPressed: {
      borderColor: colors.primary,
    },
    label: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0,
    },
    option: {
      alignItems: "center",
      backgroundColor: colors.field,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.md,
      minHeight: 52,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    optionLabel: {
      color: colors.text,
      fontSize: 14,
      letterSpacing: 0,
      lineHeight: 19,
    },
    optionMeta: {
      color: colors.textMuted,
      fontSize: 12,
      letterSpacing: 0,
      lineHeight: 17,
    },
    optionPressed: {
      borderColor: colors.primary,
    },
    optionSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    options: {
      gap: spacing.sm,
    },
    optionText: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    placeholder: {
      color: colors.textSubtle,
    },
    root: {
      flex: 1,
      gap: spacing.xs,
      minWidth: 0,
    },
    searchField: {
      alignItems: "center",
      backgroundColor: colors.field,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 48,
      paddingHorizontal: spacing.md,
    },
    searchInput: {
      color: colors.text,
      flex: 1,
      fontSize: 14,
      letterSpacing: 0,
      minHeight: 46,
      paddingVertical: 0,
    },
    value: {
      color: colors.text,
      flex: 1,
      fontSize: 14,
      letterSpacing: 0,
      lineHeight: 19,
      minWidth: 0,
    },
  });
}

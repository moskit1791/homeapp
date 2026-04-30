import { Control, FieldPath, FieldValues, useController } from 'react-hook-form';
import { useState } from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle
} from 'react-native';
import { radii, spacing } from '../theme/tokens';
import { useAppTheme, type AppPalette } from '../theme/use-app-theme';

interface TextFieldProps<TFieldValues extends FieldValues> extends TextInputProps {
  containerStyle?: StyleProp<ViewStyle>;
  control: Control<TFieldValues>;
  inputStyle?: StyleProp<TextStyle>;
  label: string;
  name: FieldPath<TFieldValues>;
}

export function TextField<TFieldValues extends FieldValues>({
  containerStyle,
  control,
  inputStyle,
  label,
  name,
  ...inputProps
}: TextFieldProps<TFieldValues>) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const [focused, setFocused] = useState(false);
  const {
    field,
    fieldState: { error }
  } = useController({ control, name });
  const { onBlur, onFocus, style, ...restInputProps } = inputProps;

  return (
    <View style={[styles.root, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...restInputProps}
        autoCapitalize={inputProps.autoCapitalize ?? 'none'}
        autoCorrect={inputProps.autoCorrect ?? false}
        onBlur={(event) => {
          setFocused(false);
          field.onBlur();
          onBlur?.(event);
        }}
        onChangeText={field.onChange}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        placeholderTextColor={theme.colors.textSubtle}
        selectionColor={theme.colors.primary}
        style={[styles.input, focused && styles.inputFocused, error && styles.inputError, inputStyle, style]}
        value={field.value ?? ''}
      />
      {error ? <Text style={styles.error}>{error.message}</Text> : null}
    </View>
  );
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
  error: {
    color: colors.danger,
    fontSize: 12,
    letterSpacing: 0
  },
  input: {
    backgroundColor: colors.field,
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    letterSpacing: 0,
    minHeight: 50,
    paddingHorizontal: spacing.md
  },
  inputError: {
    borderColor: colors.danger
  },
  inputFocused: {
    borderColor: colors.primary
  },
  label: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0
  },
  root: {
    gap: spacing.xs
  }
});
}

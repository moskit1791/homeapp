import { ReactNode, useState } from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle
} from 'react-native';
import { radii, spacing } from '../theme/tokens';
import { useAppTheme, type AppPalette } from '../theme/use-app-theme';

interface AuthTextFieldProps extends TextInputProps {
  containerStyle?: StyleProp<ViewStyle>;
  error?: string;
  label: string;
  rightElement?: ReactNode;
}

export function AuthTextField({
  containerStyle,
  error,
  label,
  onBlur,
  onFocus,
  rightElement,
  style,
  ...inputProps
}: AuthTextFieldProps) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.root, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, focused && styles.inputFocused, error && styles.inputError]}>
        <TextInput
          {...inputProps}
          autoCapitalize={inputProps.autoCapitalize ?? 'none'}
          autoCorrect={inputProps.autoCorrect ?? false}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          placeholderTextColor={theme.colors.textSubtle}
          selectionColor={theme.colors.primary}
          style={[styles.input, style]}
        />
        {rightElement ? <View style={styles.right}>{rightElement}</View> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
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
      color: colors.text,
      flex: 1,
      fontSize: 15,
      letterSpacing: 0,
      minHeight: 48,
      paddingHorizontal: spacing.md
    },
    inputError: {
      borderColor: colors.danger
    },
    inputFocused: {
      borderColor: colors.primary
    },
    inputWrap: {
      alignItems: 'center',
      backgroundColor: colors.field,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      flexDirection: 'row',
      minHeight: 50
    },
    label: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0
    },
    right: {
      paddingRight: spacing.sm
    },
    root: {
      gap: spacing.xs
    }
  });
}

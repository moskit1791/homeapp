import { StyleSheet, Text, View } from 'react-native';
import { radii, spacing } from '../theme/tokens';
import { useAppTheme, type AppPalette } from '../theme/use-app-theme';

interface InlineAlertProps {
  tone?: 'error' | 'info';
  text: string;
}

export function InlineAlert({ text, tone = 'info' }: InlineAlertProps) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <View style={[styles.root, tone === 'error' ? styles.error : styles.info]}>
      <Text style={[styles.text, tone === 'error' ? styles.errorText : styles.infoText]}>{text}</Text>
    </View>
  );
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
  error: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerSoft
  },
  errorText: {
    color: colors.danger
  },
  info: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border
  },
  infoText: {
    color: colors.textMuted
  },
  root: {
    borderRadius: radii.control,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 18
  }
});
}

import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";
import { ApiNetworkError, resetPassword } from "../../src/api";
import { radii, spacing } from "../../src/theme/tokens";
import { useAppTheme, type AppPalette } from "../../src/theme/use-app-theme";
import { ActionButton } from "../../src/ui/action-button";
import { AuthTextField } from "../../src/ui/auth-text-field";
import { ChevronLeft, Eye, EyeOff, Home } from "../../src/ui/icon";

const resetPasswordSchema = z.object({
  password: z.string().min(8, "Hasło musi mieć min. 8 znaków"),
  token: z.string().trim().min(1, "Link resetu hasła jest nieprawidłowy lub wygasł"),
});

type ResetPasswordValues = z.input<typeof resetPasswordSchema>;
type ResetPasswordField = keyof ResetPasswordValues;
type FieldErrors<TField extends string> = Partial<Record<TField, string>>;

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const token = normalizeParam(params.token);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors<ResetPasswordField>>({});
  const [notice, setNotice] = useState<string | null>(
    token ? null : "Link resetu hasła jest nieprawidłowy lub wygasł.",
  );
  const [loading, setLoading] = useState(false);

  function updatePassword(value: string) {
    setPassword(value);
    setErrors((current) => ({ ...current, password: undefined }));
    setNotice(token ? null : "Link resetu hasła jest nieprawidłowy lub wygasł.");
  }

  async function submit() {
    const parsed = resetPasswordSchema.safeParse({ password, token });

    if (!parsed.success) {
      setErrors(toFieldErrors<ResetPasswordField>(parsed.error));
      setNotice(parsed.error.issues.find((issue) => issue.path[0] === "token")?.message ?? null);
      return;
    }

    setLoading(true);
    setNotice(null);

    try {
      await resetPassword(parsed.data);
      setNotice("Hasło zostało zmienione. Możesz się zalogować.");
      setTimeout(() => router.replace("/login" as never), 900);
    } catch (submitError) {
      setNotice(getMessage(submitError));
    } finally {
      setLoading(false);
    }
  }

  const noticeTone = notice?.startsWith("Nie") || notice?.startsWith("Link") ? "error" : "info";

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboardView}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Wróć do logowania"
            accessibilityRole="button"
            onPress={() => router.replace("/login" as never)}
            style={styles.backButton}
          >
            <ChevronLeft color={theme.colors.textMuted} size={20} />
            <Text style={styles.backText}>Logowanie</Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.shell}>
            <View style={styles.brandBar}>
              <View style={styles.brandIcon}>
                <Home color={theme.colors.inverseText} size={26} />
              </View>
              <Text style={styles.brand}>HomeApp</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.heading}>Ustaw nowe hasło</Text>
              <Text style={styles.copy}>Wpisz nowe hasło do konta.</Text>
              <AuthTextField
                autoComplete="new-password"
                error={errors.password}
                label="Nowe hasło"
                onChangeText={updatePassword}
                placeholder="Minimum 8 znaków"
                rightElement={
                  <IconTap onPress={() => setShowPassword((current) => !current)}>
                    {showPassword ? (
                      <EyeOff color={theme.colors.textMuted} size={18} />
                    ) : (
                      <Eye color={theme.colors.textMuted} size={18} />
                    )}
                  </IconTap>
                }
                secureTextEntry={!showPassword}
                textContentType="newPassword"
                value={password}
              />
              <PasswordStrength value={password} />
              {notice ? <Banner message={notice} tone={noticeTone} /> : null}
              <ActionButton disabled={!token || loading} loading={loading} onPress={submit} title="Zmień hasło" />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function IconTap({ children, onPress }: { children: ReactNode; onPress: () => void }) {
  const styles = createStyles(useAppTheme().colors);

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.iconTap}>
      {children}
    </Pressable>
  );
}

function Banner({ message, tone }: { message: string; tone: "error" | "info" }) {
  const styles = createStyles(useAppTheme().colors);

  return (
    <View style={[styles.banner, tone === "error" ? styles.errorBox : styles.infoBox]}>
      <Text style={[styles.bannerText, tone === "error" ? styles.error : styles.infoText]}>{message}</Text>
    </View>
  );
}

function PasswordStrength({ value }: { value: string }) {
  const styles = createStyles(useAppTheme().colors);
  const result = getPasswordStrength(value);

  return (
    <View style={styles.strengthRoot}>
      <View style={styles.strengthBars}>
        {[0, 1, 2, 3].map((item) => (
          <View
            key={item}
            style={[styles.strengthBar, item < result.score && { backgroundColor: result.color }]}
          />
        ))}
      </View>
      <Text style={styles.strengthText}>{result.label}</Text>
    </View>
  );
}

function normalizeParam(value: string | string[] | undefined): string {
  const normalized = Array.isArray(value) ? value[0] : value;

  return normalized?.trim() ?? "";
}

function toFieldErrors<TField extends string>(error: z.ZodError): FieldErrors<TField> {
  return error.issues.reduce<FieldErrors<TField>>((errors, issue) => {
    const field = issue.path[0];

    if (typeof field === "string") {
      errors[field as TField] = issue.message;
    }

    return errors;
  }, {});
}

function getMessage(error: unknown): string {
  if (error instanceof ApiNetworkError || (error instanceof TypeError && error.message === "Network request failed")) {
    return "Nie mogę połączyć się z serwerem. Sprawdź połączenie z internetem i spróbuj ponownie.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Nie udało się zmienić hasła";
}

function getPasswordStrength(value: string) {
  const checks = [
    value.length >= 8,
    /[A-ZĄĆĘŁŃÓŚŹŻ]/.test(value) && /[a-ząćęłńóśźż]/.test(value),
    /\d/.test(value),
    /[^A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż0-9]/.test(value),
  ];
  const score = checks.filter(Boolean).length;

  if (!value) {
    return { color: "#DFE3E8", label: "Wpisz hasło, aby zobaczyć siłę.", score: 0 };
  }

  if (score <= 1) {
    return { color: "#FF5630", label: "Słabe hasło", score: Math.max(score, 1) };
  }

  if (score === 2) {
    return { color: "#FFAB00", label: "Średnie hasło", score };
  }

  if (score === 3) {
    return { color: "#36B37E", label: "Dobre hasło", score };
  }

  return { color: "#00AB55", label: "Bardzo mocne hasło", score };
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    backButton: {
      alignItems: "center",
      alignSelf: "flex-start",
      flexDirection: "row",
      gap: spacing.xs,
      minHeight: 38,
      paddingRight: spacing.md,
    },
    backText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 0,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },
    banner: {
      borderRadius: radii.control,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    bannerText: {
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 0,
      lineHeight: 19,
    },
    brand: {
      color: colors.text,
      fontSize: 28,
      fontWeight: "900",
      letterSpacing: 0,
    },
    brandBar: {
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    brandIcon: {
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: 18,
      height: 64,
      justifyContent: "center",
      width: 64,
    },
    card: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      gap: spacing.md,
      padding: spacing.lg,
      width: "100%",
    },
    copy: {
      color: colors.textMuted,
      fontSize: 14,
      letterSpacing: 0,
      lineHeight: 20,
    },
    error: {
      color: colors.danger,
    },
    errorBox: {
      backgroundColor: "#FFF1F0",
      borderColor: "#FFDAD6",
    },
    heading: {
      color: colors.text,
      fontSize: 25,
      fontWeight: "900",
      letterSpacing: 0,
    },
    iconTap: {
      alignItems: "center",
      height: 36,
      justifyContent: "center",
      width: 36,
    },
    infoBox: {
      backgroundColor: colors.softBlue,
      borderColor: colors.border,
    },
    infoText: {
      color: colors.text,
    },
    keyboardView: {
      flex: 1,
    },
    safeArea: {
      backgroundColor: colors.background,
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: "center",
      padding: spacing.lg,
    },
    shell: {
      alignSelf: "center",
      gap: spacing.xl,
      maxWidth: 430,
      width: "100%",
    },
    strengthBar: {
      backgroundColor: colors.border,
      borderRadius: 999,
      flex: 1,
      height: 5,
    },
    strengthBars: {
      flexDirection: "row",
      gap: spacing.xs,
    },
    strengthRoot: {
      gap: spacing.xs,
    },
    strengthText: {
      color: colors.textMuted,
      fontSize: 12,
      letterSpacing: 0,
    },
  });
}

import {
  HOMEAPP_LEGAL_DOCUMENTS,
  type LegalDocumentKey,
} from "@homeapp/shared-types";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import brandIconSource from "../../assets/icon.png";
import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";
import {
  ApiNetworkError,
  previewInvitation,
  type InvitationPreview,
} from "../../src/api";
import { useSession } from "../../src/session/session-context";
import { radii, spacing } from "../../src/theme/tokens";
import { useAppTheme, type AppPalette } from "../../src/theme/use-app-theme";
import { ActionButton } from "../../src/ui/action-button";
import { AuthTextField } from "../../src/ui/auth-text-field";
import { Check, ChevronLeft, Eye, EyeOff, UserPlus } from "../../src/ui/icon";

const invitationSchema = z.object({
  acceptedPrivacy: z
    .boolean()
    .refine(Boolean, "Zaakceptuj politykę prywatności"),
  acceptedTerms: z.boolean().refine(Boolean, "Zaakceptuj regulamin"),
  displayName: z.string().trim().min(1, "Podaj imię"),
  password: z.string().min(8, "Hasło musi mieć min. 8 znaków"),
  token: z
    .string()
    .trim()
    .min(1, "Link zaproszenia jest nieprawidłowy lub wygasł"),
});

type InvitationValues = z.input<typeof invitationSchema>;
type InvitationField = keyof InvitationValues;
type FieldErrors<TField extends string> = Partial<Record<TField, string>>;
type LegalDocument = LegalDocumentKey;

export default function InvitationScreen() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const token = normalizeParam(params.token);
  const { completeInvitationRegistration, status } = useSession();
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(Boolean(token));
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [legalDocument, setLegalDocument] = useState<LegalDocument | null>(
    null,
  );
  const [errors, setErrors] = useState<FieldErrors<InvitationField>>({});
  const [notice, setNotice] = useState<string | null>(
    token ? null : "Link zaproszenia jest nieprawidłowy lub wygasł.",
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setPreviewLoading(false);
      return undefined;
    }

    let active = true;

    setPreviewLoading(true);
    setNotice(null);

    void previewInvitation(token)
      .then((invitation) => {
        if (!active) {
          return;
        }

        setPreview(invitation);
        setDisplayName(
          (current) => current || inferDisplayName(invitation.email),
        );
      })
      .catch((error) => {
        if (active) {
          setNotice(getMessage(error));
        }
      })
      .finally(() => {
        if (active) {
          setPreviewLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  if (status === "ready") {
    return <Redirect href={"/(tabs)" as never} />;
  }

  function updateDisplayName(value: string) {
    setDisplayName(value);
    setErrors((current) => ({ ...current, displayName: undefined }));
    setNotice(null);
  }

  function updatePassword(value: string) {
    setPassword(value);
    setErrors((current) => ({ ...current, password: undefined }));
    setNotice(null);
  }

  function toggleTerms() {
    setAcceptedTerms((current) => !current);
    setErrors((current) => ({ ...current, acceptedTerms: undefined }));
  }

  function togglePrivacy() {
    setAcceptedPrivacy((current) => !current);
    setErrors((current) => ({ ...current, acceptedPrivacy: undefined }));
  }

  async function submit() {
    const parsed = invitationSchema.safeParse({
      acceptedPrivacy,
      acceptedTerms,
      displayName,
      password,
      token,
    });

    if (!parsed.success) {
      setErrors(toFieldErrors<InvitationField>(parsed.error));
      setNotice(
        parsed.error.issues.find((issue) => issue.path[0] === "token")
          ?.message ?? null,
      );
      return;
    }

    setLoading(true);
    setNotice(null);

    try {
      await completeInvitationRegistration(parsed.data, { remember: true });
      router.replace("/(tabs)" as never);
    } catch (submitError) {
      setNotice(getMessage(submitError));
    } finally {
      setLoading(false);
    }
  }

  const noticeTone =
    notice?.startsWith("Nie") || notice?.startsWith("Link") ? "error" : "info";

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Wróć do logowania"
            accessibilityRole="button"
            onPress={() =>
              router.replace({
                pathname: "/login",
                params: { skipInitialAuthLink: "1" },
              } as never)
            }
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
                <Image source={brandIconSource} style={styles.brandIconImage} />
              </View>
              <Text style={styles.brand}>HomeApp</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.formTitle}>
                <View style={styles.titleIcon}>
                  <UserPlus color={theme.colors.primary} size={18} />
                </View>
                <Text style={styles.heading}>Dołącz do domu</Text>
              </View>
              {previewLoading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator color={theme.colors.primary} />
                  <Text style={styles.copy}>Sprawdzam zaproszenie...</Text>
                </View>
              ) : (
                <>
                  {preview ? (
                    <View style={styles.invitationBox}>
                      <Text style={styles.invitationLabel}>Zaproszenie</Text>
                      <Text style={styles.invitationTitle}>
                        {preview.householdName}
                      </Text>
                      <Text style={styles.copy}>
                        {preview.invitedByDisplayName} zaprasza adres{" "}
                        {preview.email}.
                      </Text>
                    </View>
                  ) : null}

                  <AuthTextField
                    autoCapitalize="words"
                    autoComplete="name"
                    error={errors.displayName}
                    label="Imię"
                    onChangeText={updateDisplayName}
                    placeholder="Jak mamy się zwracać?"
                    returnKeyType="next"
                    textContentType="name"
                    value={displayName}
                  />
                  <AuthTextField
                    autoComplete="new-password"
                    error={errors.password}
                    label="Hasło"
                    onChangeText={updatePassword}
                    placeholder="Minimum 8 znaków"
                    returnKeyType="done"
                    rightElement={
                      <IconTap
                        onPress={() => setShowPassword((current) => !current)}
                      >
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
                  <View style={styles.legalBox}>
                    <Checkbox
                      checked={acceptedTerms}
                      error={errors.acceptedTerms}
                      label="Akceptuję regulamin"
                      onPress={toggleTerms}
                    />
                    <Pressable onPress={() => setLegalDocument("terms")}>
                      <Text style={styles.link}>Podgląd regulaminu</Text>
                    </Pressable>
                    <Checkbox
                      checked={acceptedPrivacy}
                      error={errors.acceptedPrivacy}
                      label="Akceptuję politykę prywatności"
                      onPress={togglePrivacy}
                    />
                    <Pressable onPress={() => setLegalDocument("privacy")}>
                      <Text style={styles.link}>Podgląd polityki</Text>
                    </Pressable>
                  </View>
                  {notice ? (
                    <Banner message={notice} tone={noticeTone} />
                  ) : null}
                  <ActionButton
                    disabled={!token || !preview || loading}
                    loading={loading}
                    onPress={submit}
                    title="Utwórz konto i dołącz"
                  />
                  <ActionButton
                    disabled={!token || loading}
                    onPress={() =>
                      router.replace({
                        pathname: "/login",
                        params: {
                          invitationToken: token,
                          skipInitialAuthLink: "1",
                        },
                      } as never)
                    }
                    title="Mam już konto"
                    variant="secondary"
                  />
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <LegalModal
        document={legalDocument}
        onClose={() => setLegalDocument(null)}
      />
    </SafeAreaView>
  );

  function Checkbox({
    checked,
    error,
    label,
    onPress,
  }: {
    checked: boolean;
    error?: string;
    label: string;
    onPress: () => void;
  }) {
    return (
      <View style={styles.checkboxBlock}>
        <Pressable onPress={onPress} style={styles.checkboxRow}>
          <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
            {checked ? (
              <Check color={theme.colors.inverseText} size={13} />
            ) : null}
          </View>
          <Text style={styles.checkboxLabel}>{label}</Text>
        </Pressable>
        {error ? <Text style={styles.fieldError}>{error}</Text> : null}
      </View>
    );
  }

  function IconTap({
    children,
    onPress,
  }: {
    children: ReactNode;
    onPress: () => void;
  }) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={styles.iconTap}
      >
        {children}
      </Pressable>
    );
  }

  function Banner({
    message,
    tone,
  }: {
    message: string;
    tone: "error" | "info";
  }) {
    return (
      <View
        style={[
          styles.banner,
          tone === "error" ? styles.errorBox : styles.infoBox,
        ]}
      >
        <Text
          style={[
            styles.bannerText,
            tone === "error" ? styles.error : styles.infoText,
          ]}
        >
          {message}
        </Text>
      </View>
    );
  }

  function LegalModal({
    document,
    onClose,
  }: {
    document: LegalDocument | null;
    onClose: () => void;
  }) {
    const content = HOMEAPP_LEGAL_DOCUMENTS[document ?? "privacy"];

    return (
      <Modal
        animationType="fade"
        onRequestClose={onClose}
        transparent
        visible={Boolean(document)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{content.title}</Text>
            <ScrollView
              contentContainerStyle={styles.modalBodyContent}
              style={styles.modalBody}
            >
              <Text style={styles.modalMeta}>
                Obowiązuje od: {content.effectiveDate}
              </Text>
              {content.introduction.map((paragraph) => (
                <Text key={paragraph} style={styles.modalText}>
                  {paragraph}
                </Text>
              ))}
              {content.sections.map((section) => (
                <View key={section.title} style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>{section.title}</Text>
                  {section.paragraphs.map((paragraph) => (
                    <Text key={paragraph} style={styles.modalText}>
                      {paragraph}
                    </Text>
                  ))}
                </View>
              ))}
            </ScrollView>
            <ActionButton onPress={onClose} title="Rozumiem" />
          </View>
        </View>
      </Modal>
    );
  }
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
            style={[
              styles.strengthBar,
              item < result.score && { backgroundColor: result.color },
            ]}
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

function inferDisplayName(email: string): string {
  const localPart = email.split("@")[0] ?? "";
  const firstSegment = localPart.split(/[._-]/)[0] ?? localPart;

  return firstSegment
    ? firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1)
    : "";
}

function toFieldErrors<TField extends string>(
  error: z.ZodError,
): FieldErrors<TField> {
  return error.issues.reduce<FieldErrors<TField>>((errors, issue) => {
    const field = issue.path[0];

    if (typeof field === "string") {
      errors[field as TField] = issue.message;
    }

    return errors;
  }, {});
}

function getMessage(error: unknown): string {
  if (
    error instanceof ApiNetworkError ||
    (error instanceof TypeError && error.message === "Network request failed")
  ) {
    return "Nie mogę połączyć się z serwerem. Sprawdź połączenie z internetem i spróbuj ponownie.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Nie udało się obsłużyć zaproszenia";
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
    return {
      color: "#DFE3E8",
      label: "Wpisz hasło, aby zobaczyć siłę.",
      score: 0,
    };
  }

  if (score <= 1) {
    return {
      color: "#FF5630",
      label: "Słabe hasło",
      score: Math.max(score, 1),
    };
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
    brandIconImage: {
      borderRadius: 14,
      height: 52,
      width: 52,
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
    checkbox: {
      alignItems: "center",
      borderColor: colors.border,
      borderRadius: 4,
      borderWidth: 1,
      height: 18,
      justifyContent: "center",
      width: 18,
    },
    checkboxBlock: {
      gap: spacing.xs,
    },
    checkboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    checkboxLabel: {
      color: colors.textMuted,
      flex: 1,
      fontSize: 12,
      letterSpacing: 0,
      lineHeight: 17,
    },
    checkboxRow: {
      alignItems: "center",
      flexDirection: "row",
      flexShrink: 1,
      gap: spacing.sm,
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
      backgroundColor: colors.dangerSoft,
      borderColor: colors.isDark ? colors.danger : "#FFDAD6",
    },
    fieldError: {
      color: colors.danger,
      fontSize: 12,
      letterSpacing: 0,
    },
    formTitle: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.md,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },
    heading: {
      color: colors.text,
      flex: 1,
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
    invitationBox: {
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      gap: spacing.xs,
      padding: spacing.md,
    },
    invitationLabel: {
      color: colors.primaryDark,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    invitationTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "900",
      letterSpacing: 0,
    },
    keyboardView: {
      flex: 1,
    },
    legalBox: {
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.md,
    },
    link: {
      color: colors.primaryDark,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0,
    },
    loadingBox: {
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.lg,
    },
    modalBackdrop: {
      alignItems: "center",
      backgroundColor: colors.backdrop,
      flex: 1,
      justifyContent: "center",
      padding: spacing.lg,
    },
    modalBody: {
      maxHeight: 220,
    },
    modalBodyContent: {
      gap: spacing.sm,
      paddingBottom: spacing.xs,
    },
    modalCard: {
      backgroundColor: colors.modalSurface,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      gap: spacing.md,
      maxWidth: 430,
      padding: spacing.lg,
      width: "100%",
    },
    modalText: {
      color: colors.textMuted,
      fontSize: 13,
      letterSpacing: 0,
      lineHeight: 20,
    },
    modalMeta: {
      color: colors.textSubtle,
      fontSize: 12,
      letterSpacing: 0,
      lineHeight: 18,
    },
    modalSection: {
      gap: spacing.xs,
    },
    modalSectionTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "600",
      letterSpacing: 0,
      lineHeight: 21,
    },
    modalTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "900",
      letterSpacing: 0,
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
    titleIcon: {
      alignItems: "center",
      backgroundColor: colors.primarySoft,
      borderRadius: radii.control,
      height: 42,
      justifyContent: "center",
      width: 42,
    },
  });
}

import * as GoogleAuth from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import { Redirect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ReactNode, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';
import { ApiNetworkError, forgotPassword, resendVerification, resetPassword, verifyEmail } from '../src/api';
import { useSession } from '../src/session/session-context';
import { loadRememberedEmail } from '../src/session/secure-session-store';
import { useAppTheme, type AppPalette } from '../src/theme/use-app-theme';
import { radii, spacing } from '../src/theme/tokens';
import { ActionButton } from '../src/ui/action-button';
import { AuthTextField } from '../src/ui/auth-text-field';
import { Apple, Check, Eye, EyeOff, Google, Home, LogIn, UserPlus } from '../src/ui/icon';
import { SegmentedControl } from '../src/ui/segmented-control';

WebBrowser.maybeCompleteAuthSession();

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Podaj poprawny e-mail'),
  password: z.string().min(8, 'Hasło musi mieć min. 8 znaków')
});

const registerSchema = loginSchema.extend({
  displayName: z.string().trim().min(1, 'Podaj imię')
});

const householdSchema = z.object({
  name: z.string().trim().min(1, 'Podaj nazwę domu')
});

const resetRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email('Podaj poprawny e-mail')
});

const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Hasło musi mieć min. 8 znaków'),
  token: z.string().trim().min(1, 'Podaj token resetu')
});

type LoginFormValues = z.input<typeof loginSchema>;
type RegisterFormValues = z.input<typeof registerSchema>;
type HouseholdFormValues = z.input<typeof householdSchema>;
type ResetRequestValues = z.input<typeof resetRequestSchema>;
type ResetPasswordValues = z.input<typeof resetPasswordSchema>;
type LoginField = keyof LoginFormValues;
type RegisterField = keyof RegisterFormValues;
type HouseholdField = keyof HouseholdFormValues;
type ResetRequestField = keyof ResetRequestValues;
type ResetPasswordField = keyof ResetPasswordValues;
type FieldErrors<TField extends string> = Partial<Record<TField, string>>;
type LegalDocument = 'privacy' | 'terms';

export default function Index() {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const { createFirstHousehold, registerAndSignIn, signIn, signInWithGoogle, status } = useSession();
  const googleOAuthConfig = readGoogleOAuthConfig();
  const googleFallbackClientId =
    googleOAuthConfig.androidClientId ??
    googleOAuthConfig.iosClientId ??
    googleOAuthConfig.webClientId ??
    'google-oauth-not-configured';
  const [googleRequest, googleResponse, promptGoogleAsync] = GoogleAuth.useIdTokenAuthRequest({
    androidClientId: googleOAuthConfig.androidClientId,
    clientId: googleFallbackClientId,
    iosClientId: googleOAuthConfig.iosClientId,
    selectAccount: true,
    webClientId: googleOAuthConfig.webClientId
  });
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [legalDocument, setLegalDocument] = useState<LegalDocument | null>(null);
  const [resetVisible, setResetVisible] = useState(false);
  const [resetNotice, setResetNotice] = useState<string | null>(null);
  const [resetValues, setResetValues] = useState<ResetRequestValues>({ email: '' });
  const [newPasswordValues, setNewPasswordValues] = useState<ResetPasswordValues>({
    password: '',
    token: ''
  });
  const [loginValues, setLoginValues] = useState<LoginFormValues>({ email: '', password: '' });
  const [registerValues, setRegisterValues] = useState<RegisterFormValues>({
    displayName: '',
    email: '',
    password: ''
  });
  const [householdValues, setHouseholdValues] = useState<HouseholdFormValues>({ name: 'Mój dom' });
  const [loginErrors, setLoginErrors] = useState<FieldErrors<LoginField>>({});
  const [registerErrors, setRegisterErrors] = useState<FieldErrors<RegisterField>>({});
  const [householdErrors, setHouseholdErrors] = useState<FieldErrors<HouseholdField>>({});
  const [resetErrors, setResetErrors] = useState<FieldErrors<ResetRequestField>>({});
  const [newPasswordErrors, setNewPasswordErrors] = useState<FieldErrors<ResetPasswordField>>({});

  useEffect(() => {
    let active = true;

    async function fillRememberedEmail() {
      const email = await loadRememberedEmail();

      if (active && email) {
        setLoginValues((current) => ({ ...current, email }));
        setRememberMe(true);
      }
    }

    void fillRememberedEmail();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (googleResponse?.type !== 'success') {
      return;
    }

    const idToken = googleResponse.params.id_token;

    if (!idToken) {
      setNotice('Google nie zwrócił tokena ID. Sprawdź konfigurację klienta OAuth.');
      return;
    }

    setError(null);
    setLoading(true);

    void signInWithGoogle(idToken, { remember: rememberMe })
      .catch((submitError) => setError(getMessage(submitError)))
      .finally(() => setLoading(false));
  }, [googleResponse, rememberMe, signInWithGoogle]);

  useEffect(() => {
    let active = true;

    function handleAuthUrl(url: string) {
      const action = parseAuthDeepLink(url);

      if (!action || !active) {
        return;
      }

      setError(null);

      if (action.type === 'reset-password') {
        setResetVisible(true);
        setNewPasswordValues((current) => ({ ...current, token: action.token }));
        setResetNotice('Token resetu został uzupełniony z linku.');
        return;
      }

      setLoading(true);
      void verifyEmail({ email: action.email, token: action.token })
        .then(() => {
          if (!active) {
            return;
          }

          setMode('login');
          setLoginValues((current) => ({ ...current, email: action.email }));
          setNotice('Adres e-mail został potwierdzony. Możesz się zalogować.');
        })
        .catch((submitError) => {
          if (active) {
            setError(getMessage(submitError));
          }
        })
        .finally(() => {
          if (active) {
            setLoading(false);
          }
        });
    }

    void Linking.getInitialURL().then((url) => {
      if (url) {
        handleAuthUrl(url);
      }
    });

    const subscription = Linking.addEventListener('url', ({ url }) => handleAuthUrl(url));

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  if (status === 'ready') {
    return <Redirect href={'/(tabs)' as never} />;
  }

  if (status === 'checking') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingShell}>
          <BrandHeader />
          <View style={styles.loadingCard}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={styles.copy}>Sprawdzam zapamiętaną sesję...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  function changeMode(nextMode: 'login' | 'register') {
    setError(null);
    setNotice(null);
    setMode(nextMode);
  }

  function updateLoginField(field: LoginField, value: string) {
    setLoginValues((current) => ({ ...current, [field]: value }));
    setLoginErrors((current) => ({ ...current, [field]: undefined }));
    setError(null);
  }

  function updateRegisterField(field: RegisterField, value: string) {
    setRegisterValues((current) => ({ ...current, [field]: value }));
    setRegisterErrors((current) => ({ ...current, [field]: undefined }));
    setError(null);
  }

  function updateHouseholdField(field: HouseholdField, value: string) {
    setHouseholdValues((current) => ({ ...current, [field]: value }));
    setHouseholdErrors((current) => ({ ...current, [field]: undefined }));
    setError(null);
  }

  function updateResetField(field: ResetRequestField, value: string) {
    setResetValues((current) => ({ ...current, [field]: value }));
    setResetErrors((current) => ({ ...current, [field]: undefined }));
    setResetNotice(null);
  }

  function updateNewPasswordField(field: ResetPasswordField, value: string) {
    setNewPasswordValues((current) => ({ ...current, [field]: value }));
    setNewPasswordErrors((current) => ({ ...current, [field]: undefined }));
    setResetNotice(null);
  }

  async function submitLogin() {
    const parsed = loginSchema.safeParse(loginValues);

    if (!parsed.success) {
      setLoginErrors(toFieldErrors<LoginField>(parsed.error));
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await signIn(parsed.data, { remember: rememberMe });
    } catch (submitError) {
      setError(getMessage(submitError));
    } finally {
      setLoading(false);
    }
  }

  async function submitRegister() {
    const parsed = registerSchema.safeParse(registerValues);

    if (!parsed.success) {
      setRegisterErrors(toFieldErrors<RegisterField>(parsed.error));
      return;
    }

    if (!acceptedTerms || !acceptedPrivacy) {
      setError('Zaakceptuj regulamin oraz politykę prywatności, aby założyć konto.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await registerAndSignIn(parsed.data, { remember: rememberMe });
    } catch (submitError) {
      const message = getMessage(submitError);

      if (message.startsWith('Konto utworzone.')) {
        setNotice(message);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function submitResendVerification() {
    const parsed = resetRequestSchema.safeParse({ email: registerValues.email });

    if (!parsed.success) {
      setRegisterErrors((current) => ({ ...current, email: 'Podaj poprawny e-mail' }));
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await resendVerification(parsed.data);

      if (response.devVerificationToken) {
        await verifyEmail({
          email: parsed.data.email,
          token: response.devVerificationToken
        });
        setMode('login');
        setLoginValues((current) => ({ ...current, email: parsed.data.email }));
        setNotice('Konto zostało potwierdzone. Możesz się zalogować.');
      } else {
        setNotice('Wysłaliśmy nowy link weryfikacyjny, jeśli konto czeka na potwierdzenie.');
      }
    } catch (submitError) {
      setError(getMessage(submitError));
    } finally {
      setLoading(false);
    }
  }

  async function submitHousehold() {
    const parsed = householdSchema.safeParse(householdValues);

    if (!parsed.success) {
      setHouseholdErrors(toFieldErrors<HouseholdField>(parsed.error));
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await createFirstHousehold({ currencyCode: 'PLN', mealSlotsPerDay: 3, name: parsed.data.name });
    } catch (submitError) {
      setError(getMessage(submitError));
    } finally {
      setLoading(false);
    }
  }

  async function submitResetRequest() {
    const parsed = resetRequestSchema.safeParse(resetValues);

    if (!parsed.success) {
      setResetErrors(toFieldErrors<ResetRequestField>(parsed.error));
      return;
    }

    setLoading(true);
    setResetNotice(null);

    try {
      const response = await forgotPassword(parsed.data);
      setNewPasswordValues((current) => ({ ...current, token: response.devResetToken ?? '' }));
      setResetNotice('Jeśli konto istnieje, wysłaliśmy instrukcję resetu hasła.');
    } catch (submitError) {
      setResetNotice(getMessage(submitError));
    } finally {
      setLoading(false);
    }
  }

  async function submitNewPassword() {
    const parsed = resetPasswordSchema.safeParse(newPasswordValues);

    if (!parsed.success) {
      setNewPasswordErrors(toFieldErrors<ResetPasswordField>(parsed.error));
      return;
    }

    setLoading(true);
    setResetNotice(null);

    try {
      await resetPassword(parsed.data);
      setResetVisible(false);
      setNotice('Hasło zostało zmienione. Możesz się zalogować.');
      setLoginValues((current) => ({ ...current, email: resetValues.email }));
    } catch (submitError) {
      setResetNotice(getMessage(submitError));
    } finally {
      setLoading(false);
    }
  }

  function submitSocial(provider: 'Apple' | 'Google') {
    if (provider === 'Apple') {
      setNotice('Przycisk Apple jest przygotowany w UI. Pełne logowanie wymaga konfiguracji Apple OAuth.');
      return;
    }

    if (!googleOAuthConfig.androidClientId && !googleOAuthConfig.iosClientId && !googleOAuthConfig.webClientId) {
      setNotice('Google OAuth wymaga skonfigurowanego client ID w env/EAS.');
      return;
    }

    if (!googleRequest) {
      setNotice('Google OAuth jeszcze sie inicjalizuje. Sprobuj ponownie za chwile.');
      return;
    }

    void promptGoogleAsync();
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.shell}>
            <BrandHeader />

            <View style={styles.panel}>
              {status === 'needs-household' ? (
                <View style={styles.form}>
                  <View style={styles.formHeader}>
                    <Text style={styles.eyebrow}>Pierwszy krok</Text>
                    <Text style={styles.heading}>Utwórz dom</Text>
                    <Text style={styles.copy}>Nazwę zawsze można później zmienić w ustawieniach.</Text>
                  </View>
                  <AuthTextField
                    autoCapitalize="words"
                    autoComplete="name"
                    error={householdErrors.name}
                    label="Nazwa domu"
                    onChangeText={(value) => updateHouseholdField('name', value)}
                    returnKeyType="done"
                    value={householdValues.name}
                  />
                  {error ? <Banner message={error} tone="error" /> : null}
                  <ActionButton
                    loading={loading}
                    onPress={submitHousehold}
                    style={styles.submitButton}
                    title="Przejdź do aplikacji"
                  />
                </View>
              ) : (
                <View style={styles.form}>
                  <SegmentedControl
                    onChange={changeMode}
                    options={[
                      { label: 'Logowanie', value: 'login' },
                      { label: 'Rejestracja', value: 'register' }
                    ]}
                    value={mode}
                  />

                  {mode === 'login' ? (
                    <>
                      <FormTitle
                        icon={<LogIn color={theme.colors.primary} size={18} />}
                        subtitle="Wprowadź swoje dane, aby wejść do domu."
                        title="Witaj ponownie"
                      />
                      <AuthTextField
                        autoComplete="email"
                        error={loginErrors.email}
                        keyboardType="email-address"
                        label="Adres e-mail"
                        onChangeText={(value) => updateLoginField('email', value)}
                        placeholder="jan.kowalski@example.com"
                        returnKeyType="next"
                        textContentType="emailAddress"
                        value={loginValues.email}
                      />
                      <AuthTextField
                        autoComplete="password"
                        error={loginErrors.password}
                        label="Hasło"
                        onChangeText={(value) => updateLoginField('password', value)}
                        placeholder="Minimum 8 znaków"
                        returnKeyType="done"
                        rightElement={
                          <IconTap onPress={() => setShowLoginPassword((current) => !current)}>
                            {showLoginPassword ? (
                              <EyeOff color={theme.colors.textMuted} size={18} />
                            ) : (
                              <Eye color={theme.colors.textMuted} size={18} />
                            )}
                          </IconTap>
                        }
                        secureTextEntry={!showLoginPassword}
                        textContentType="password"
                        value={loginValues.password}
                      />
                      <View style={styles.inlineBetween}>
                        <Checkbox
                          checked={rememberMe}
                          label="Zapamiętaj mnie na tym urządzeniu"
                          onPress={() => setRememberMe((current) => !current)}
                        />
                        <Pressable
                          onPress={() => {
                            setResetValues((current) => ({ ...current, email: loginValues.email || current.email }));
                            setResetVisible(true);
                          }}
                        >
                          <Text style={styles.link}>Zapomniałeś?</Text>
                        </Pressable>
                      </View>
                      {error ? <Banner message={error} tone="error" /> : null}
                      {notice ? <Banner message={notice} tone="info" /> : null}
                      <ActionButton
                        loading={loading}
                        onPress={submitLogin}
                        style={styles.submitButton}
                        title="Wejdź"
                      />
                    </>
                  ) : (
                    <>
                      <FormTitle
                        icon={<UserPlus color={theme.colors.primary} size={18} />}
                        subtitle="Po rejestracji wyślemy link do potwierdzenia adresu e-mail."
                        title="Załóż konto"
                      />
                      <AuthTextField
                        autoCapitalize="words"
                        autoComplete="name"
                        error={registerErrors.displayName}
                        label="Imię"
                        onChangeText={(value) => updateRegisterField('displayName', value)}
                        placeholder="Jak mamy się zwracać?"
                        returnKeyType="next"
                        textContentType="name"
                        value={registerValues.displayName}
                      />
                      <AuthTextField
                        autoComplete="email"
                        error={registerErrors.email}
                        keyboardType="email-address"
                        label="Adres e-mail"
                        onChangeText={(value) => updateRegisterField('email', value)}
                        placeholder="adres@email.pl"
                        returnKeyType="next"
                        textContentType="emailAddress"
                        value={registerValues.email}
                      />
                      <AuthTextField
                        autoComplete="new-password"
                        error={registerErrors.password}
                        label="Hasło"
                        onChangeText={(value) => updateRegisterField('password', value)}
                        placeholder="Minimum 8 znaków"
                        returnKeyType="done"
                        rightElement={
                          <IconTap onPress={() => setShowRegisterPassword((current) => !current)}>
                            {showRegisterPassword ? (
                              <EyeOff color={theme.colors.textMuted} size={18} />
                            ) : (
                              <Eye color={theme.colors.textMuted} size={18} />
                            )}
                          </IconTap>
                        }
                        secureTextEntry={!showRegisterPassword}
                        textContentType="newPassword"
                        value={registerValues.password}
                      />
                      <PasswordStrength value={registerValues.password} />
                      <View style={styles.legalBox}>
                        <Checkbox
                          checked={acceptedTerms}
                          label="Akceptuję regulamin"
                          onPress={() => setAcceptedTerms((current) => !current)}
                        />
                        <Pressable onPress={() => setLegalDocument('terms')}>
                          <Text style={styles.link}>Podgląd regulaminu</Text>
                        </Pressable>
                        <Checkbox
                          checked={acceptedPrivacy}
                          label="Akceptuję politykę prywatności"
                          onPress={() => setAcceptedPrivacy((current) => !current)}
                        />
                        <Pressable onPress={() => setLegalDocument('privacy')}>
                          <Text style={styles.link}>Podgląd polityki</Text>
                        </Pressable>
                      </View>
                      <Checkbox
                        checked={rememberMe}
                        label="Zapamiętaj sesję po rejestracji"
                        onPress={() => setRememberMe((current) => !current)}
                      />
                      {error ? <Banner message={error} tone="error" /> : null}
                      {notice ? <Banner message={notice} tone="info" /> : null}
                      <ActionButton
                        loading={loading}
                        onPress={submitRegister}
                        style={styles.submitButton}
                        title="Utwórz konto"
                      />
                      <ActionButton
                        disabled={loading}
                        onPress={submitResendVerification}
                        title="Wyślij ponownie link"
                        variant="secondary"
                      />
                    </>
                  )}

                  <SocialDivider />
                  <View style={styles.socialRow}>
                    <SocialButton icon={<Google color="#DB4437" size={18} />} label="Google" onPress={() => submitSocial('Google')} />
                    <SocialButton
                      disabled
                      icon={<Apple color={theme.colors.textSubtle} size={18} />}
                      label="Apple"
                      onPress={() => submitSocial('Apple')}
                    />
                  </View>
                  <Text style={styles.legalSmall}>
                    Logując się, akceptujesz{' '}
                    <Text onPress={() => setLegalDocument('terms')} style={styles.legalSmallLink}>
                      Regulamin
                    </Text>{' '}
                    oraz{' '}
                    <Text onPress={() => setLegalDocument('privacy')} style={styles.legalSmallLink}>
                      Politykę prywatności
                    </Text>
                    .
                  </Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <LegalModal document={legalDocument} onClose={() => setLegalDocument(null)} />
      <ResetPasswordModal
        errors={resetErrors}
        loading={loading}
        newPasswordErrors={newPasswordErrors}
        newPasswordValues={newPasswordValues}
        notice={resetNotice}
        onClose={() => setResetVisible(false)}
        onRequestReset={submitResetRequest}
        onResetPassword={submitNewPassword}
        onUpdateNewPassword={updateNewPasswordField}
        onUpdateRequest={updateResetField}
        requestValues={resetValues}
        setShowPassword={setShowResetPassword}
        showPassword={showResetPassword}
        visible={resetVisible}
      />
    </SafeAreaView>
  );

  function BrandHeader() {
    return (
      <View style={styles.brandBar}>
        <View style={styles.brandIcon}>
          <Home color={theme.colors.inverseText} size={26} />
        </View>
        <Text style={styles.brand}>HomeApp</Text>
        <Text style={styles.subtitle}>Domowy panel operacyjny</Text>
      </View>
    );
  }

  function FormTitle({
    icon,
    subtitle,
    title
  }: {
    icon: ReactNode;
    subtitle?: string;
    title: string;
  }) {
    return (
      <View style={styles.formTitleWrap}>
        <View style={styles.formTitle}>
          <View style={styles.titleIcon}>{icon}</View>
          <Text style={styles.heading}>{title}</Text>
        </View>
        {subtitle ? <Text style={styles.copy}>{subtitle}</Text> : null}
      </View>
    );
  }

  function Banner({ message, tone }: { message: string; tone: 'error' | 'info' }) {
    return (
      <View style={[styles.banner, tone === 'error' ? styles.errorBox : styles.infoBox]}>
        <Text style={[styles.bannerText, tone === 'error' ? styles.error : styles.infoText]}>{message}</Text>
      </View>
    );
  }

  function Checkbox({ checked, label, onPress }: { checked: boolean; label: string; onPress: () => void }) {
    return (
      <Pressable onPress={onPress} style={styles.checkboxRow}>
        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
          {checked ? <Check color={theme.colors.inverseText} size={13} /> : null}
        </View>
        <Text style={styles.checkboxLabel}>{label}</Text>
      </Pressable>
    );
  }

  function PasswordStrength({ value }: { value: string }) {
    const result = getPasswordStrength(value);

    return (
      <View style={styles.strengthRoot}>
        <View style={styles.strengthBars}>
          {[0, 1, 2, 3].map((item) => (
            <View
              key={item}
              style={[
                styles.strengthBar,
                item < result.score && { backgroundColor: result.color }
              ]}
            />
          ))}
        </View>
        <Text style={styles.strengthText}>{result.label}</Text>
      </View>
    );
  }

  function SocialDivider() {
    return (
      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>LUB KONTYNUUJ PRZEZ</Text>
        <View style={styles.divider} />
      </View>
    );
  }

  function SocialButton({
    disabled,
    icon,
    label,
    onPress
  }: {
    disabled?: boolean;
    icon: ReactNode;
    label: string;
    onPress: () => void;
  }) {
    return (
      <Pressable
        accessibilityState={{ disabled: Boolean(disabled) }}
        disabled={disabled}
        onPress={onPress}
        style={[styles.socialButton, disabled && styles.socialButtonDisabled]}
      >
        {icon}
        <Text style={[styles.socialLabel, disabled && styles.socialLabelDisabled]}>{label}</Text>
      </Pressable>
    );
  }

  function IconTap({ children, onPress }: { children: ReactNode; onPress: () => void }) {
    return (
      <Pressable onPress={onPress} style={styles.iconTap}>
        {children}
      </Pressable>
    );
  }

  function LegalModal({ document, onClose }: { document: LegalDocument | null; onClose: () => void }) {
    const title = document === 'privacy' ? 'Polityka prywatności' : 'Regulamin';

    return (
      <Modal animationType="fade" onRequestClose={onClose} transparent visible={Boolean(document)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{title}</Text>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.modalText}>
                To roboczy podgląd dokumentu dla MVP. Finalna treść prawna zostanie podmieniona przed wydaniem
                produkcyjnym. Aplikacja przechowuje dane domowe, finansowe i organizacyjne wyłącznie w ramach Twojego
                gospodarstwa domowego oraz zgodnie z rolami użytkowników.
              </Text>
              <Text style={styles.modalText}>
                Użytkownik odpowiada za poprawność danych wprowadzonych do aplikacji. Dostęp do domu, zaproszeń i
                uprawnień kontroluje właściciel gospodarstwa domowego.
              </Text>
            </ScrollView>
            <ActionButton onPress={onClose} title="Rozumiem" />
          </View>
        </View>
      </Modal>
    );
  }

  function ResetPasswordModal({
    errors,
    loading,
    newPasswordErrors,
    newPasswordValues,
    notice,
    onClose,
    onRequestReset,
    onResetPassword,
    onUpdateNewPassword,
    onUpdateRequest,
    requestValues,
    setShowPassword,
    showPassword,
    visible
  }: {
    errors: FieldErrors<ResetRequestField>;
    loading: boolean;
    newPasswordErrors: FieldErrors<ResetPasswordField>;
    newPasswordValues: ResetPasswordValues;
    notice: string | null;
    onClose: () => void;
    onRequestReset: () => void;
    onResetPassword: () => void;
    onUpdateNewPassword: (field: ResetPasswordField, value: string) => void;
    onUpdateRequest: (field: ResetRequestField, value: string) => void;
    requestValues: ResetRequestValues;
    setShowPassword: (updater: (current: boolean) => boolean) => void;
    showPassword: boolean;
    visible: boolean;
  }) {
    return (
      <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reset hasła</Text>
            <Text style={styles.modalText}>
              Wpisz e-mail konta. Jeśli konto istnieje, wyślemy instrukcję resetu hasła.
            </Text>
            <AuthTextField
              autoComplete="email"
              error={errors.email}
              keyboardType="email-address"
              label="Adres e-mail"
              onChangeText={(value) => onUpdateRequest('email', value)}
              placeholder="adres@email.pl"
              value={requestValues.email}
            />
            <ActionButton loading={loading} onPress={onRequestReset} title="Wyślij instrukcję" variant="secondary" />
            <AuthTextField
              error={newPasswordErrors.token}
              label="Token resetu"
              onChangeText={(value) => onUpdateNewPassword('token', value)}
              placeholder="Token z e-maila"
              value={newPasswordValues.token}
            />
            <AuthTextField
              error={newPasswordErrors.password}
              label="Nowe hasło"
              onChangeText={(value) => onUpdateNewPassword('password', value)}
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
              value={newPasswordValues.password}
            />
            <PasswordStrength value={newPasswordValues.password} />
            {notice ? <Banner message={notice} tone={notice.includes('Nie') ? 'error' : 'info'} /> : null}
            <View style={styles.modalActions}>
              <ActionButton onPress={onClose} title="Anuluj" variant="secondary" />
              <ActionButton loading={loading} onPress={onResetPassword} title="Zmień hasło" />
            </View>
          </View>
        </View>
      </Modal>
    );
  }
}

function toFieldErrors<TField extends string>(error: z.ZodError): FieldErrors<TField> {
  return error.issues.reduce<FieldErrors<TField>>((errors, issue) => {
    const field = issue.path[0];

    if (typeof field === 'string') {
      errors[field as TField] = issue.message;
    }

    return errors;
  }, {});
}

function getMessage(error: unknown): string {
  if (error instanceof ApiNetworkError || (error instanceof TypeError && error.message === 'Network request failed')) {
    return 'Nie mogę połączyć się z serwerem. Sprawdź połączenie z internetem i spróbuj ponownie.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Nie udało się wykonać akcji';
}

function parseAuthDeepLink(rawUrl: string): AuthDeepLinkAction | null {
  try {
    const parsed = new URL(rawUrl);
    const route = [parsed.host, parsed.pathname.replace(/^\/+/, '')]
      .filter(Boolean)
      .join('/');

    if (route.endsWith('reset-password')) {
      const token = parsed.searchParams.get('token')?.trim();

      return token ? { token, type: 'reset-password' } : null;
    }

    if (route.endsWith('verify-email')) {
      const email = parsed.searchParams.get('email')?.trim();
      const token = parsed.searchParams.get('token')?.trim();

      return email && token ? { email, token, type: 'verify-email' } : null;
    }
  } catch {
    return null;
  }

  return null;
}

type AuthDeepLinkAction =
  | {
      token: string;
      type: 'reset-password';
    }
  | {
      email: string;
      token: string;
      type: 'verify-email';
    };

function readGoogleOAuthConfig() {
  const extra = Constants.expoConfig?.extra as
    | {
        googleAndroidClientId?: string;
        googleIosClientId?: string;
        googleWebClientId?: string;
      }
    | undefined;

  return {
    androidClientId: normalizeOptionalValue(extra?.googleAndroidClientId),
    iosClientId: normalizeOptionalValue(extra?.googleIosClientId),
    webClientId: normalizeOptionalValue(extra?.googleWebClientId)
  };
}

function normalizeOptionalValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();

  return normalized ? normalized : undefined;
}

function getPasswordStrength(value: string) {
  const checks = [
    value.length >= 8,
    /[A-ZĄĆĘŁŃÓŚŹŻ]/.test(value) && /[a-ząćęłńóśźż]/.test(value),
    /\d/.test(value),
    /[^A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż0-9]/.test(value)
  ];
  const score = checks.filter(Boolean).length;

  if (!value) {
    return { color: '#DFE3E8', label: 'Wpisz hasło, aby zobaczyć siłę.', score: 0 };
  }

  if (score <= 1) {
    return { color: '#FF5630', label: 'Słabe hasło', score: Math.max(score, 1) };
  }

  if (score === 2) {
    return { color: '#FFAB00', label: 'Średnie hasło', score };
  }

  if (score === 3) {
    return { color: '#36B37E', label: 'Dobre hasło', score };
  }

  return { color: '#00AB55', label: 'Bardzo mocne hasło', score };
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    banner: {
      borderRadius: radii.control,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm
    },
    bannerText: {
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0,
      lineHeight: 19
    },
    brand: {
      color: colors.text,
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: 0
    },
    brandBar: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.xs
    },
    brandIcon: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 18,
      height: 64,
      justifyContent: 'center',
      width: 64
    },
    checkbox: {
      alignItems: 'center',
      borderColor: colors.border,
      borderRadius: 4,
      borderWidth: 1,
      height: 18,
      justifyContent: 'center',
      width: 18
    },
    checkboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary
    },
    checkboxLabel: {
      color: colors.textMuted,
      flex: 1,
      fontSize: 12,
      letterSpacing: 0,
      lineHeight: 17
    },
    checkboxRow: {
      alignItems: 'center',
      flexDirection: 'row',
      flexShrink: 1,
      gap: spacing.sm
    },
    copy: {
      color: colors.textMuted,
      fontSize: 14,
      letterSpacing: 0,
      lineHeight: 20
    },
    divider: {
      backgroundColor: colors.line,
      flex: 1,
      height: 1
    },
    dividerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm
    },
    dividerText: {
      color: colors.textSubtle,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0
    },
    error: {
      color: colors.danger
    },
    errorBox: {
      backgroundColor: '#FFF1F0',
      borderColor: '#FFDAD6'
    },
    eyebrow: {
      color: colors.primaryDark,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0,
      textTransform: 'uppercase'
    },
    fieldError: {
      color: colors.danger,
      fontSize: 12,
      letterSpacing: 0
    },
    fieldInput: {
      color: colors.text,
      flex: 1,
      fontSize: 15,
      letterSpacing: 0,
      minHeight: 48,
      paddingHorizontal: spacing.md
    },
    fieldInputError: {
      borderColor: colors.danger
    },
    fieldInputFocused: {
      borderColor: colors.primary
    },
    fieldInputWrap: {
      alignItems: 'center',
      backgroundColor: colors.field,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      flexDirection: 'row',
      minHeight: 50
    },
    fieldLabel: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0
    },
    fieldRight: {
      paddingRight: spacing.sm
    },
    fieldRoot: {
      gap: spacing.xs
    },
    form: {
      gap: spacing.md
    },
    formHeader: {
      gap: spacing.xs
    },
    formTitle: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.md
    },
    formTitleWrap: {
      gap: spacing.xs,
      marginBottom: spacing.xs
    },
    heading: {
      color: colors.text,
      fontSize: 25,
      fontWeight: '900',
      letterSpacing: 0
    },
    iconTap: {
      alignItems: 'center',
      height: 36,
      justifyContent: 'center',
      width: 36
    },
    infoBox: {
      backgroundColor: colors.softBlue,
      borderColor: colors.border
    },
    infoText: {
      color: colors.text
    },
    inlineBetween: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.md,
      justifyContent: 'space-between'
    },
    keyboardView: {
      flex: 1
    },
    loadingCard: {
      alignItems: 'center',
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      gap: spacing.md,
      padding: spacing.lg,
      width: '100%'
    },
    loadingShell: {
      alignSelf: 'center',
      flex: 1,
      gap: spacing.xl,
      justifyContent: 'center',
      maxWidth: 430,
      padding: spacing.lg,
      width: '100%'
    },
    legalBox: {
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.md
    },
    legalSmall: {
      color: colors.textMuted,
      fontSize: 11,
      letterSpacing: 0,
      lineHeight: 16,
      textAlign: 'center'
    },
    legalSmallLink: {
      color: colors.text,
      fontWeight: '800'
    },
    link: {
      color: colors.primaryDark,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0
    },
    modalActions: {
      flexDirection: 'row',
      gap: spacing.sm
    },
    modalBackdrop: {
      alignItems: 'center',
      backgroundColor: colors.backdrop,
      flex: 1,
      justifyContent: 'center',
      padding: spacing.lg
    },
    modalBody: {
      maxHeight: 220
    },
    modalCard: {
      backgroundColor: colors.overlay,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      gap: spacing.md,
      maxWidth: 430,
      padding: spacing.lg,
      width: '100%'
    },
    modalText: {
      color: colors.textMuted,
      fontSize: 13,
      letterSpacing: 0,
      lineHeight: 20
    },
    modalTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: 0
    },
    panel: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      padding: spacing.lg
    },
    safeArea: {
      backgroundColor: colors.background,
      flex: 1
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'flex-start',
      padding: spacing.lg,
      paddingBottom: spacing.xxl
    },
    shell: {
      alignSelf: 'center',
      gap: spacing.xl,
      maxWidth: 430,
      width: '100%'
    },
    socialButton: {
      alignItems: 'center',
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      flex: 1,
      flexDirection: 'row',
      gap: spacing.sm,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: spacing.md
    },
    socialButtonDisabled: {
      backgroundColor: colors.cardMuted,
      opacity: 0.56
    },
    socialLabel: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0
    },
    socialLabelDisabled: {
      color: colors.textSubtle
    },
    socialRow: {
      flexDirection: 'row',
      gap: spacing.sm
    },
    strengthBar: {
      backgroundColor: colors.border,
      borderRadius: 999,
      flex: 1,
      height: 5
    },
    strengthBars: {
      flexDirection: 'row',
      gap: spacing.xs
    },
    strengthRoot: {
      gap: spacing.xs
    },
    strengthText: {
      color: colors.textMuted,
      fontSize: 12,
      letterSpacing: 0
    },
    submitButton: {
      marginTop: spacing.xs,
      minHeight: 50
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 14,
      letterSpacing: 0,
      lineHeight: 20,
      textAlign: 'center'
    },
    titleIcon: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: radii.control,
      height: 42,
      justifyContent: 'center',
      width: 42
    }
  });
}

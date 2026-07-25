import type { EncryptableModuleKey } from "@homeapp/shared-types";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Keyboard, StyleSheet, Text, View } from "react-native";
import { spacing } from "../theme/tokens";
import { useAppTheme, type AppPalette } from "../theme/use-app-theme";
import { ActionButton, AuthTextField, InlineAlert, SectionCard } from "../ui";
import { Lock } from "../ui/icon";
import { useEncryption } from "./encryption-context";

interface EncryptionUnlockCardProps {
  modules: EncryptableModuleKey[];
}

export function EncryptionUnlockCard({ modules }: EncryptionUnlockCardProps) {
  const encryption = useEncryption();
  const queryClient = useQueryClient();
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);
  const encrypted = modules.some((module) => encryption.isModuleEnabled(module));

  if (!encrypted || encryption.lockState !== "locked") {
    return null;
  }

  async function refreshVisibleData() {
    await queryClient.invalidateQueries({ type: "active" });
  }

  async function unlockWithPassphrase() {
    if (!passphrase.trim()) {
      setError("Wpisz hasło szyfrujące.");
      return;
    }

    setError("");
    setIsUnlocking(true);

    try {
      await encryption.unlock(passphrase);
      Keyboard.dismiss();
      setPassphrase("");
      await refreshVisibleData();
    } catch {
      setError("Nie udało się odblokować danych. Sprawdź hasło szyfrujące i spróbuj ponownie.");
    } finally {
      setIsUnlocking(false);
    }
  }

  async function unlockWithBiometrics() {
    setError("");
    setIsUnlocking(true);

    try {
      await encryption.unlockWithBiometrics();
      await refreshVisibleData();
    } catch {
      setError("Nie udało się odblokować danych biometrią. Użyj hasła szyfrującego.");
    } finally {
      setIsUnlocking(false);
    }
  }

  return (
    <SectionCard
      icon={<Lock color={theme.colors.primary} size={22} />}
      subtitle="Automatyczne odblokowanie nie powiodło się."
      title="Dane są zablokowane"
    >
      <Text style={styles.copy}>
        Podaj hasło szyfrujące, aby odblokować wyświetlanie danych.
      </Text>
      <AuthTextField
        autoComplete="password"
        editable={!isUnlocking}
        label="Hasło szyfrujące"
        onChangeText={(value) => {
          setPassphrase(value);
          if (error) {
            setError("");
          }
        }}
        onSubmitEditing={() => void unlockWithPassphrase()}
        placeholder="Wpisz hasło szyfrujące"
        returnKeyType="done"
        secureTextEntry
        value={passphrase}
      />
      {error ? <InlineAlert text={error} tone="error" /> : null}
      <View style={styles.actions}>
        <ActionButton
          disabled={!passphrase.trim()}
          loading={isUnlocking}
          onPress={() => void unlockWithPassphrase()}
          style={styles.action}
          title="Odblokuj dane"
        />
        {encryption.biometricsEnabled && encryption.localKeyStored ? (
          <ActionButton
            disabled={isUnlocking}
            onPress={() => void unlockWithBiometrics()}
            style={styles.action}
            title="Użyj biometrii"
            variant="secondary"
          />
        ) : null}
      </View>
    </SectionCard>
  );
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    action: {
      flex: 1,
    },
    actions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    copy: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
  });
}

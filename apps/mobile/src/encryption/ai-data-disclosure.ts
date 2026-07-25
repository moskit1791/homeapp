import { Alert } from "react-native";

export function confirmSensitiveAiTransfer(encryptionEnabled: boolean): Promise<boolean> {
  if (!encryptionEnabled) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (accepted: boolean) => {
      if (!settled) {
        settled = true;
        resolve(accepted);
      }
    };

    Alert.alert(
      "Wysłać dane do AI?",
      "Udostępniasz dane wrażliwe, które próbujesz chronić szyfrowaniem. Na potrzeby tej funkcji zostaną odszyfrowane i wysłane do zewnętrznej usługi AI. Czy na pewno chcesz kontynuować?",
      [
        { onPress: () => finish(false), style: "cancel", text: "Anuluj" },
        { onPress: () => finish(true), text: "Odszyfruj i wyślij" },
      ],
      { cancelable: true, onDismiss: () => finish(false) },
    );
  });
}

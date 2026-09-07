import type { EncryptableModuleKey } from '@homeapp/shared-types';

// Szyfrowanie E2EE wymaga osobnego odblokowania klucza w przeglądarce.
// Do tego czasu endpointy zachowują zgodność z domami bez włączonego E2EE.
export function isRuntimeModuleEncrypted(_module: EncryptableModuleKey): boolean {
  return false;
}

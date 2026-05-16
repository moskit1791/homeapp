import { Redirect, useLocalSearchParams } from "expo-router";

export default function AuthLinkRedirectScreen() {
  const params = useLocalSearchParams<{
    action?: string | string[];
    token?: string | string[];
  }>();
  const action = normalizeParam(params.action);
  const token = normalizeParam(params.token);

  if (action === "reset-password" && token) {
    return <Redirect href={{ pathname: "/auth/reset-password", params: { token } } as never} />;
  }

  if ((action === "invitation" || action === "accept-invitation") && token) {
    return <Redirect href={{ pathname: "/auth/invitation", params: { token } } as never} />;
  }

  return <Redirect href={"/login" as never} />;
}

function normalizeParam(value: string | string[] | undefined): string {
  const normalized = Array.isArray(value) ? value.join("/") : value;

  return normalized?.trim() ?? "";
}

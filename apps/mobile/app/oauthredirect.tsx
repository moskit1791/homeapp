import { Redirect } from "expo-router";
import { useSession } from "../src/session/session-context";

export default function OAuthRedirectScreen() {
  const { status } = useSession();

  return <Redirect href={(status === "ready" ? "/(tabs)" : "/login") as never} />;
}

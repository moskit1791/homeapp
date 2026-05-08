import { Redirect } from "expo-router";

export default function AuthLinkRedirectScreen() {
  return <Redirect href={"/login" as never} />;
}

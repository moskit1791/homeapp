# HomeApp Codex instructions

Before production deploys, APK builds, OAuth work, or mobile release work, read the matching file in `docs` first.

- Production deploy: follow `docs/production-deploy.md`.
- Google OAuth: follow `docs/google-login-setup.md`; do not ask where the Android OAuth Client ID belongs.
- APK release builds: use `scripts/build-mobile-release-apk.cmd` or the exact short-workdir flow from `docs/production-deploy.md`.
- Never build or install a release APK without `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_ID`, or `-GoogleAndroidClientId`.
- Mobile validation before commit: run `pnpm.cmd --filter @homeapp/mobile typecheck` and `pnpm.cmd --filter @homeapp/mobile lint`.
- Full production deploy after commit: push `forgravity`, then SSH to `homeapp@192.168.100.246` with `C:\Users\moski\.ssh\homeapp_prod_ed25519`, pull in `/opt/homeapp`, rebuild Compose, and check `/api/health`.
- Keep secrets out of git. Production secrets live in `/opt/homeapp/.env`; local deployment notes with secrets must stay ignored.

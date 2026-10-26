# Release APK on a physical phone (no Expo Go, no PC needed at runtime)

**Shortcut:** `npm run phone` (repo root) runs `apps/mobile/scripts/install-phone.ps1`: checks the phone, prebuilds when
`app.json`/`package.json` changed, builds, installs with `-r`, opens the app. It forces Android Studio's JDK (the
system `JAVA_HOME` is Java 25, which Gradle rejects) and retries once with a fresh prebuild on a Gradle-version error.

```powershell
# one-off per shell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"; $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
cd apps/mobile
npx expo prebuild -p android --no-install     # only after app.json / native-dep changes (android/ is generated, gitignored)
npm run build:android:release                  # arm64 only; first build ~8 min, then ~1 min
adb install -r android/app/build/outputs/apk/release/app-release.apk   # -r keeps the phone's data
```
- Signed with the template debug keystore: fine for sideloading, and updates install over the old build as long as the same
  keystore is used. A Play Store release needs a real upload key (EAS credentials or a keystore in `android/` via a config plugin).
- `metro.config.js` switches the server root to the app folder **only for `export:embed`** (release bundling). Don't
  make that unconditional: it breaks the dev server (404 on the bundle).
- Unneeded permissions are stripped via `android.blockedPermissions` in `app.json`. Check new native deps for added permissions.
- Food tracking (ROADMAP 2.15) adds native modules `expo-camera` (barcodes + label photo) and
  `@react-native-ml-kit/text-recognition` (reads the nutrition-table photo on the phone), and the `CAMERA` permission.
  The `expo-camera` plugin is configured with `recordAudioAndroid: false`; `RECORD_AUDIO` stays in `blockedPermissions`.
  After the first build with them, check the merged manifest has `CAMERA` and no `RECORD_AUDIO`. Both modules need a
  prebuild (`npm run phone` does it when `app.json`/`package.json` change); they don't run in Expo Go.
- Icons/splash: `python apps/mobile/scripts/build-app-icons.py` → `assets/branding/`.

## Publishing an update (QR code in README)

The QR code in `README.md` / `docs/update-qr.png` points at
`https://github.com/chiefabs6-ops/Gym-Application-/releases/latest/download/gym-log.apk`, so it never changes:
each new GitHub release with an asset named exactly `gym-log.apk` becomes what it downloads.
1. Bump `expo.version` and `expo.android.versionCode` in `apps/mobile/app.json` (Android refuses an APK whose
   versionCode is lower than the installed one).
2. Prebuild + `npm run build:android:release`, then commit and push.
3. Create a GitHub release (tag `v<version>`) and upload `android/app/build/outputs/apk/release/app-release.apk`
   renamed to `gym-log.apk`.
- Always sign with the same keystore (the template debug keystore today). A different key means Android won't
  update over the old install, and the user would have to uninstall (losing data unless backed up).
- Windows: the NDK's bundled `ninja.exe` 1.10.2 can't handle paths over 260 chars (react-native-keyboard-controller
  hits this). `Sdk/cmake/3.22.1/bin/ninja.exe` was replaced with ninja 1.12.1 (old copy: `ninja-1.10.2.exe.bak`);
  reapply after reinstalling that CMake.

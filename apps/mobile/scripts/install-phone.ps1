# Build the release APK and install it over the app on the USB-connected phone (keeps its data).
# Run from anywhere:  npm run phone   (repo root)   or   .\apps\mobile\scripts\install-phone.ps1
# Flags: -Prebuild forces `expo prebuild`; -SkipBuild reinstalls the last APK; -NoLaunch skips opening the app.
# Handles the failures seen so far (see docs/release-apk.md):
#   - android/ missing or stale after app.json / native-dep changes  -> runs `expo prebuild` automatically
#   - "Minimum supported Gradle version is X"                         -> stops Gradle daemons, re-prebuilds, retries once
#   - system JAVA_HOME is Java 25 (Gradle fails with "> 25.0.4")     -> forces Android Studio's JDK
param([switch]$Prebuild, [switch]$SkipBuild, [switch]$NoLaunch)

# Not 'Stop': in Windows PowerShell 5.1 that turns any stderr line from gradle/adb into a fatal error.
$ErrorActionPreference = 'Continue'
$mobile = Split-Path -Parent $PSScriptRoot
$android = Join-Path $mobile 'android'
$apk = Join-Path $android 'app\build\outputs\apk\release\app-release.apk'
$stamp = Join-Path $android '.prebuild-stamp'
$log = Join-Path $env:TEMP 'gymlog-build.log'
$package = 'com.gymlog.app'

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Fail($msg) { Write-Host "`nFAILED: $msg" -ForegroundColor Red; exit 1 }

# --- environment ---------------------------------------------------------------
# Always Android Studio's bundled JDK: the system JAVA_HOME is Java 25, which this Gradle can't parse
# ("Error resolving plugin [id: 'com.facebook.react.settings'] > 25.0.4").
$jbr = 'C:\Program Files\Android\Android Studio\jbr'
if (Test-Path $jbr) { $env:JAVA_HOME = $jbr }
if (-not $env:ANDROID_HOME -or -not (Test-Path $env:ANDROID_HOME)) { $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk" }
if (-not (Test-Path $env:JAVA_HOME)) { Fail "JDK not found at $env:JAVA_HOME (install Android Studio or set JAVA_HOME)" }
$adb = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
if (-not (Test-Path $adb)) { $adb = 'adb' }

# --- phone connected? (checked first so a 5-minute build isn't wasted) ----------
Step 'Checking phone'
$devices = & $adb devices | Select-String '\tdevice$'
if (-not $devices) {
  & $adb devices
  Fail 'No phone found. Plug it in, unlock it and accept the "Allow USB debugging" prompt, then re-run.'
}
Write-Host "Phone: $(($devices[0] -split "`t")[0])"

# --- prebuild when native config changed ----------------------------------------
function Get-NativeHash {
  $files = 'app.json', 'package.json' | ForEach-Object { Join-Path $mobile $_ }
  # .NET directly, not Get-FileHash: `npm run phone` starts Windows PowerShell 5.1, which can't load that
  # cmdlet when launched from a PowerShell 7 terminal (inherited PSModulePath) -> empty hash, prebuild never detected.
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    ($files | ForEach-Object { [BitConverter]::ToString($sha.ComputeHash([IO.File]::ReadAllBytes($_))) -replace '-', '' }) -join ''
  } finally { $sha.Dispose() }
}
function Invoke-Prebuild {
  Step 'Regenerating android/ (expo prebuild)'
  Push-Location $mobile
  try {
    npx expo prebuild -p android --no-install
    if ($LASTEXITCODE -ne 0) { Fail 'expo prebuild failed (output above)' }
  } finally { Pop-Location }
  Set-Content -Path $stamp -Value (Get-NativeHash)
}

if (-not $SkipBuild) {
  $stale = -not (Test-Path $stamp) -or ((Get-Content $stamp -Raw).Trim() -ne (Get-NativeHash))
  if ($Prebuild -or -not (Test-Path $android) -or $stale) { Invoke-Prebuild }

  # --- build ---------------------------------------------------------------------
  function Invoke-Build {
    Step 'Building release APK (about 1 min when only JS changed, longer after prebuild)'
    Push-Location $android
    try {
      & .\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a *> $log
      return $LASTEXITCODE
    } finally { Pop-Location }
  }

  $code = Invoke-Build
  if ($code -ne 0 -and (Select-String -Path $log -Pattern 'Minimum supported Gradle version' -Quiet)) {
    Write-Host 'Gradle version mismatch: stopping Gradle daemons and regenerating android/, then retrying.' -ForegroundColor Yellow
    Push-Location $android; try { & .\gradlew.bat --stop | Out-Null } finally { Pop-Location }
    Invoke-Prebuild
    $code = Invoke-Build
  }
  if ($code -ne 0) {
    $lines = Get-Content $log
    $at = ($lines | Select-String 'What went wrong' | Select-Object -First 1).LineNumber
    if ($at) { $lines[($at - 1)..[Math]::Min($at + 12, $lines.Count - 1)] } else { $lines | Select-Object -Last 30 }
    Fail "build failed. Full log: $log"
  }
  Write-Host 'Build OK'
}

# --- install (-r = update in place, keeps the phone's workouts) -----------------
if (-not (Test-Path $apk)) { Fail "no APK at $apk (run without -SkipBuild)" }
Step 'Installing on phone (keeps data)'
$out = & $adb install -r $apk 2>&1 | Out-String
if ($out -notmatch 'Success') {
  Write-Host $out
  if ($out -match 'INSTALL_FAILED_UPDATE_INCOMPATIBLE') {
    Fail 'the APK is signed with a different key than the installed app. Do NOT uninstall (that deletes your data): make a backup in the app first.'
  }
  Fail 'adb install failed (output above)'
}
Write-Host 'Installed'

if (-not $NoLaunch) {
  & $adb shell monkey -p $package -c android.intent.category.LAUNCHER 1 *> $null
  Write-Host 'App opened on phone'
}
Write-Host "`nDone." -ForegroundColor Green

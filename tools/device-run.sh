#!/usr/bin/env bash
# Instalacja APK na emulatorze/telefonie i test gry (wywoływane w GitHub Actions).
set -u
OUT=device-out
mkdir -p "$OUT"
adb devices
adb shell getprop ro.build.version.release
adb shell settings put system screen_off_timeout 1800000 || true
adb shell svc power stayon true || true
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb logcat -c || true
node tools/device-test.mjs "$OUT"
rc=$?
adb logcat -d -v time Capacitor:V Capacitor/Console:V chromium:I AndroidRuntime:E '*:S' > "$OUT/logcat.txt" 2>&1 || true
exit $rc

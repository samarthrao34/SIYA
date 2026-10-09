#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SDK_ROOT="${ANDROID_HOME:-$HOME/.local/lib/android-sdk}"
JAVA_ROOT="${JAVA_HOME:-$HOME/.local/lib/jdk17-clean/usr/lib/jvm/java-17-openjdk}"
export JAVA_HOME="$JAVA_ROOT"
export PATH="$JAVA_ROOT/bin:$PATH"
BUILD_TOOLS_VERSION="${SIYA_BUILD_TOOLS_VERSION:-36.1.0}"
PLATFORM_VERSION="${SIYA_PLATFORM_VERSION:-android-36}"
TOOLS="$SDK_ROOT/build-tools/$BUILD_TOOLS_VERSION"
ANDROID_JAR="$SDK_ROOT/platforms/$PLATFORM_VERSION/android.jar"
MOBILE_DIR="$PROJECT_DIR/mobile"
SOURCE_DIR="$MOBILE_DIR/android"
OUTPUT_DIR="$MOBILE_DIR/build"
KEYSTORE="$MOBILE_DIR/siya-mobile.keystore"

for required in "$JAVA_ROOT/bin/javac" "$JAVA_ROOT/bin/jar" "$TOOLS/aapt2" "$TOOLS/d8" "$TOOLS/zipalign" "$TOOLS/apksigner" "$ANDROID_JAR"; do
  if [[ ! -x "$required" && ! -f "$required" ]]; then
    echo "Missing Android build dependency: $required" >&2
    exit 1
  fi
done

# Standalone web bundle (talks to Gemini directly, no server/index.ts involved) --
# packed into assets/www/ and served to the WebView over 127.0.0.1 by
# AssetServer.java. mediapipe/models power the on-device camera emotion
# detector (see mobileLiveSession.ts startCamera/sendCameraFrame) and are
# kept; they add ~37MB to the APK.
(cd "$PROJECT_DIR" && npm run build:mobile)
ASSETS_DIR="$SOURCE_DIR/assets"
rm -rf "$ASSETS_DIR"
mkdir -p "$ASSETS_DIR/www"
cp -r "$MOBILE_DIR/webapp-dist/." "$ASSETS_DIR/www/"

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR/compiled" "$OUTPUT_DIR/generated" "$OUTPUT_DIR/classes" "$OUTPUT_DIR/dex"

"$TOOLS/aapt2" compile --dir "$SOURCE_DIR/res" -o "$OUTPUT_DIR/compiled/resources.zip"
"$TOOLS/aapt2" link \
  -I "$ANDROID_JAR" \
  --manifest "$SOURCE_DIR/AndroidManifest.xml" \
  --java "$OUTPUT_DIR/generated" \
  -A "$ASSETS_DIR" \
  --min-sdk-version 29 \
  --target-sdk-version 36 \
  --version-code 6 \
  --version-name 1.5 \
  -o "$OUTPUT_DIR/siya-unsigned.apk" \
  "$OUTPUT_DIR/compiled/resources.zip"

"$JAVA_ROOT/bin/javac" \
  -source 8 -target 8 \
  -bootclasspath "$ANDROID_JAR" \
  -d "$OUTPUT_DIR/classes" \
  "$SOURCE_DIR/src/com/siya/mobile/MainActivity.java" \
  "$SOURCE_DIR/src/com/siya/mobile/AssetServer.java" \
  "$OUTPUT_DIR/generated/com/siya/mobile/R.java"

"$JAVA_ROOT/bin/jar" cf "$OUTPUT_DIR/classes.jar" -C "$OUTPUT_DIR/classes" .
"$TOOLS/d8" --lib "$ANDROID_JAR" --min-api 29 --output "$OUTPUT_DIR/dex" "$OUTPUT_DIR/classes.jar"
(cd "$OUTPUT_DIR/dex" && "$JAVA_ROOT/bin/jar" uf "$OUTPUT_DIR/siya-unsigned.apk" classes.dex)
"$TOOLS/zipalign" -f 4 "$OUTPUT_DIR/siya-unsigned.apk" "$OUTPUT_DIR/siya-aligned.apk"

if [[ ! -f "$KEYSTORE" ]]; then
  "$JAVA_ROOT/bin/keytool" -genkeypair -noprompt \
    -keystore "$KEYSTORE" -storepass siya-local -keypass siya-local \
    -alias siya-mobile -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=SIYA Local Mobile, O=SIYA"
fi

"$TOOLS/apksigner" sign \
  --ks "$KEYSTORE" --ks-pass pass:siya-local --key-pass pass:siya-local \
  --out "$OUTPUT_DIR/siya-mobile.apk" "$OUTPUT_DIR/siya-aligned.apk"
"$TOOLS/apksigner" verify --verbose "$OUTPUT_DIR/siya-mobile.apk"
echo "$OUTPUT_DIR/siya-mobile.apk"

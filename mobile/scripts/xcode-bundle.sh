#!/bin/sh
set -e
# Runs inside React Native's with-environment wrapper, which supplies NODE_BINARY.
if [ "$CONFIGURATION" = "Release" ]; then
  "$NODE_BINARY" "$SRCROOT/../scripts/validate-release-config.cjs"
fi
/bin/sh "$REACT_NATIVE_PATH/scripts/react-native-xcode.sh"

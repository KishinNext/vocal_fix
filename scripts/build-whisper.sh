#!/bin/sh
# Builds the whisper.cpp CLI that whisper-node shells out to.
# On macOS, prefer Xcode's own SDK: a newer Command Line Tools SDK can use
# architectures Xcode's linker doesn't know yet ("unknown architecture arm64e.x1").
set -e
cd "$(dirname "$0")/../node_modules/whisper-node/lib/whisper.cpp"

if [ "$(uname)" = "Darwin" ]; then
  XCODE_SDK="$(xcode-select -p)/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk"
  if [ -d "$XCODE_SDK" ]; then
    export SDKROOT="$XCODE_SDK"
  fi
fi

make main

#!/bin/sh
set -eu
source_config="$SRCROOT/App/mea_config"
target_config="$TARGET_BUILD_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH/mea_config"
if [ -s "$source_config" ]; then
    mkdir -p "$(dirname "$target_config")"
    cp "$source_config" "$target_config"
else
    # Remove a stale bundle resource when switching to a local stub build.
    rm -f "$target_config"
    case " ${SWIFT_ACTIVE_COMPILATION_CONDITIONS:-} " in
        *" PEANUT_REQUIRE_PUSH_PROVISIONING "*)
            echo "error: Non-empty MeaWallet config is required for production releases" >&2
            exit 1
            ;;
    esac
fi

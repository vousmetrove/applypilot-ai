#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/.." && pwd)"
archive="${project_root}/public/applypilot-browser-assistant.zip"

command -v zip >/dev/null 2>&1 || {
  echo "extension:package requires the zip command." >&2
  exit 69
}
command -v unzip >/dev/null 2>&1 || {
  echo "extension:package requires the unzip command." >&2
  exit 69
}

cd "${project_root}"
zip -q -r -FS "${archive}" extension -x "*/.DS_Store"
unzip -t "${archive}"

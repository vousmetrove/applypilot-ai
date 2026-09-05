#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/.." && pwd)"
output_dir="${project_root}/outputs"
archive="${output_dir}/applypilot-ai-public-source.zip"
temp_dir="$(mktemp -d)"
snapshot_root="${temp_dir}/applypilot-ai"

cleanup() {
  rm -rf "${temp_dir}"
}
trap cleanup EXIT

command -v git >/dev/null 2>&1 || {
  echo "public:package requires git." >&2
  exit 69
}
command -v zip >/dev/null 2>&1 || {
  echo "public:package requires zip." >&2
  exit 69
}
command -v unzip >/dev/null 2>&1 || {
  echo "public:package requires unzip." >&2
  exit 69
}

mkdir -p "${snapshot_root}" "${output_dir}"
cd "${project_root}"

while IFS= read -r -d '' file; do
  [[ -f "${file}" ]] || continue
  mkdir -p "${snapshot_root}/$(dirname "${file}")"
  cp -p "${file}" "${snapshot_root}/${file}"
done < <(git ls-files -z --cached --others --exclude-standard)

rm -f "${archive}"
(
  cd "${temp_dir}"
  zip -q -r "${archive}" applypilot-ai
)
unzip -t "${archive}"
echo "Created ${archive}"

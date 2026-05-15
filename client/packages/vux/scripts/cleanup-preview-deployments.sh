#!/usr/bin/env bash
set -euo pipefail

# Helper to inactivate + delete GitHub deployments for a fork.
# No token is stored in this file.

OWNER="${OWNER:-mareszhar}"
REPO="${REPO:-instant}"
API_VERSION="${API_VERSION:-2022-11-28}"

if [[ -z "${GH_PAT:-}" ]]; then
  read -r -s -p "Enter GitHub token (fine-grained PAT with Deployments: write): " GH_PAT
  echo
fi

if [[ -z "${GH_PAT}" ]]; then
  echo "GH_PAT is empty. Aborting."
  exit 1
fi

if [[ $# -gt 0 ]]; then
  DEPLOYMENTS=("$@")
else
  echo "Fetching all deployments for ${OWNER}/${REPO}..."
  # Fetch deployments and extract IDs using jq
  DEPLOYMENTS_JSON=$(curl -sS \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer ${GH_PAT}" \
    -H "X-GitHub-Api-Version: ${API_VERSION}" \
    "https://api.github.com/repos/${OWNER}/${REPO}/deployments")
  
  DEPLOYMENTS=($(echo "$DEPLOYMENTS_JSON" | jq -r '.[].id'))
fi

if [[ ${#DEPLOYMENTS[@]} -eq 0 ]]; then
  echo "No deployments found to clean."
  exit 0
fi

echo "Repo: ${OWNER}/${REPO}"
echo "Deployments to clean: ${DEPLOYMENTS[*]}"
echo

echo "Step 1/2: mark deployments inactive"
for id in "${DEPLOYMENTS[@]}"; do
  echo "  - inactivating deployment ${id}"
  curl -sS -X POST \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer ${GH_PAT}" \
    -H "X-GitHub-Api-Version: ${API_VERSION}" \
    "https://api.github.com/repos/${OWNER}/${REPO}/deployments/${id}/statuses" \
    -d '{"state":"inactive","description":"Retired old preview deployment"}' >/dev/null
done

echo
echo "Step 2/2: delete deployments"
for id in "${DEPLOYMENTS[@]}"; do
  echo "  - deleting deployment ${id}"
  http_code="$(
    curl -sS -o /dev/null -w "%{http_code}" -X DELETE \
      -H "Accept: application/vnd.github+json" \
      -H "Authorization: Bearer ${GH_PAT}" \
      -H "X-GitHub-Api-Version: ${API_VERSION}" \
      "https://api.github.com/repos/${OWNER}/${REPO}/deployments/${id}"
  )"
  if [[ "${http_code}" != "204" ]]; then
    echo "    ! delete returned HTTP ${http_code} for deployment ${id}"
  else
    echo "    ✓ deleted ${id}"
  fi
done

echo
echo "Done. Refresh GitHub Deployments page."


#!/bin/sh
set -eu

escape_json() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

url="${SUPABASE_URL_LIGHT:-}"
key="${SUPABASE_KEY_LIGHT:-}"
google_key="${VITE_GOOGLE_API_KEY:-${GOOGLE_API_KEY:-}}"
config_error=""

case "$key" in
  sb_secret_*)
    config_error="SUPABASE_KEY_LIGHT no puede ser una llave secreta. Use la llave publishable o anon."
    key=""
    ;;
esac

if [ -n "$key" ] && [ "$(printf '%s' "$key" | awk -F. '{print NF}')" -eq 3 ]; then
  payload="$(printf '%s' "$key" | cut -d. -f2 | tr '_-' '/+')"
  remainder=$((${#payload} % 4))
  if [ "$remainder" -eq 2 ]; then payload="${payload}=="; fi
  if [ "$remainder" -eq 3 ]; then payload="${payload}="; fi
  decoded="$(printf '%s' "$payload" | base64 -d 2>/dev/null || true)"
  if printf '%s' "$decoded" | grep -Eq '"role"[[:space:]]*:[[:space:]]*"service_role"'; then
    config_error="SUPABASE_KEY_LIGHT contiene service_role y fue bloqueada para evitar exponerla."
    key=""
  fi
fi

cat > /usr/share/nginx/html/runtime-config.js <<EOF
window.__LIGHTHOUSE_CONFIG__ = {
  SUPABASE_URL: "$(escape_json "$url")",
  SUPABASE_KEY: "$(escape_json "$key")",
  GOOGLE_API_KEY: "$(escape_json "$google_key")",
  CONFIG_ERROR: "$(escape_json "$config_error")"
};
EOF

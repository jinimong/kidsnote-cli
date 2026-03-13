#!/usr/bin/env bash
set -euo pipefail

# kidsnote-cli 제거 스크립트
# 사용법: curl -fsSL https://raw.githubusercontent.com/jinimong/kidsnote-cli/main/uninstall.sh | bash
#   또는: ~/.kidsnote/uninstall.sh

INSTALL_DIR="$HOME/.kidsnote"
BIN_DIR="${KIDSNOTE_BIN:-$HOME/.local/bin}"

info()  { printf "\033[0;34m[정보]\033[0m  %s\n" "$1"; }
ok()    { printf "\033[0;32m[완료]\033[0m  %s\n" "$1"; }
warn()  { printf "\033[0;33m[경고]\033[0m  %s\n" "$1"; }

# 이전 버전(env-paths)이 사용하던 레거시 경로 탐지
detect_legacy_data_dir() {
  local svc="kidsnote-cli"
  case "$(uname -s)" in
    Darwin) echo "$HOME/Library/Application Support/${svc}-nodejs" ;;
    *)      echo "${XDG_DATA_HOME:-$HOME/.local/share}/${svc}-nodejs" ;;
  esac
}

detect_legacy_cache_dir() {
  local svc="kidsnote-cli"
  case "$(uname -s)" in
    Darwin) echo "$HOME/Library/Caches/${svc}-nodejs" ;;
    *)      echo "${XDG_CACHE_HOME:-$HOME/.cache}/${svc}-nodejs" ;;
  esac
}

detect_legacy_config_dir() {
  local svc="kidsnote-cli"
  case "$(uname -s)" in
    Darwin) echo "$HOME/Library/Preferences/${svc}-nodejs" ;;
    *)      echo "${XDG_CONFIG_HOME:-$HOME/.config}/${svc}-nodejs" ;;
  esac
}

# Playwright Chromium 삭제
remove_playwright_browsers() {
  info "Playwright 브라우저 삭제 중..."

  local pw_bin=""
  if [ -f "$INSTALL_DIR/node_modules/.bin/playwright" ]; then
    pw_bin="$INSTALL_DIR/node_modules/.bin/playwright"
  elif command -v npx >/dev/null 2>&1; then
    pw_bin="npx --yes playwright"
  fi

  if [ -n "$pw_bin" ]; then
    $pw_bin uninstall >/dev/null 2>&1 && \
      ok "Playwright 브라우저 삭제됨" || \
      warn "Playwright 브라우저 정리 중 문제 발생 (치명적이지 않음)"
  else
    warn "playwright uninstall 을 실행할 수 없습니다 — 직접 삭제하세요:"
    warn "  rm -rf ~/Library/Caches/ms-playwright  (macOS)"
    warn "  rm -rf ~/.cache/ms-playwright           (Linux)"
  fi
}

remove_from_shell_config() {
  local shell_configs=(
    "${ZDOTDIR:-$HOME}/.zshrc"
    "$HOME/.bashrc"
    "$HOME/.bash_profile"
    "$HOME/.profile"
    "$HOME/.config/fish/config.fish"
  )

  for config_file in "${shell_configs[@]}"; do
    [ -f "$config_file" ] || continue
    if grep -q "kidsnote-cli" "$config_file" 2>/dev/null; then
      local tmp_file
      tmp_file=$(mktemp)
      grep -v "kidsnote-cli" "$config_file" | sed -e :a -e '/^\n*$/{$d;N;ba' -e '}' > "$tmp_file"
      mv "$tmp_file" "$config_file"
      ok "$config_file 에서 PATH 설정 제거됨"
    fi
  done
}

# 이전 버전(env-paths) 레거시 데이터 정리
remove_legacy_paths() {
  info "이전 버전 데이터 경로 정리 중..."

  local legacy_data legacy_cache legacy_config
  legacy_data="$(detect_legacy_data_dir)"
  legacy_cache="$(detect_legacy_cache_dir)"
  legacy_config="$(detect_legacy_config_dir)"

  for dir in "$legacy_data" "$legacy_cache" "$legacy_config"; do
    if [ -d "$dir" ]; then
      rm -rf "$dir"
      ok "레거시 경로 삭제: $dir"
    fi
  done
}

main() {
  info "kidsnote-cli 제거 중..."
  echo ""

  local removed_something=false

  # 1) Playwright 브라우저 (INSTALL_DIR 삭제 전에 실행해야 함)
  if [ -d "$INSTALL_DIR/node_modules/playwright" ]; then
    remove_playwright_browsers
    removed_something=true
  fi

  # 2) BIN_DIR 심볼릭 링크
  if [ -L "$BIN_DIR/kidsnote" ] || [ -f "$BIN_DIR/kidsnote" ]; then
    rm -f "$BIN_DIR/kidsnote"
    ok "$BIN_DIR/kidsnote 삭제됨"
    removed_something=true
  fi

  # 3) 설치 디렉토리 (~/.kidsnote/ — 데이터, 캐시 포함)
  if [ -d "$INSTALL_DIR" ]; then
    rm -rf "$INSTALL_DIR"
    ok "$INSTALL_DIR 삭제됨 (소스, 데이터, 캐시 포함)"
    removed_something=true
  fi

  # 4) 이전 버전(env-paths) 레거시 경로 정리
  remove_legacy_paths

  # 5) 셸 설정 PATH 정리
  remove_from_shell_config

  echo ""
  if [ "$removed_something" = true ]; then
    ok "kidsnote-cli 가 완전히 제거되었습니다."
  else
    warn "삭제할 항목이 없습니다. kidsnote-cli 가 설치되어 있지 않은 것 같습니다."
  fi
}

main

#!/usr/bin/env bash
set -euo pipefail

# kidsnote-cli 설치 스크립트
# 사용법: curl -fsSL https://raw.githubusercontent.com/jinimong/kidsnote-cli/main/install.sh | bash

REPO_URL="${KIDSNOTE_REPO:-https://github.com/jinimong/kidsnote-cli.git}"
INSTALL_DIR="$HOME/.kidsnote"
BIN_DIR="${KIDSNOTE_BIN:-$HOME/.local/bin}"
BRANCH="main"

info()  { printf "\033[0;34m[정보]\033[0m  %s\n" "$1"; }
ok()    { printf "\033[0;32m[완료]\033[0m  %s\n" "$1"; }
warn()  { printf "\033[0;33m[경고]\033[0m  %s\n" "$1"; }
error() { printf "\033[0;31m[오류]\033[0m %s\n" "$1" >&2; exit 1; }

check_command() {
  command -v "$1" >/dev/null 2>&1 || error "$1 이(가) 필요하지만 설치되어 있지 않습니다. 먼저 설치해주세요."
}

check_node_version() {
  local version
  version=$(node --version | sed 's/v//')
  local major
  major=$(echo "$version" | cut -d. -f1)
  if [ "$major" -lt 18 ]; then
    error "Node.js v18 이상이 필요합니다 (현재 v$version)"
  fi
  ok "Node.js v$version"
}

add_to_path() {
  local config_file="$1"
  local export_line="export PATH=\"$BIN_DIR:\$PATH\""

  if grep -Fq "$BIN_DIR" "$config_file" 2>/dev/null; then
    return 0
  fi

  if [ -w "$config_file" ]; then
    printf '\n# kidsnote-cli\n%s\n' "$export_line" >> "$config_file"
    ok "$config_file 에 PATH 추가됨"
  else
    warn "$config_file 에 쓰기 권한이 없습니다"
    warn "직접 추가하세요: $export_line"
  fi
}

ensure_path() {
  if echo "$PATH" | tr ':' '\n' | grep -q "^${BIN_DIR}$"; then
    return 0
  fi

  local current_shell
  current_shell=$(basename "${SHELL:-bash}")

  case "$current_shell" in
    zsh)
      local target="${ZDOTDIR:-$HOME}/.zshrc"
      [ -f "$target" ] || target="$HOME/.zshrc"
      add_to_path "$target"
      ;;
    bash)
      local target="$HOME/.bashrc"
      [ -f "$target" ] || target="$HOME/.bash_profile"
      [ -f "$target" ] || target="$HOME/.profile"
      add_to_path "$target"
      ;;
    fish)
      local fish_config="$HOME/.config/fish/config.fish"
      if [ -f "$fish_config" ]; then
        if ! grep -Fq "$BIN_DIR" "$fish_config" 2>/dev/null; then
          printf '\n# kidsnote-cli\nfish_add_path %s\n' "$BIN_DIR" >> "$fish_config"
          ok "$fish_config 에 PATH 추가됨"
        fi
      fi
      ;;
    *)
      warn "$BIN_DIR 이(가) PATH에 등록되어 있지 않습니다"
      warn "셸 설정 파일에 다음을 추가하세요:"
      warn "  export PATH=\"$BIN_DIR:\$PATH\""
      ;;
  esac
}

main() {
  info "kidsnote-cli 설치 중..."

  check_command node
  check_command npm
  check_command git
  check_node_version

  if [ -d "$INSTALL_DIR" ]; then
    warn "기존 설치를 삭제합니다: $INSTALL_DIR"
    rm -rf "$INSTALL_DIR"
  fi

  info "저장소 클론 중..."
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR" 2>&1 | tail -1

  info "의존성 설치 및 빌드 중..."
  cd "$INSTALL_DIR"
  npm install --no-fund 2>&1 | tail -3

  if [ ! -f "$INSTALL_DIR/dist/cli.js" ]; then
    error "빌드 실패: dist/cli.js 를 찾을 수 없습니다"
  fi
  ok "빌드 성공"

  mkdir -p "$INSTALL_DIR/bin"
  cat > "$INSTALL_DIR/bin/kidsnote" << 'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail
INSTALL_DIR="$HOME/.kidsnote"
exec node "$INSTALL_DIR/dist/cli.js" "$@"
WRAPPER
  chmod +x "$INSTALL_DIR/bin/kidsnote"

  mkdir -p "$BIN_DIR"
  ln -sf "$INSTALL_DIR/bin/kidsnote" "$BIN_DIR/kidsnote"
  ok "심볼릭 링크 생성: kidsnote → $BIN_DIR/kidsnote"

  ensure_path

  if "$BIN_DIR/kidsnote" --version >/dev/null 2>&1; then
    local version
    version=$("$BIN_DIR/kidsnote" --version)
    ok "kidsnote v$version 설치 완료!"
  else
    error "설치 확인 실패"
  fi

  echo ""
  info "사용법:"
  echo "  kidsnote login                    # 대화형 로그인"
  echo "  kidsnote report --this-week       # 이번 주 알림장"
  echo "  kidsnote notice --this-week       # 이번 주 공지사항"
  echo ""
  info "제거:"
  echo "  curl -fsSL https://raw.githubusercontent.com/jinimong/kidsnote-cli/main/uninstall.sh | bash"
}

main

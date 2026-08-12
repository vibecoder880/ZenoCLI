#!/usr/bin/env sh
#
# ZenoCLI installer — macOS / Linux / WSL
#
# Downloads the latest release tarball for the host platform and installs
# the `zeno` binary into ~/.zenocli/bin, then symlinks it onto the PATH.
#
# Usage:
#   curl -fsSL https://github.com/vibecoder880/ZenoCLI/raw/khanh/scripts/install.sh | bash
#
# Environment:
#   ZENO_VERSION  pin a specific release tag (default: latest)
#   ZENO_PREFIX   install prefix (default: "$HOME/.zenocli")
#   ZENO_REPO     repository slug (default: vibecoder880/ZenoCLI)
#
set -eu

ZENO_REPO="${ZENO_REPO:-vibecoder880/ZenoCLI}"
ZENO_VERSION="${ZENO_VERSION:-latest}"
ZENO_PREFIX="${ZENO_PREFIX:-$HOME/.zenocli}"

log() { printf '\033[36m[zeno]\033[0m %s\n' "$*"; }
die() { printf '\033[31m[zeno] error:\033[0m %s\n' "$*" >&2; exit 1; }

# --- Resolve the OS/arch → canonical release platform ----------------------
case "$(uname -s)" in
  Darwin)
    case "$(uname -m)" in
      arm64) platform="macos-arm64" ;;
      x86_64) platform="macos-x64" ;;
      *) die "unsupported macOS arch: $(uname -m)" ;;
    esac
    ;;
  Linux)
    case "$(uname -m)" in
      x86_64) platform="linux-x64" ;;
      aarch64) platform="linux-arm64" ;;
      *) die "unsupported Linux arch: $(uname -m)" ;;
    esac
    ;;
  *)
    die "unsupported OS: $(uname -s)"
    ;;
esac

# --- Resolve the version to install ---------------------------------------
if [ "$ZENO_VERSION" = "latest" ]; then
  # GitHub API redirects GET releases/latest → the newest non-prerelease tag.
  version="$(
    curl -fsSL "https://api.github.com/repos/${ZENO_REPO}/releases/latest" |
      sed -n 's/^[[:space:]]*"tag_name":[[:space:]]*"\([^"]*\)".*/\1/p'
  )"
  [ -n "$version" ] || die "could not resolve the latest release for ${ZENO_REPO}"
else
  version="$ZENO_VERSION"
fi
# strip a leading "v" from the tag for artifact names
ver="${version#v}"
artifact="zeno-cli-${ver}-${platform}.tar.gz"
url="https://github.com/${ZENO_REPO}/releases/download/${version}/${artifact}"

log "ZenoCLI ${version} (${platform})"
log "download ${url}"

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

curl -fsSL "$url" -o "$tmpdir/$artifact" || die "download failed (is ${artifact} released for ${platform}?)"

bin_dir="$ZENO_PREFIX/bin"
mkdir -p "$bin_dir"

tar -xzf "$tmpdir/$artifact" -C "$tmpdir"
# the tarball contains the build root directory; walk to dist/bin
cp "$tmpdir"/zeno-cli-*/bin/zeno "$bin_dir/zeno"
chmod +x "$bin_dir/zeno"

log "installed to $bin_dir/zeno"

# --- Symlink onto the PATH ------------------------------------------------
case ":$PATH:" in
  *":$HOME/.local/bin:"*) ln -sf "$bin_dir/zeno" "$HOME/.local/bin/zeno" ;;
  *":/usr/local/bin:"*) ln -sf "$bin_dir/zeno" "/usr/local/bin/zeno" 2>/dev/null || true ;;
esac

if command -v zeno >/dev/null 2>&1; then
  log "zeno is on your PATH — run: zeno --help"
else
  log "done. Add ${bin_dir} to your PATH, then run: zeno --help"
fi

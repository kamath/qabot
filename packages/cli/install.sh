#!/bin/sh
set -e

# Flamecast CLI installer
# Usage: curl -fsSL https://raw.githubusercontent.com/smithery-ai/flamecast-mono/main/packages/cli/install.sh | sh

REPO="smithery-ai/flamecast-mono"
BINARY_NAME="flame"
INSTALL_DIR="${FLAMECAST_INSTALL_DIR:-/usr/local/bin}"

# Detect OS
OS="$(uname -s)"
case "$OS" in
	Linux)  OS="linux" ;;
	Darwin) OS="darwin" ;;
	*)      echo "Error: unsupported OS: $OS" >&2; exit 1 ;;
esac

# Detect architecture
ARCH="$(uname -m)"
case "$ARCH" in
	x86_64|amd64)  ARCH="x64" ;;
	aarch64|arm64) ARCH="arm64" ;;
	*)             echo "Error: unsupported architecture: $ARCH" >&2; exit 1 ;;
esac

ASSET_NAME="${BINARY_NAME}-${OS}-${ARCH}"

# Get latest CLI release tag
LATEST_TAG=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases" \
	| grep '"tag_name"' | grep 'cli-v' | head -1 | cut -d'"' -f4)

if [ -z "$LATEST_TAG" ]; then
	echo "Error: could not determine latest CLI release." >&2
	exit 1
fi

DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${LATEST_TAG}/${ASSET_NAME}"

echo "Downloading ${BINARY_NAME} ${LATEST_TAG} for ${OS}/${ARCH}..."
curl -fsSL -o "/tmp/${BINARY_NAME}" "$DOWNLOAD_URL"
chmod +x "/tmp/${BINARY_NAME}"

echo "Installing to ${INSTALL_DIR}/${BINARY_NAME}..."
if [ -w "$INSTALL_DIR" ]; then
	mv "/tmp/${BINARY_NAME}" "${INSTALL_DIR}/${BINARY_NAME}"
else
	sudo mv "/tmp/${BINARY_NAME}" "${INSTALL_DIR}/${BINARY_NAME}"
fi

echo "Done! Run '${BINARY_NAME} --version' to verify."


EXTENSION_NAME := rumdl
VERSION := $(shell node -p "require('./package.json').version")
PACKAGE_FILE := $(EXTENSION_NAME)-$(VERSION).vsix
DIST_DIR := dist
# Platform-specific VSIX targets published to the marketplaces.
VSIX_TARGETS := win32-x64 darwin-x64 darwin-arm64 linux-x64 linux-arm64 alpine-x64 alpine-arm64
# Extra args forwarded to vership (CI passes --skip-checks; check runs separately).
VERSHIP_ARGS ?=

.PHONY: help
help:
	@echo "Build & test:"
	@echo "  build               - Compile and bundle (webpack)"
	@echo "  check               - Release gate: lint + compile tests (headless)"
	@echo "  test                - Full suite: format check, lint, compile tests, vscode-test"
	@echo "  fmt                 - Format and auto-fix"
	@echo "Release (vership):"
	@echo "  release-patch       - Bump patch, changelog, tag, push"
	@echo "  release-minor       - Bump minor, changelog, tag, push"
	@echo "  release-major       - Bump major, changelog, tag, push"
	@echo "  changelog           - Preview the unreleased changelog"
	@echo "Bundled rumdl:"
	@echo "  set-rumdl-version RUMDL_VERSION=x.y.z - pin the bundled rumdl version"
	@echo "  schema              - Download current rumdl + sync the settings schema"
	@echo "Packaging & publishing (CI):"
	@echo "  package-target TARGET=<t> - build one platform VSIX into $(DIST_DIR)/"
	@echo "  package-all         - build every platform VSIX"
	@echo "  publish-marketplace - publish $(DIST_DIR)/*.vsix to the VS Code Marketplace"
	@echo "  publish-ovsx        - publish $(DIST_DIR)/*.vsix to Open VSX"
	@echo "  github-release      - create the GitHub release with $(DIST_DIR)/*.vsix"
	@echo "Local:"
	@echo "  package / install / setup / dev / clean / verify / status"

# ---------------------------------------------------------------------------
# Build & test
# ---------------------------------------------------------------------------
.PHONY: build
build:
	npm run compile

.PHONY: build-prod
build-prod:
	npm run package

# Headless release gate (no display required).
.PHONY: check
check:
	npm run lint
	npm run compile-tests

.PHONY: test
test:
	npm run format:check
	npm run lint
	npm run compile-tests
	npm test

.PHONY: lint
lint:
	npm run lint

.PHONY: fmt
fmt:
	npm run fmt

# ---------------------------------------------------------------------------
# Release orchestration (vership: bump + changelog + tag + push)
# ---------------------------------------------------------------------------
.PHONY: release-patch
release-patch:
	vership bump patch $(VERSHIP_ARGS)

.PHONY: release-minor
release-minor:
	vership bump minor $(VERSHIP_ARGS)

.PHONY: release-major
release-major:
	vership bump major $(VERSHIP_ARGS)

.PHONY: changelog
changelog:
	vership changelog

# ---------------------------------------------------------------------------
# Bundled rumdl binary
# ---------------------------------------------------------------------------
.PHONY: set-rumdl-version
set-rumdl-version:
	@test -n "$(RUMDL_VERSION)" || { echo "Usage: make set-rumdl-version RUMDL_VERSION=x.y.z"; exit 1; }
	node -e "const f='scripts/download-rumdl.js';const fs=require('fs');fs.writeFileSync(f, fs.readFileSync(f,'utf8').replace(/const RUMDL_VERSION = '[0-9.]*'/, \"const RUMDL_VERSION = '$(RUMDL_VERSION)'\"));"
	@echo "Bundled rumdl pinned to $(RUMDL_VERSION)"

.PHONY: schema
schema:
	npm run clean-rumdl
	npm run download-rumdl-current
	npm run sync-schema

# ---------------------------------------------------------------------------
# Packaging (per-platform VSIX -> $(DIST_DIR)/)
# ---------------------------------------------------------------------------
.PHONY: package-target
package-target:
	@test -n "$(TARGET)" || { echo "Usage: make package-target TARGET=<code-target>"; exit 1; }
	mkdir -p $(DIST_DIR)
	npm run clean-rumdl
	npm run download-rumdl-target -- $(TARGET)
	npx @vscode/vsce package --target $(TARGET) --out $(DIST_DIR)/$(EXTENSION_NAME)-$(VERSION)-$(TARGET).vsix

.PHONY: package-all
package-all:
	@for t in $(VSIX_TARGETS); do $(MAKE) --no-print-directory package-target TARGET=$$t; done

# ---------------------------------------------------------------------------
# Publishing
# ---------------------------------------------------------------------------
.PHONY: publish-marketplace
publish-marketplace:
	@test -n "$(VSCE_PAT)" || { echo "VSCE_PAT not set"; exit 1; }
	npx @vscode/vsce publish --packagePath $(DIST_DIR)/*.vsix --pat $(VSCE_PAT)

.PHONY: publish-ovsx
publish-ovsx:
	@test -n "$(OVSX_TOKEN)" || { echo "OVSX_TOKEN not set"; exit 1; }
	npx ovsx publish --packagePath $(DIST_DIR)/*.vsix -p $(OVSX_TOKEN)

# Builds release notes from the latest CHANGELOG.md section + a static install block.
.PHONY: github-release
github-release:
	@mkdir -p $(DIST_DIR)
	@awk '/^## \[/{n++; if (n==2) exit} n==1' CHANGELOG.md > $(DIST_DIR)/RELEASE_NOTES.md
	@printf '\n## Installation\n\n- **VS Code**: [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=rvben.rumdl)\n- **Cursor/VSCodium**: [Open VSX Registry](https://open-vsx.org/extension/rvben/rumdl)\n- **Manual**: download the platform-specific .vsix below (~5 MB each, vs ~25 MB for a universal package)\n' >> $(DIST_DIR)/RELEASE_NOTES.md
	gh release create v$(VERSION) $(DIST_DIR)/*.vsix --title v$(VERSION) --notes-file $(DIST_DIR)/RELEASE_NOTES.md

# ---------------------------------------------------------------------------
# Local packaging / install
# ---------------------------------------------------------------------------
.PHONY: package
package: clean build-prod
	npm run vsce:package
	@echo "Package created: $(PACKAGE_FILE)"

.PHONY: install
install: package
	code --install-extension $(PACKAGE_FILE)

# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------
.PHONY: clean
clean:
	rm -rf out/ node_modules/.cache/ $(DIST_DIR)/
	rm -f *.vsix

.PHONY: verify
verify:
	npm run verify-rumdl

.PHONY: download-rumdl
download-rumdl:
	npm run download-rumdl

.PHONY: status
status:
	@echo "Name:    $(EXTENSION_NAME)"
	@echo "Version: $(VERSION)"
	@echo "Package: $(PACKAGE_FILE)"
	@if [ -d "bundled-tools" ]; then \
		ls -la bundled-tools/ | grep -c rumdl- | xargs echo "rumdl binaries:"; \
		if [ -f "bundled-tools/version.json" ]; then \
			echo "rumdl version: $$(node -p "require('./bundled-tools/version.json').version")"; \
		fi \
	else \
		echo "rumdl binaries: not downloaded"; \
	fi

.PHONY: dev
dev:
	npm run watch

.PHONY: setup
setup:
	npm install
	npm run download-rumdl

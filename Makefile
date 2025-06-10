
EXTENSION_NAME := rumdl
VERSION := $(shell node -p "require('./package.json').version")
PACKAGE_FILE := $(EXTENSION_NAME)-$(VERSION).vsix

.PHONY: help
help:
	@echo "Available targets:"
	@echo "  build         - Compile TypeScript and bundle with webpack"
	@echo "  test          - Run tests and linting"
	@echo "  package       - Create .vsix package for distribution"
	@echo "  install       - Install extension locally for testing"
	@echo "  publish       - Publish to VS Code Marketplace"
	@echo "  release       - Full release process (test + package + publish)"
	@echo "  clean         - Clean build artifacts"
	@echo "  verify        - Verify bundled rumdl binaries"
	@echo "  bump-patch    - Bump patch version (0.0.1 -> 0.0.2)"
	@echo "  bump-minor    - Bump minor version (0.0.1 -> 0.1.0)"
	@echo "  bump-major    - Bump major version (0.0.1 -> 1.0.0)"

# Build targets
.PHONY: build
build:
	@echo "🔨 Building extension..."
	npm run compile

.PHONY: build-prod
build-prod:
	@echo "🔨 Building extension for production..."
	npm run package

# Testing and validation
.PHONY: test
test:
	@echo "🧪 Running tests..."
	npm run lint
	npm run compile-tests
	npm test

.PHONY: lint
lint:
	@echo "🔍 Running linter..."
	npm run lint

# Package creation
.PHONY: package
package: clean build-prod
	@echo "📦 Creating package $(PACKAGE_FILE)..."
	npm run vsce:package
	@echo "✅ Package created: $(PACKAGE_FILE)"

# Installation for local testing
.PHONY: install
install: package
	@echo "💾 Installing extension locally..."
	code --install-extension $(PACKAGE_FILE)
	@echo "✅ Extension installed locally"

# Publishing
.PHONY: publish
publish: package
	@echo "🚀 Publishing to VS Code Marketplace..."
	@if [ -z "$(VSCE_PAT)" ]; then \
		echo "❌ Error: VSCE_PAT environment variable not set"; \
		echo "   Please set your Visual Studio Marketplace Personal Access Token:"; \
		echo "   export VSCE_PAT=your_token_here"; \
		exit 1; \
	fi
	vsce publish --pat $(VSCE_PAT)
	@echo "✅ Published to VS Code Marketplace"

# Full release process
.PHONY: release
release: test package publish
	@echo "🎉 Release $(VERSION) completed successfully!"

# Version bumping
.PHONY: bump-patch
bump-patch:
	@echo "⬆️  Bumping patch version..."
	npm version patch --no-git-tag-version
	@echo "✅ Version bumped to $(shell node -p "require('./package.json').version")"

.PHONY: bump-minor
bump-minor:
	@echo "⬆️  Bumping minor version..."
	npm version minor --no-git-tag-version
	@echo "✅ Version bumped to $(shell node -p "require('./package.json').version")"

.PHONY: bump-major
bump-major:
	@echo "⬆️  Bumping major version..."
	npm version major --no-git-tag-version
	@echo "✅ Version bumped to $(shell node -p "require('./package.json').version")"

# Utility targets
.PHONY: clean
clean:
	@echo "🧹 Cleaning build artifacts..."
	rm -rf out/
	rm -rf node_modules/.cache/
	rm -f *.vsix
	@echo "✅ Clean completed"

.PHONY: verify
verify:
	@echo "🔍 Verifying bundled rumdl binaries..."
	npm run verify-rumdl

.PHONY: download-rumdl
download-rumdl:
	@echo "⬇️  Downloading latest rumdl binaries..."
	npm run download-rumdl

.PHONY: status
status:
	@echo "📊 Extension Status:"
	@echo "   Name: $(EXTENSION_NAME)"
	@echo "   Version: $(VERSION)"
	@echo "   Package: $(PACKAGE_FILE)"
	@echo "   rumdl binaries:"
	@if [ -d "bundled-tools" ]; then \
		ls -la bundled-tools/ | grep rumdl- | wc -l | xargs echo "     Count:"; \
		if [ -f "bundled-tools/version.json" ]; then \
			echo "     Version: $$(node -p "require('./bundled-tools/version.json').version")"; \
		fi \
	else \
		echo "     Not downloaded"; \
	fi

# Development helpers
.PHONY: dev
dev:
	@echo "🔄 Starting development mode..."
	npm run watch

.PHONY: setup
setup:
	@echo "⚙️  Setting up development environment..."
	npm install
	npm run download-rumdl
	@echo "✅ Setup completed"

# Git helpers (with safeguards)
.PHONY: tag
tag:
	@echo "🏷️  Creating git tag for version $(VERSION)..."
	@if git diff --quiet && git diff --cached --quiet; then \
		git tag -a "v$(VERSION)" -m "Release version $(VERSION)"; \
		echo "✅ Tag v$(VERSION) created"; \
		echo "   Push with: git push origin v$(VERSION)"; \
	else \
		echo "❌ Error: Working directory not clean. Commit changes first."; \
		exit 1; \
	fi

# Quick release with version bump
.PHONY: release-patch
release-patch: bump-patch tag release

.PHONY: release-minor
release-minor: bump-minor tag release

.PHONY: release-major
release-major: bump-major tag release
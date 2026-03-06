# Testing Setup Guide

## Problem

The project uses `better-sqlite3` which requires native compilation. Your system has:
- Node.js v24.12.0 (very new, no prebuilt binaries)
- Visual Studio 2026 Preview (v18) - not yet supported by node-gyp

## Solution: Use Node.js v20 LTS

Node v20 LTS has prebuilt binaries for better-sqlite3, avoiding compilation issues.

### Step 1: Install Node Version Manager (if not installed)

**Windows (nvm-windows)**:
1. Download from: https://github.com/coreybutler/nvm-windows/releases
2. Install `nvm-setup.exe`
3. Restart your terminal

### Step 2: Install and Use Node v20

```bash
# Install Node v20 LTS
nvm install 20

# Use Node v20
nvm use 20

# Verify version
node --version
# Should show v20.x.x
```

### Step 3: Clean and Reinstall Dependencies

```bash
# Remove existing node_modules and package-lock
rm -rf node_modules package-lock.json

# Remove .npmrc (it has settings for VS 2022 which aren't needed with Node v20)
rm .npmrc

# Install dependencies
npm install
```

### Step 4: Run Tests

```bash
# Run all tests
npm test

# Run only unit tests
cd apps/server
npm run test:unit

# Run only property tests
npm run test:property
```

## Alternative: Wait for VS 2026 Support

If you prefer to keep Node v24 and VS 2026:
1. Wait for node-gyp to add support for VS 2026
2. Or manually patch node-gyp to recognize VS version 18
3. This is not recommended as it's more complex

## Alternative: Use SQL.js (Pure JavaScript)

If you can't use Node v20, we could refactor to use `sql.js` (pure JavaScript SQLite):
- No compilation needed
- Slightly slower performance
- Requires code changes in database layer

Let me know if you'd like me to implement the sql.js alternative.

## Recommended: Node v20 LTS

**Node v20 is the recommended solution** because:
- ✅ Stable and well-supported
- ✅ Prebuilt binaries for better-sqlite3
- ✅ No compilation needed
- ✅ No code changes required
- ✅ Better ecosystem compatibility

After switching to Node v20, all tests should run without issues.

#!/bin/bash
#
# Local Directus Setup Script
#
# This script sets up a fresh local Directus instance with:
# - Schema applied from schema.json
# - Sample data imported from the production site
#
# Usage:
#   ./setup.sh              # Full setup with sample data
#   ./setup.sh --no-data    # Setup without importing data
#   ./setup.sh --reset      # Delete existing DB and start fresh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
IMPORT_DATA=true
RESET=false
for arg in "$@"; do
    case $arg in
        --no-data)
            IMPORT_DATA=false
            ;;
        --reset)
            RESET=true
            ;;
    esac
done

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Directus Local Setup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check Node.js version
echo -e "${YELLOW}Checking prerequisites...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 19 ]; then
    echo -e "${RED}Error: Node.js v19+ is required (found $(node -v))${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} Node.js $(node -v)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} npm $(npm -v)"

# Check for Python setuptools (needed for native module compilation on Python 3.12+)
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 -c 'import sys; print(sys.version_info.minor)')
    if [ "$PYTHON_VERSION" -ge 12 ]; then
        if ! python3 -c "import setuptools" 2>/dev/null; then
            echo -e "  ${YELLOW}!${NC} Python setuptools not found (needed for native modules)"
            echo -e "    Install with: ${BLUE}brew install python-setuptools${NC}"
        fi
    fi
fi

# Handle reset
if [ "$RESET" = true ]; then
    echo ""
    echo -e "${YELLOW}Resetting local database...${NC}"
    rm -f ./database/sqlite.db
    rm -rf ./uploads/*
    echo -e "  ${GREEN}✓${NC} Database and uploads cleared"
fi

# Create .env if it doesn't exist
echo ""
echo -e "${YELLOW}Setting up environment...${NC}"
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "  ${GREEN}✓${NC} Created .env from .env.example"
else
    echo -e "  ${GREEN}✓${NC} .env already exists"
fi

# Install dependencies
echo ""
echo -e "${YELLOW}Installing dependencies...${NC}"
if ! npm install 2>&1 | tee /tmp/npm-install.log | grep -qE "^npm error"; then
    echo -e "  ${GREEN}✓${NC} Main dependencies installed"
else
    # Check for common errors
    if grep -q "distutils" /tmp/npm-install.log; then
        echo -e "  ${RED}✗${NC} Native module compilation failed (missing distutils)"
        echo -e "    Fix: ${BLUE}brew install python-setuptools${NC}"
        exit 1
    elif grep -q "C++20" /tmp/npm-install.log; then
        echo -e "  ${RED}✗${NC} Native module compilation failed (C++20 required)"
        echo -e "    Your Node.js version may require updated native dependencies."
        echo -e "    Try adding 'overrides' to package.json for isolated-vm"
        exit 1
    else
        echo -e "  ${RED}✗${NC} npm install failed. Check /tmp/npm-install.log"
        exit 1
    fi
fi

# Build extensions
echo ""
echo -e "${YELLOW}Building extensions...${NC}"
EXTENSION_DIR="./extensions/directus-extension-programmierbar-bundle"
if [ -d "$EXTENSION_DIR" ]; then
    cd "$EXTENSION_DIR"
    npm install --silent 2>/dev/null || npm install
    npm run build 2>&1 | tail -3
    cd "$SCRIPT_DIR"
    echo -e "  ${GREEN}✓${NC} Extensions built"
else
    echo -e "  ${YELLOW}!${NC} Extension directory not found, skipping"
fi

# Check if this is a fresh database
DB_EXISTS=false
if [ -f "./database/sqlite.db" ]; then
    DB_EXISTS=true
fi

# Bootstrap Directus (only if DB doesn't exist)
echo ""
echo -e "${YELLOW}Bootstrapping Directus...${NC}"
if [ "$DB_EXISTS" = false ]; then
    npm run bootstrap 2>&1 | grep -E "INFO|WARN|ERROR" | head -10 || true
    echo -e "  ${GREEN}✓${NC} Database bootstrapped"
else
    echo -e "  ${GREEN}✓${NC} Database already exists"
fi

# Apply schema
echo ""
echo -e "${YELLOW}Applying schema...${NC}"
echo "y" | npm run apply-schema 2>&1 | grep -E "applied|Create|Update|Delete" | tail -5 || true
echo -e "  ${GREEN}✓${NC} Schema applied"

# Start Directus in background for setup
echo ""
echo -e "${YELLOW}Starting Directus temporarily for setup...${NC}"

# Find an available port or use default
PORT=${PORT:-8055}

# Start Directus in background
npm run start > /tmp/directus-setup.log 2>&1 &
DIRECTUS_PID=$!

# Wait for Directus to be ready
echo -n "  Waiting for Directus to start"
MAX_WAIT=60
WAITED=0
while ! curl -s "http://localhost:$PORT/server/health" > /dev/null 2>&1; do
    if [ $WAITED -ge $MAX_WAIT ]; then
        echo ""
        echo -e "${RED}Error: Directus failed to start within ${MAX_WAIT}s${NC}"
        echo "Check /tmp/directus-setup.log for details"
        kill $DIRECTUS_PID 2>/dev/null || true
        exit 1
    fi
    # Check if process died
    if ! kill -0 $DIRECTUS_PID 2>/dev/null; then
        echo ""
        echo -e "${RED}Error: Directus process died unexpectedly${NC}"
        cat /tmp/directus-setup.log | tail -20
        exit 1
    fi
    echo -n "."
    sleep 1
    WAITED=$((WAITED + 1))
done
echo ""
echo -e "  ${GREEN}✓${NC} Directus is running on http://localhost:$PORT"

# Run setup-local script
echo ""
echo -e "${YELLOW}Setting up local environment...${NC}"
if [ "$IMPORT_DATA" = true ]; then
    node ./utils/setup-local.mjs --import-data
else
    node ./utils/setup-local.mjs
fi

# Stop the temporary Directus instance
echo ""
echo -e "${YELLOW}Stopping temporary Directus instance...${NC}"
kill $DIRECTUS_PID 2>/dev/null || true
wait $DIRECTUS_PID 2>/dev/null || true
echo -e "  ${GREEN}✓${NC} Stopped"

# Done
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "To start Directus:"
echo -e "  ${BLUE}cd directus-cms && npm run start${NC}"
echo ""
echo -e "Admin panel: ${BLUE}http://localhost:$PORT${NC}"
echo -e "Login:       ${BLUE}admin@programmier.bar / 123456${NC}"
echo ""
echo -e "To use with Nuxt, create ${BLUE}nuxt-app/.env${NC} with:"
echo -e "  ${BLUE}DIRECTUS_CMS_URL=http://localhost:$PORT${NC}"
echo ""

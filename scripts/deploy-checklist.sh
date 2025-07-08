#!/bin/bash

# StockAlert Slack App - Pre-Deployment Checklist
# This script runs all checks before deployment

set -e

echo "🚀 StockAlert Slack App - Pre-Deployment Checklist"
echo "=================================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check function
check() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $1"
    else
        echo -e "${RED}✗${NC} $1"
        exit 1
    fi
}

# 1. Check Node version
echo -e "\n📦 Checking Node.js version..."
node_version=$(node -v)
echo "Node.js version: $node_version"
if [[ $node_version =~ ^v(1[8-9]|[2-9][0-9]) ]]; then
    check "Node.js version is 18 or higher"
else
    echo -e "${RED}✗${NC} Node.js version must be 18 or higher"
    exit 1
fi

# 2. Install dependencies
echo -e "\n📦 Installing dependencies..."
npm ci
check "Dependencies installed"

# 3. Run TypeScript compilation
echo -e "\n🔍 Running TypeScript checks..."
npm run typecheck
check "TypeScript compilation passed"

# 4. Run linting
echo -e "\n🧹 Running ESLint..."
npm run lint
check "ESLint passed"

# 5. Run tests
echo -e "\n🧪 Running tests..."
npm test
check "All tests passed"

# 6. Check environment variables
echo -e "\n🔐 Checking environment variables..."
required_vars=(
    "SLACK_CLIENT_ID"
    "SLACK_CLIENT_SECRET"
    "SLACK_SIGNING_SECRET"
    "POSTGRES_URL"
    "BASE_URL"
)

missing_vars=()
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -eq 0 ]; then
    check "All required environment variables are set"
else
    echo -e "${RED}✗${NC} Missing environment variables: ${missing_vars[*]}"
    echo -e "${YELLOW}Note: These should be set in Vercel, not locally${NC}"
fi

# 7. Build check
echo -e "\n🏗️  Running build..."
npm run build
check "Build completed successfully"

# 8. Security audit
echo -e "\n🔒 Running security audit..."
npm audit --production
audit_result=$?
if [ $audit_result -eq 0 ]; then
    check "No security vulnerabilities found"
else
    echo -e "${YELLOW}⚠️${NC} Security vulnerabilities found. Run 'npm audit fix' to resolve."
fi

# 9. Check for uncommitted changes
echo -e "\n📝 Checking git status..."
if [ -z "$(git status --porcelain)" ]; then
    check "No uncommitted changes"
else
    echo -e "${YELLOW}⚠️${NC} Uncommitted changes found:"
    git status --short
fi

# 10. Database migration check
echo -e "\n🗄️  Checking database migrations..."
if [ -f "drizzle/meta/_journal.json" ]; then
    check "Database migrations are present"
else
    echo -e "${RED}✗${NC} No database migrations found"
fi

echo -e "\n=================================================="
echo -e "${GREEN}✅ Pre-deployment checks complete!${NC}"
echo -e "\nNext steps:"
echo "1. Commit and push your changes to GitHub"
echo "2. Vercel will automatically deploy from the main branch"
echo "3. Check the deployment at: https://slack.stockalert.pro"
echo "4. Test the Slack app installation flow"
echo ""
echo "Deployment commands:"
echo "  git add ."
echo "  git commit -m 'Your commit message'"
echo "  git push origin main"
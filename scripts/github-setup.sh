#!/bin/bash

echo "🚀 StockAlert Slack App - GitHub Repository Setup"
echo "================================================"
echo ""
echo "Please create the repository manually on GitHub:"
echo ""
echo "1. Go to: https://github.com/orgs/stockalert-pro/repositories/new"
echo "2. Repository name: stockalert-slack-app"
echo "3. Description: Official Slack integration for StockAlert.pro - Receive real-time stock alerts in your Slack workspace"
echo "4. Visibility: Public"
echo "5. Do NOT initialize with README, .gitignore or license"
echo ""
echo "Press Enter after creating the repository..."
read

echo ""
echo "Now let's connect your local repository to GitHub:"
echo ""

# Add remote
git remote add origin git@github.com:stockalert-pro/stockalert-slack-app.git

# Verify remote
echo "Remote added:"
git remote -v

echo ""
echo "Pushing to GitHub..."
git push -u origin main

echo ""
echo "✅ Done! Your repository is now on GitHub."
echo ""
echo "Next steps:"
echo "1. Go to Vercel.com and import this GitHub repository"
echo "2. Run: ./scripts/setup-vercel.sh"
echo ""
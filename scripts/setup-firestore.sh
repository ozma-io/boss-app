#!/bin/bash

# Firestore Setup Script
# Automatically creates database and deploys rules

set -e  # Exit on error

echo "🚀 Firestore Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 1: Check if database exists
echo "📊 Step 1/3: Checking if Firestore database exists..."
DB_EXISTS=$(firebase firestore:databases:list 2>&1 | grep -c "default" || echo "0")

if [ "$DB_EXISTS" -eq "0" ]; then
  echo "   Creating Firestore database in us-central1..."
  firebase firestore:databases:create --location=us-central1
  echo "   ✅ Database created"
else
  echo "   ✅ Database already exists"
fi

echo ""

# Step 2: Deploy security rules
echo "🔐 Step 2/3: Deploying security rules..."
firebase deploy --only firestore:rules
echo "   ✅ Security rules deployed"

echo ""

# Step 3: Deploy indexes
echo "📈 Step 3/3: Deploying indexes..."
firebase deploy --only firestore:indexes
echo "   ✅ Indexes deployed"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Firestore setup complete!"
echo ""
echo "📝 Summary:"
echo "   • Database: (default) in us-central1"
echo "   • Security rules: Deployed"
echo "   • Indexes: Deployed"
echo ""
echo "🔐 Security:"
echo "   • Users can only access their own data"
echo "   • Authentication required for all operations"
echo ""
echo "Next steps:"
echo "   • Restart your app: Press 'r' in Metro bundler"
echo "   • Test connection from app"
echo ""


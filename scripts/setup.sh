#!/bin/bash

set -e

echo "🚀 AI Corp Platform Setup"
echo "========================="

# Check prerequisites
echo "✓ Checking prerequisites..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Install with: npm install -g pnpm"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    exit 1
fi

echo "✓ Node $(node --version)"
echo "✓ pnpm $(pnpm --version)"
echo "✓ Docker available"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
pnpm install

# Start Docker services
echo ""
echo "🐳 Starting Docker services..."
docker-compose up -d

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
for i in {1..30}; do
    if docker-compose exec -T postgres pg_isready -U postgres &> /dev/null; then
        echo "✓ Database is ready"
        break
    fi
    sleep 1
    echo "  Waiting... ($i/30)"
done

# Setup database
echo ""
echo "🗄️  Setting up database..."
cd apps/api
pnpm db:push
cd ../..

echo ""
echo "✅ Setup complete!"
echo ""
echo "🎯 Next steps:"
echo "  1. Configure environment variables in apps/api/.env"
echo "  2. In Terminal 1: cd apps/api && pnpm dev"
echo "  3. In Terminal 2: cd apps/web && pnpm dev"
echo ""
echo "🌐 Access the application at:"
echo "  - Frontend: http://localhost:5173"
echo "  - Backend:  http://localhost:3000"

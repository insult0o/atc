#!/bin/bash

set -e

echo "🚀 Setting up Enhanced Local Unstructured Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is not installed. Please install Python 3.8+ first."
    exit 1
fi

PYTHON_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
print_status "Found Python $PYTHON_VERSION"

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node --version)
print_status "Found Node.js $NODE_VERSION"

# Create required directories
echo "📁 Creating directories..."
mkdir -p lib/python
mkdir -p temp/unstructured/cache
mkdir -p docker/unstructured-local
mkdir -p docker/postgres
mkdir -p docker/grafana/{dashboards,datasources}
mkdir -p docker/prometheus
mkdir -p data/{qdrant,postgres,redis,grafana,prometheus}
mkdir -p uploads
mkdir -p logs

print_status "Directories created"

# Set permissions
chmod -R 755 temp/
chmod -R 755 data/
chmod -R 755 uploads/
chmod 755 lib/python/

print_status "Permissions set"

# Create Python virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "🐍 Creating Python virtual environment..."
    python3 -m venv venv
    print_status "Virtual environment created"
fi

# Activate virtual environment
echo "🔄 Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "📦 Upgrading pip..."
pip install --upgrade pip > /dev/null 2>&1

# Install Python dependencies
echo "📦 Installing Python dependencies..."
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
    print_status "Python dependencies installed"
else
    print_warning "requirements.txt not found, skipping Python dependencies"
fi

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
if [ -f "package.json" ]; then
    npm install
    print_status "Node.js dependencies installed"
else
    print_warning "package.json not found, skipping Node.js dependencies"
fi

# Make Python scripts executable
if [ -f "lib/python/enhanced_unstructured_processor.py" ]; then
    chmod +x lib/python/enhanced_unstructured_processor.py
    print_status "Python scripts made executable"
fi

# Create environment variables file
echo "⚙️ Setting up environment variables..."
cat > .env.local << EOF
# Enhanced Local Unstructured Configuration
PYTHON_PATH=$(which python3)
UNSTRUCTURED_TEMP_DIR=./temp/unstructured
UNSTRUCTURED_CACHE_DIR=./temp/unstructured/cache

# Database Configuration
DATABASE_URL=postgresql://pdf_user:pdf_password@localhost:5432/pdf_intelligence
REDIS_URL=redis://localhost:6379

# Vector Database
QDRANT_URL=http://localhost:6333

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000

# Logging
LOG_LEVEL=INFO
NODE_ENV=development

# Processing Configuration
MAX_FILE_SIZE=100MB
PROCESSING_TIMEOUT=300000
CACHE_ENABLED=true
PARALLEL_PROCESSING=true
MAX_WORKERS=4
EOF

print_status "Environment variables configured"

# Test Python environment
echo "🧪 Testing Python environment..."
if python3 -c "import sys; print(f'Python {sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')" > /dev/null 2>&1; then
    print_status "Python environment OK"
else
    print_error "Python environment test failed"
    exit 1
fi

# Test critical Python modules
echo "🧪 Testing Python modules..."
REQUIRED_MODULES=("unstructured" "json" "pickle" "pathlib")

for module in "${REQUIRED_MODULES[@]}"; do
    if python3 -c "import $module" > /dev/null 2>&1; then
        print_status "Module $module: OK"
    else
        print_warning "Module $module: Not available"
    fi
done

# Test enhanced processor if it exists
if [ -f "lib/python/enhanced_unstructured_processor.py" ]; then
    echo "🧪 Testing enhanced processor..."
    # Create a simple test config
    TEST_CONFIG='{"filename": "nonexistent.pdf", "strategy": "fast", "temp_dir": "./temp/unstructured"}'
    
    # Test imports in the processor
    if python3 -c "
import sys
sys.path.append('lib/python')
try:
    from enhanced_unstructured_processor import EnhancedUnstructuredProcessor
    print('Enhanced processor imports OK')
except Exception as e:
    print(f'Enhanced processor import failed: {e}')
    sys.exit(1)
" > /dev/null 2>&1; then
        print_status "Enhanced processor: OK"
    else
        print_warning "Enhanced processor: Import issues detected"
    fi
fi

# Create health check script
echo "🏥 Creating health check script..."
cat > scripts/health-check.sh << 'EOF'
#!/bin/bash

echo "🔍 Running health checks..."

# Check Python environment
if python3 -c "import unstructured, json, pickle" > /dev/null 2>&1; then
    echo "✅ Python environment: OK"
else
    echo "❌ Python environment: FAILED"
    exit 1
fi

# Check directories
REQUIRED_DIRS=("temp/unstructured" "temp/unstructured/cache" "uploads" "lib/python")
for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo "✅ Directory $dir: OK"
    else
        echo "❌ Directory $dir: MISSING"
        exit 1
    fi
done

# Check environment file
if [ -f ".env.local" ]; then
    echo "✅ Environment file: OK"
else
    echo "❌ Environment file: MISSING"
    exit 1
fi

echo "✅ All health checks passed!"
EOF

chmod +x scripts/health-check.sh
print_status "Health check script created"

# Create development start script
echo "🚀 Creating development start script..."
cat > scripts/dev-start.sh << 'EOF'
#!/bin/bash

echo "🚀 Starting Enhanced PDF Intelligence Platform..."

# Activate Python virtual environment
if [ -d "venv" ]; then
    source venv/bin/activate
    echo "✅ Python virtual environment activated"
fi

# Load environment variables
if [ -f ".env.local" ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
    echo "✅ Environment variables loaded"
fi

# Start services with Docker Compose
if command -v docker-compose &> /dev/null; then
    echo "🐳 Starting Docker services..."
    docker-compose up -d qdrant postgres redis
    echo "✅ Docker services started"
else
    echo "⚠️ Docker Compose not available, skipping service startup"
fi

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 5

# Start the Next.js development server
echo "🌐 Starting Next.js development server..."
npm run dev

EOF

chmod +x scripts/dev-start.sh
print_status "Development start script created"

# Create test script
echo "🧪 Creating test script..."
cat > scripts/test-enhanced-processing.js << 'EOF'
#!/usr/bin/env node

const { EnhancedLocalUnstructuredProcessor } = require('./lib/pdf-processing/enhanced-local-processor');
const path = require('path');
const fs = require('fs');

async function testProcessor() {
  console.log('🧪 Testing Enhanced Local Unstructured Processor...');
  
  try {
    const processor = new EnhancedLocalUnstructuredProcessor();
    
    // Validate processor setup
    console.log('🔍 Validating processor...');
    const isValid = await processor.validateProcessor();
    
    if (!isValid) {
      console.error('❌ Processor validation failed');
      process.exit(1);
    }
    
    console.log('✅ Processor validation successful');
    
    // Get processing stats
    const stats = processor.getProcessingStats();
    console.log('📊 Processing stats:', stats);
    
    // Get cache stats
    const cacheStats = await processor.getCacheStats();
    console.log('💾 Cache stats:', cacheStats);
    
    console.log('✅ All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testProcessor();
EOF

chmod +x scripts/test-enhanced-processing.js
print_status "Test script created"

# Final instructions
echo ""
echo "🎉 Enhanced Local Unstructured Environment Setup Complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Run health check:    ./scripts/health-check.sh"
echo "2. Test processing:     node scripts/test-enhanced-processing.js"
echo "3. Start development:   ./scripts/dev-start.sh"
echo ""
echo "📁 Important Directories:"
echo "   • lib/python/                 - Enhanced Python processors"
echo "   • temp/unstructured/cache/    - Processing cache"
echo "   • uploads/                    - PDF upload directory"
echo "   • data/                       - Database storage"
echo ""
echo "🔧 Configuration:"
echo "   • .env.local                  - Environment variables"
echo "   • requirements.txt            - Python dependencies"
echo "   • docker-compose.yml          - Docker services"
echo ""
echo "🚀 Ready to start processing PDFs with enhanced local capabilities!"

# Deactivate virtual environment
deactivate 
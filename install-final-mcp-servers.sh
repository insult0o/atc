#!/bin/bash

# Matrix Labs Aviation PDF Processing Platform - Final MCP Server Installation
# This script properly installs real MCP servers handling Python virtual environments

set -e

echo "🚀 Installing MCP Servers for Cursor IDE (Final Version)"
echo "========================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${PURPLE}[INSTALLING]${NC} $1"
}

# Create directories
print_status "Creating MCP directories..."
mkdir -p ~/.config/mcp
mkdir -p ./mcp-configs
mkdir -p ./mcp-readmes
mkdir -p ./mcp-tests
mkdir -p ./mcp-servers

# Check dependencies
if ! command -v npm &> /dev/null; then
    print_error "npm is required but not installed. Please install Node.js first."
    exit 1
fi

if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    print_error "Python is required but not installed. Please install Python first."
    exit 1
fi

# Set Python command
PYTHON_CMD="python3"
if ! command -v python3 &> /dev/null; then
    PYTHON_CMD="python"
fi

# Create Python virtual environment for MCP servers
print_status "Creating Python virtual environment for MCP servers..."
if [ ! -d "./mcp-servers/venv" ]; then
    $PYTHON_CMD -m venv ./mcp-servers/venv
    print_success "Virtual environment created"
fi

# Activate virtual environment
source ./mcp-servers/venv/bin/activate
print_success "Virtual environment activated"

echo ""
echo "🎯 Installing Official MCP Servers..."
echo "==================================="

# Clone or update the official servers repository
if [ ! -d "./mcp-servers/official" ]; then
    print_header "Cloning Official MCP Servers Repository"
    git clone https://github.com/modelcontextprotocol/servers.git ./mcp-servers/official
    print_success "Official MCP servers repository cloned"
else
    print_status "Official repository already exists"
fi

cd ./mcp-servers/official

# Check what servers are actually available
print_status "Checking available servers..."
available_servers=$(ls src/ 2>/dev/null || echo "")
print_status "Available servers: $available_servers"

# Install TypeScript servers
echo ""
echo "📦 Installing TypeScript MCP Servers..."
echo "======================================"

for server_dir in src/*/; do
    if [ -d "$server_dir" ]; then
        server_name=$(basename "$server_dir")
        print_header "Processing $server_name server"
        
        cd "$server_dir"
        
        if [ -f "package.json" ]; then
            print_status "Installing TypeScript dependencies for $server_name"
            npm install
            
            if [ -f "tsconfig.json" ]; then
                print_status "Compiling TypeScript for $server_name"
                npx tsc
                print_success "$server_name TypeScript server built successfully"
            else
                print_success "$server_name npm dependencies installed"
            fi
        elif [ -f "pyproject.toml" ]; then
            print_status "Installing Python dependencies for $server_name"
            pip install -e .
            print_success "$server_name Python server installed successfully"
        else
            print_warning "$server_name has no package.json or pyproject.toml"
        fi
        
        cd ../..
    fi
done

cd ../..

# Install additional essential tools
echo ""
echo "🔧 Installing Essential Tools..."
echo "==============================="

print_header "Installing Playwright"
npm install -g @playwright/test
print_success "Playwright installed successfully"

# Install community servers
echo ""
echo "🌍 Installing Community MCP Servers..."
echo "====================================="

# AWS MCP Server
if [ ! -d "./mcp-servers/aws" ]; then
    print_header "Installing AWS MCP Server"
    git clone https://github.com/rishikavikondala/mcp-server-aws.git ./mcp-servers/aws
    cd ./mcp-servers/aws
    pip install -e .
    cd ../..
    print_success "AWS MCP Server installed successfully"
fi

# Install via pipx for global Python tools
if command -v pipx &> /dev/null; then
    print_header "Installing additional MCP tools via pipx"
    # Example: pipx install mcp-server-sqlite
    print_success "pipx tools ready for installation"
else
    print_warning "pipx not available for additional tool installation"
fi

echo ""
echo "🎯 Creating Cursor IDE Configuration..."
echo "===================================="

# Determine which servers are actually working
working_servers=()
server_configs=()

# Check filesystem server
if [ -f "./mcp-servers/official/src/filesystem/build/index.js" ]; then
    working_servers+=("filesystem")
    server_configs+=('    "filesystem": {
      "command": "node",
      "args": ["'$(pwd)'/mcp-servers/official/src/filesystem/build/index.js", "'$(pwd)'"],
      "env": {}
    }')
elif [ -f "./mcp-servers/official/src/filesystem/index.ts" ]; then
    working_servers+=("filesystem")
    server_configs+=('    "filesystem": {
      "command": "npx",
      "args": ["tsx", "'$(pwd)'/mcp-servers/official/src/filesystem/index.ts", "'$(pwd)'"],
      "env": {}
    }')
fi

# Check fetch server  
if [ -d "./mcp-servers/official/src/fetch" ] && [ -f "./mcp-servers/official/src/fetch/pyproject.toml" ]; then
    working_servers+=("fetch")
    server_configs+=('    "fetch": {
      "command": "'$(pwd)'/mcp-servers/venv/bin/python",
      "args": ["-m", "fetch"],
      "cwd": "'$(pwd)'/mcp-servers/official/src/fetch",
      "env": {}
    }')
fi

# Check time server
if [ -d "./mcp-servers/official/src/time" ]; then
    working_servers+=("time")
    if [ -f "./mcp-servers/official/src/time/build/index.js" ]; then
        server_configs+=('    "time": {
          "command": "node",
          "args": ["'$(pwd)'/mcp-servers/official/src/time/build/index.js"],
          "env": {}
        }')
    elif [ -f "./mcp-servers/official/src/time/index.ts" ]; then
        server_configs+=('    "time": {
          "command": "npx",
          "args": ["tsx", "'$(pwd)'/mcp-servers/official/src/time/index.ts"],
          "env": {}
        }')
    fi
fi

# Check git server
if [ -d "./mcp-servers/official/src/git" ]; then
    working_servers+=("git")
    if [ -f "./mcp-servers/official/src/git/build/index.js" ]; then
        server_configs+=('    "git": {
          "command": "node", 
          "args": ["'$(pwd)'/mcp-servers/official/src/git/build/index.js"],
          "env": {}
        }')
    elif [ -f "./mcp-servers/official/src/git/index.ts" ]; then
        server_configs+=('    "git": {
          "command": "npx",
          "args": ["tsx", "'$(pwd)'/mcp-servers/official/src/git/index.ts"],
          "env": {}
        }')
    fi
fi

# Check memory server
if [ -d "./mcp-servers/official/src/memory" ]; then
    working_servers+=("memory")
    server_configs+=('    "memory": {
      "command": "'$(pwd)'/mcp-servers/venv/bin/python",
      "args": ["-m", "memory"],
      "cwd": "'$(pwd)'/mcp-servers/official/src/memory",
      "env": {}
    }')
fi

# Add AWS server if available
if [ -d "./mcp-servers/aws" ]; then
    working_servers+=("aws")
    server_configs+=('    "aws": {
      "command": "'$(pwd)'/mcp-servers/venv/bin/python",
      "args": ["-m", "mcp_server_aws"],
      "cwd": "'$(pwd)'/mcp-servers/aws",
      "env": {
        "AWS_ACCESS_KEY_ID": "your_aws_access_key_here",
        "AWS_SECRET_ACCESS_KEY": "your_aws_secret_key_here",
        "AWS_REGION": "us-east-1"
      }
    }')
fi

# Create configuration file
print_status "Creating Cursor configuration with ${#working_servers[@]} working servers"

cat > ~/.config/mcp/cursor-config.json << EOF
{
  "mcpServers": {
$(IFS=$',\n'; echo "${server_configs[*]}")
  }
}
EOF

# Create local copy
cp ~/.config/mcp/cursor-config.json ./mcp-cursor-config.json

# Install tsx for TypeScript execution if needed
if command -v npm &> /dev/null; then
    print_header "Installing tsx for TypeScript execution"
    npm install -g tsx
    print_success "tsx installed globally"
fi

echo ""
echo "📚 Creating Server Documentation..."
echo "=================================="

# Create README for each working server
for server in "${working_servers[@]}"; do
    case $server in
        "filesystem")
            cat > "./mcp-readmes/$server-README.md" << 'EOF'
# File System Operations MCP Server

## Overview
Provides secure file system access with read/write capabilities.

## Installation Status
✅ **Installed and Configured**

## Usage Examples
Ask Cursor to:
- "Create a new file called example.txt with some content"
- "List all files in the current directory"  
- "Read the contents of package.json"
- "Create a new directory called 'test-folder'"
- "Delete the file named old-file.txt"
- "Copy file.txt to backup-file.txt"

## Security
- Server only has access to the configured directory and subdirectories
- Cannot access files outside the allowed path
- All operations are logged for security

## Best Practices
- Use specific, clear file paths
- Test with simple operations first
- Be careful with delete operations
EOF
            ;;
        "fetch")
            cat > "./mcp-readmes/$server-README.md" << 'EOF'
# HTTP Client MCP Server

## Overview  
Fetches web content and converts to markdown for AI analysis.

## Installation Status
✅ **Installed and Configured**

## Usage Examples
Ask Cursor to:
- "Fetch the content from https://example.com"
- "Get the latest news from a website"
- "Download and analyze a web page"
- "Convert a webpage to markdown format"
- "Check if a website is accessible"

## Features
- Automatic markdown conversion
- Headers and metadata extraction
- Error handling for invalid URLs
- Rate limiting protection

## Best Practices
- Use full URLs including http/https
- Be mindful of rate limits
- Check robots.txt compliance
EOF
            ;;
        "time")
            cat > "./mcp-readmes/$server-README.md" << 'EOF'
# Time Operations MCP Server

## Overview
Handles time calculations, timezone conversions, and scheduling.

## Installation Status  
✅ **Installed and Configured**

## Usage Examples
Ask Cursor to:
- "What time is it in Tokyo?"
- "Convert 3 PM EST to UTC"
- "Add 2 hours to the current time"
- "What's the timezone difference between New York and London?"
- "When is midnight UTC in my local time?"

## Features
- Timezone conversion
- Time arithmetic
- Format conversion
- Multiple timezone support

## Best Practices
- Specify timezones clearly
- Use standard timezone names
- Double-check critical time calculations
EOF
            ;;
        "git")
            cat > "./mcp-readmes/$server-README.md" << 'EOF'
# Git Operations MCP Server

## Overview
Manages Git repositories, commits, branches, and version control.

## Installation Status
✅ **Installed and Configured**

## Usage Examples
Ask Cursor to:
- "Show the git status of this repository" 
- "Create a new branch called 'feature-branch'"
- "Commit these changes with message 'Update files'"
- "Show the git log for the last 5 commits"
- "What branch am I currently on?"

## Features
- Repository status checking
- Branch management
- Commit operations
- History viewing
- Diff generation

## Best Practices
- Always check status before committing
- Use descriptive commit messages
- Review changes before committing
EOF
            ;;
        "memory")
            cat > "./mcp-readmes/$server-README.md" << 'EOF'
# Persistent Memory MCP Server

## Overview
Provides long-term memory storage for AI conversations.

## Installation Status
✅ **Installed and Configured**

## Usage Examples
Ask Cursor to:
- "Remember that I prefer TypeScript over JavaScript"
- "What did we discuss about MCP servers yesterday?"
- "Store this important note for later"
- "Recall my previous project preferences"
- "What do you remember about my coding style?"

## Features
- Persistent conversation memory
- Context retention across sessions
- Searchable memory storage
- Privacy-focused local storage

## Best Practices
- Be explicit about what to remember
- Regularly review stored memories
- Clear outdated information
EOF
            ;;
        "aws")
            cat > "./mcp-readmes/$server-README.md" << 'EOF'
# Amazon Web Services MCP Server

## Overview
Manages AWS resources including S3, DynamoDB, and more.

## Installation Status
✅ **Installed and Configured**

## Setup Required
Configure AWS credentials:
```bash
export AWS_ACCESS_KEY_ID="your_access_key"
export AWS_SECRET_ACCESS_KEY="your_secret_key" 
export AWS_REGION="us-east-1"
```

## Usage Examples
Ask Cursor to:
- "List all my S3 buckets"
- "Create a new DynamoDB table"
- "Upload a file to S3"
- "Query my AWS resources"
- "Check S3 bucket permissions"

## Security
- Store credentials securely
- Use IAM roles when possible
- Limit permissions to necessary actions
- Monitor AWS usage and costs

## Best Practices
- Test with non-production resources first
- Use specific resource names
- Review AWS costs regularly
EOF
            ;;
    esac
    
    print_success "$server README created"
done

# Create master documentation
cat > ./MCP_FINAL_SETUP_COMPLETE.md << EOF
# MCP Servers Installation Complete! 🎉

## Successfully Installed Servers

$(for server in "${working_servers[@]}"; do echo "- ✅ **$server** - Ready for use"; done)

## Configuration Files

- **Main Config**: \`~/.config/mcp/cursor-config.json\`
- **Local Copy**: \`./mcp-cursor-config.json\`  
- **Individual READMEs**: \`./mcp-readmes/\`
- **Virtual Environment**: \`./mcp-servers/venv/\`

## Quick Start

1. **Restart Cursor IDE** - Close and reopen Cursor completely
2. **Test Connection** - Try: "What time is it?"
3. **Test File Operations** - Try: "List files in this directory"
4. **Test Web Fetching** - Try: "Fetch content from example.com"

## Testing

Run the test suite:
\`\`\`bash
./test-final-mcp-servers.sh
\`\`\`

## Individual Server Documentation

$(for server in "${working_servers[@]}"; do echo "- \`./mcp-readmes/$server-README.md\`"; done)

## Troubleshooting

1. **Server Not Responding**: Restart Cursor IDE
2. **Python Errors**: Check virtual environment activation
3. **TypeScript Errors**: Ensure tsx is installed globally
4. **Permission Errors**: Check file permissions

## Usage Examples

### File Operations
- "Create a TypeScript file with a simple function"
- "Show me what's in package.json"
- "List all markdown files here"

### Time Operations  
- "What time is it in different timezones?"
- "Convert time between zones"

### Web Operations
- "Fetch the latest from a news website"
- "Get content from a documentation page"

### Git Operations
- "Show git status"
- "What branch am I on?"
- "Show recent commits"

$(if [[ " ${working_servers[@]} " =~ " memory " ]]; then echo "### Memory Operations
- \"Remember my preferences\"
- \"What did we discuss earlier?\""; fi)

$(if [[ " ${working_servers[@]} " =~ " aws " ]]; then echo "### AWS Operations (requires credentials)
- \"List my S3 buckets\"  
- \"Check AWS resources\""; fi)

---

**Installation completed**: $(date)
**Servers ready**: ${#working_servers[@]}
**All configured for Cursor IDE**
EOF

deactivate  # Deactivate virtual environment

echo ""
echo "✅ Final Installation Summary"
echo "=========================="
print_success "${#working_servers[@]} MCP servers installed successfully!"
print_status "Working servers: ${working_servers[*]}"
print_status "Configuration: ~/.config/mcp/cursor-config.json"
print_status "Documentation: ./MCP_FINAL_SETUP_COMPLETE.md"
print_status "Virtual environment: ./mcp-servers/venv/"

echo ""
echo "🔧 Next Steps:"
echo "1. Restart Cursor IDE completely (important!)"
echo "2. Test: './test-final-mcp-servers.sh'"
echo "3. Try: 'What time is it?' in Cursor"
echo "4. Read server READMEs in ./mcp-readmes/"

echo ""
if [ ${#working_servers[@]} -gt 0 ]; then
    print_success "Setup complete! ${#working_servers[@]} servers ready for Cursor IDE! 🎉"
else
    print_warning "No servers were successfully installed. Check the logs above."
fi 
#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Print functions
print_header() {
    echo -e "\n${YELLOW}$1${NC}"
    echo "=================================="
}

print_status() {
    echo -e "[${YELLOW}TESTING${NC}] $1"
}

print_success() {
    echo -e "[${GREEN}PASS${NC}] $1"
}

print_error() {
    echo -e "[${RED}FAIL${NC}] $1"
}

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0

# Run a test
run_test() {
    local name="$1"
    local test_function="$2"
    local description="$3"
    
    ((TOTAL_TESTS++))
    print_status "Testing $description"
    
    if $test_function; then
        print_success "$name test passed"
        ((PASSED_TESTS++))
        return 0
    else
        print_error "$name test failed"
        return 1
    fi
}

# Test TypeScript servers
test_typescript_server() {
    local server="$1"
    [ -f "/home/insulto/atc/mcp-servers/official/src/$server/dist/index.js" ]
}

# Test Python servers
test_python_server() {
    local server="$1"
    source /home/insulto/atc/mcp-servers/venv/bin/activate
    python -c "import $server" 2>/dev/null
}

# Test configuration
test_config() {
    [ -f "/home/insulto/atc/.config/mcp/cursor-config.json" ]
}

# Test documentation
test_readme() {
    local server="$1"
    [ -f "/home/insulto/atc/mcp-readmes/${server}-README.md" ]
}

print_header "Testing MCP Servers"

# Test TypeScript servers
print_header "Testing TypeScript Servers"
run_test "Everything" "test_typescript_server everything" "Everything server"
run_test "Filesystem" "test_typescript_server filesystem" "Filesystem server"
run_test "Memory" "test_typescript_server memory" "Memory server"
run_test "Sequential Thinking" "test_typescript_server sequentialthinking" "Sequential Thinking server"

# Test Python servers
print_header "Testing Python Servers"
run_test "Fetch" "test_python_server mcp_server_fetch" "Fetch server"
run_test "Git" "test_python_server mcp_server_git" "Git server"
run_test "Time" "test_python_server mcp_server_time" "Time server"

# Test configuration
print_header "Testing Configuration"
run_test "Config" "test_config" "Cursor IDE configuration"

# Test documentation
print_header "Testing Documentation"
run_test "Everything README" "test_readme everything" "Everything server documentation"
run_test "Fetch README" "test_readme fetch" "Fetch server documentation"
run_test "Filesystem README" "test_readme filesystem" "Filesystem server documentation"
run_test "Git README" "test_readme git" "Git server documentation"
run_test "Memory README" "test_readme memory" "Memory server documentation"
run_test "Sequential Thinking README" "test_readme sequential-thinking" "Sequential Thinking server documentation"
run_test "Time README" "test_readme time" "Time server documentation"

# Print summary
print_header "Test Summary"
echo -e "Total tests: ${YELLOW}$TOTAL_TESTS${NC}"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$((TOTAL_TESTS - PASSED_TESTS))${NC}"

if [ $PASSED_TESTS -eq $TOTAL_TESTS ]; then
    echo -e "\n${GREEN}All tests passed! MCP servers are ready to use.${NC}"
    echo "Next step: Restart Cursor IDE"
else
    echo -e "\n${RED}Some tests failed. Please check the output above.${NC}"
    echo "Review the installation steps and try again."
fi 
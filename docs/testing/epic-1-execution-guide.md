# Epic 1: Playwright MCP Testing Execution Guide

## 🚀 Quick Start

### **Prerequisites**
```bash
# Install dependencies
npm install
npm install -D @playwright/test
npx playwright install

# Ensure test fixtures are available
mkdir -p tests/fixtures
# Place test PDF files in tests/fixtures/
```

### **MCP Server Configuration**
Ensure your MCP configuration is properly set up:

```bash
# Verify MCP config
cat mcp-configs/playwright-config.json

# Start MCP server (if not already running)
cd mcp-servers && npm start
```

## 🧪 Test Execution Commands

### **1. Run All Epic 1 Tests**
```bash
# Run complete Epic 1 test suite
npx playwright test tests/e2e/epic1/ --config=mcp-configs/playwright-config.json

# Run with UI mode for debugging
npx playwright test tests/e2e/epic1/ --ui

# Run with headed browsers (visible)
npx playwright test tests/e2e/epic1/ --headed
```

### **2. Run Specific Test Suites**

#### **Foundation Tests (Story 4)**
```bash
npx playwright test tests/e2e/epic1/story4-foundation.spec.ts
```

#### **Integration Workflow Tests**
```bash
npx playwright test tests/e2e/epic1/integration-workflows.spec.ts
```

#### **Performance Tests**
```bash
npx playwright test tests/e2e/epic1/performance.spec.ts --workers=1
```

### **3. Cross-Browser Testing**
```bash
# Run on all browsers
npx playwright test tests/e2e/epic1/ --project=chromium --project=firefox --project=webkit

# Run on specific browser
npx playwright test tests/e2e/epic1/ --project=chromium

# Run mobile tests
npx playwright test tests/e2e/epic1/ --project=mobile-chrome
```

## 📊 Test Reporting & Analysis

### **Generate Test Reports**
```bash
# Generate HTML report
npx playwright test tests/e2e/epic1/ --reporter=html

# Generate JSON report for CI/CD
npx playwright test tests/e2e/epic1/ --reporter=json:epic1-results.json

# Generate JUnit report
npx playwright test tests/e2e/epic1/ --reporter=junit:epic1-junit.xml
```

### **View Test Reports**
```bash
# Open HTML report
npx playwright show-report

# View traces for failed tests
npx playwright show-trace test-results/[test-name]/trace.zip
```

## 🔧 Test Configuration & Environment

### **Environment Variables**
```bash
# Set test environment
export TEST_ENV=epic1_integration
export PLAYWRIGHT_HEADLESS=false
export PLAYWRIGHT_TIMEOUT=60000

# Development mode (with verbose logging)
export DEBUG=playwright:*
```

### **Test Data Setup**
```bash
# Ensure test fixtures exist
ls tests/fixtures/
# Should contain:
# - test-aviation-manual.pdf (5-10 pages)
# - aviation-manual-50p.pdf (50 pages)
# - large-aviation-manual-100p.pdf (100+ pages)
# - regression-baseline.pdf (baseline for regression tests)
# - invalid-file.txt (for validation tests)
```

## 🎯 Test Categories & Execution Strategy

### **1. Smoke Tests (Quick Validation)**
```bash
# Run basic functionality tests (~5 minutes)
npx playwright test tests/e2e/epic1/story4-foundation.spec.ts --grep="upload.*progress"
```

### **2. Integration Tests (Comprehensive)**
```bash
# Run full integration workflows (~20 minutes)
npx playwright test tests/e2e/epic1/integration-workflows.spec.ts
```

### **3. Performance Tests (Resource Intensive)**
```bash
# Run performance and stress tests (~45 minutes)
npx playwright test tests/e2e/epic1/performance.spec.ts --workers=1 --timeout=300000
```

### **4. Regression Tests (Baseline Validation)**
```bash
# Run regression validation (~15 minutes)
npx playwright test tests/e2e/epic1/ --grep="regression"
```

## 🚨 Troubleshooting Guide

### **Common Issues & Solutions**

#### **1. MCP Server Connection Issues**
```bash
# Check MCP server status
curl http://localhost:3000/health

# Restart MCP server
cd mcp-servers && npm restart

# Verify MCP configuration
cat mcp-configs/playwright-config.json | jq .
```

#### **2. Test Fixture Not Found**
```bash
# Check fixture files
ls -la tests/fixtures/

# Download test fixtures (if needed)
wget https://example.com/test-files/aviation-manual.pdf -O tests/fixtures/test-aviation-manual.pdf
```

#### **3. Browser Launch Failures**
```bash
# Reinstall browsers
npx playwright install --force

# Check browser dependencies
npx playwright install-deps
```

#### **4. WebSocket Connection Issues**
```bash
# Verify WebSocket endpoint is available
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:3000/api/ws

# Check for port conflicts
netstat -an | grep 3000
```

#### **5. Performance Test Timeouts**
```bash
# Increase timeout for large documents
npx playwright test tests/e2e/epic1/performance.spec.ts --timeout=600000

# Run with single worker to reduce resource contention
npx playwright test --workers=1
```

## 📈 CI/CD Integration

### **GitHub Actions Example**
```yaml
name: Epic 1 E2E Tests
on: [push, pull_request]

jobs:
  epic1-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright
        run: npx playwright install --with-deps
      
      - name: Start application
        run: npm run dev &
        
      - name: Wait for application
        run: npx wait-on http://localhost:3000
      
      - name: Run Epic 1 Tests
        run: npx playwright test tests/e2e/epic1/
      
      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## 🎪 Advanced Testing Scenarios

### **1. Load Testing with Multiple Users**
```bash
# Run concurrent user tests
npx playwright test tests/e2e/epic1/integration-workflows.spec.ts --grep="Multi-User" --workers=4
```

### **2. Memory Leak Detection**
```bash
# Run with memory monitoring
npx playwright test tests/e2e/epic1/performance.spec.ts --grep="Memory" --headed
```

### **3. Network Condition Testing**
```bash
# Test with slow network
npx playwright test tests/e2e/epic1/ --config=slow-network.config.js
```

### **4. Visual Regression Testing**
```bash
# Update visual baselines
npx playwright test tests/e2e/epic1/ --update-snapshots

# Run visual comparison tests
npx playwright test tests/e2e/epic1/ --grep="visual"
```

## 📋 Test Quality Metrics

### **Expected Test Coverage**
- **Story 4 Foundation**: >95% path coverage
- **Story 5 Zone Detection**: >90% feature coverage  
- **Story 6 Pipeline**: >90% integration coverage
- **Story 7 Confidence**: >85% algorithm coverage

### **Performance Benchmarks**
- **Small PDF (5 pages)**: <10 seconds processing
- **Medium PDF (25 pages)**: <45 seconds processing
- **Large PDF (100 pages)**: <3 minutes processing
- **Memory Usage**: <512MB peak for medium documents

### **Quality Gates**
- **Test Pass Rate**: >98%
- **Flaky Test Rate**: <2%
- **Test Execution Time**: <60 minutes total suite
- **Cross-Browser Compatibility**: 100% on Chrome, Firefox, Safari

## 🚀 Best Practices

### **1. Test Data Management**
- Use consistent test fixtures across environments
- Implement data cleanup after each test
- Version control test data with Git LFS

### **2. Test Isolation**
- Each test should be independent
- Use separate browser contexts for concurrent tests
- Clean up state between test runs

### **3. Error Handling**
- Implement retry logic for flaky tests
- Use appropriate timeouts for different operations
- Capture screenshots and traces on failures

### **4. Performance Optimization**
- Run performance tests on dedicated hardware
- Use parallel execution for independent tests
- Monitor resource usage during test execution

---

## 📞 Support & Maintenance

### **Test Maintenance Schedule**
- **Daily**: Smoke tests in CI/CD
- **Weekly**: Full integration test suite
- **Monthly**: Performance regression validation
- **Quarterly**: Visual regression baseline updates

### **Contact & Support**
- **QA Team**: qa-team@company.com
- **DevOps**: devops@company.com
- **Documentation**: Update this guide as tests evolve

**Last Updated**: Current Date  
**Version**: 1.0.0  
**Epic**: Epic 1 - PDF Processing Core Functionality 
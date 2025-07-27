# PDF Intelligence Platform - E2E Tests

This directory contains end-to-end tests for the PDF Intelligence Platform using Playwright.

## 🏗️ Structure

```
test/e2e/
├── fixtures/          # Test data and constants
├── pages/            # Page Object Models
├── utils/            # Helper utilities
├── workflows/        # Test suites organized by workflow
│   ├── quick-extract/
│   ├── detailed-review/
│   ├── collaborative/
│   ├── batch-processing/
│   └── api-integration/
├── visual/           # Visual regression tests
└── reporters/        # Custom test reporters
```

## 🚀 Running Tests

### Prerequisites
- Node.js 20+
- Python 3.11+
- Running frontend (port 3000)
- Running backend (port 8000)

### Install Dependencies
```bash
npm install
npx playwright install --with-deps
```

### Run All Tests
```bash
npm run test:e2e
```

### Run Specific Workflow
```bash
# Quick Extract workflow only
npx playwright test --project=quick-extract

# Detailed Review workflow only
npx playwright test --project=detailed-review

# Visual regression tests
npx playwright test --project=visual-regression
```

### Run in UI Mode (Interactive)
```bash
npx playwright test --ui
```

### Run with Debugging
```bash
npx playwright test --debug
```

## 📋 Test Workflows

### 1. Quick Extract (2-3 minutes)
Tests the fastest path from upload to export:
- PDF upload
- Automatic processing
- Zone detection
- Quick RAG export

### 2. Detailed Review (10-15 minutes)
Tests comprehensive editing features:
- Zone selection and editing
- Content validation
- Zone merging/splitting
- Multiple export formats

### 3. Collaborative
Tests multi-user features:
- Real-time synchronization
- Concurrent editing
- Conflict resolution
- User presence indicators

### 4. Batch Processing
Tests bulk operations:
- Multiple file upload
- Queue management
- Bulk export
- Progress tracking

### 5. API Integration
Tests programmatic access:
- REST API endpoints
- WebSocket connections
- Webhook notifications
- Authentication

### 6. Visual Regression
Tests UI consistency:
- Component layouts
- Theme variations
- Responsive design
- Interaction states

## 🛠️ Writing Tests

### Page Object Model Example
```typescript
// pages/CustomPage.ts
import { BasePage } from './BasePage';

export class CustomPage extends BasePage {
  async performAction() {
    await this.clickWithRetry('[data-testid="action-button"]');
  }
}
```

### Test Example
```typescript
// workflows/custom/custom.spec.ts
import { test, expect } from '@playwright/test';

test('should perform custom action', async ({ page }) => {
  const customPage = new CustomPage(page);
  await customPage.navigate();
  await customPage.performAction();
  await expect(page).toHaveURL(/success/);
});
```

## 📊 Test Reports

### Workflow Report
After running tests, a detailed report is generated at:
```
test-results/workflow-report.json
```

### HTML Report
View the interactive HTML report:
```bash
npx playwright show-report
```

### Screenshots
Failed test screenshots are saved to:
```
test-results/screenshots/
```

## 🔧 Configuration

### Timeouts
Edit `playwright.config.ts` to adjust timeouts:
```typescript
use: {
  actionTimeout: 10000,    // Individual actions
  navigationTimeout: 30000, // Page navigation
}
```

### Parallel Execution
Tests run in parallel by default. Adjust workers:
```typescript
workers: process.env.CI ? 1 : 4,
```

### Test Data
Test PDFs and fixtures are in `fixtures/test-data.ts`

## 🐛 Debugging

### Take Screenshots
```typescript
await page.screenshot({ path: 'debug.png' });
```

### Pause Execution
```typescript
await page.pause(); // Opens inspector
```

### Console Logs
```typescript
page.on('console', msg => console.log(msg.text()));
```

### Slow Down Execution
```bash
npx playwright test --headed --slow-mo=1000
```

## 📈 CI/CD Integration

Tests run automatically on:
- Push to main/develop
- Pull requests
- Daily schedule (2 AM UTC)
- Manual trigger

View results in GitHub Actions:
- Test reports as artifacts
- Summary in PR comments
- Performance metrics

## 🎯 Best Practices

1. **Use Page Objects**: Encapsulate page interactions
2. **Data-testid Selectors**: Reliable element selection
3. **Explicit Waits**: Wait for specific conditions
4. **Isolated Tests**: Each test should be independent
5. **Meaningful Names**: Describe what the test verifies
6. **Error Handling**: Use try-catch for cleanup
7. **Visual Baselines**: Update when UI changes

## 🔍 Troubleshooting

### Tests Timing Out
- Check if services are running
- Increase timeout values
- Check network conditions

### Flaky Tests
- Add explicit waits
- Check for race conditions
- Use retry mechanisms

### Visual Differences
- Update baseline screenshots
- Check for animations
- Verify viewport size

## 📚 Resources

- [Playwright Documentation](https://playwright.dev)
- [Page Object Model Pattern](https://playwright.dev/docs/pom)
- [Best Practices](https://playwright.dev/docs/best-practices)
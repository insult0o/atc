# Playwright MCP Server Setup

## Overview
This document outlines the setup and configuration of Playwright MCP Server for AI-driven browser testing in our project.

## Prerequisites
- ✅ Node.js v20.19.4 (installed)
- ✅ Cursor IDE (installed)
- ✅ BMAD-METHOD v4 (installed)

## Installation Steps

### 1. Install Playwright MCP
```bash
npm install @playwright/mcp
```

### 2. Configure MCP in Cursor
Create `.vscode/mcp.json`:
```json
{
  "servers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

### 3. Create Test Directory Structure
```
tests/
├── setup/
│   └── global-setup.ts
├── fixtures/
│   └── test-data.ts
└── e2e/
    └── example.spec.ts
```

### 4. Configure Test Agent
Create `.cursor/rules/playwright-test.mdc`:
```yaml
---
tools: ['playwright']
mode: 'agent'
---

You are a Playwright test generator following our technical preferences:
1. Use role-based locators
2. Implement auto-retrying assertions
3. Avoid manual timeouts
4. Use TypeScript
5. Follow isolated test patterns
6. Save tests in appropriate subdirectories under tests/
7. Use proper setup and teardown hooks
```

## Usage
1. Start MCP Server from Cursor's MCP Servers panel
2. Use the Playwright test agent with: `@playwright-test Generate test for [feature]`
3. Tests will be generated in the appropriate directory following our standards

## Best Practices
- Keep tests isolated and independent
- Use proper setup/teardown hooks
- Follow role-based selector patterns
- Implement proper error handling
- Use TypeScript for type safety
- Document test scenarios clearly

## Maintenance
- Regular updates via `npm update @playwright/mcp`
- Monitor test stability in CI pipeline
- Review and update test patterns as needed
- Clean up test artifacts regularly

## Security Considerations
- Run in headless mode by default
- Implement network access controls
- Clean up test sessions properly
- Secure test data management 
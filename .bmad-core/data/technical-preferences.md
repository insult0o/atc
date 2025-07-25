# User-Defined Preferred Patterns and Preferences

## Testing Infrastructure
- Use Playwright MCP Server for browser testing
- Prefer role-based locators for resilient tests
- Use headless mode by default for CI compatibility
- Follow isolated test patterns with proper hooks
- Implement auto-retrying assertions
- Avoid manual timeouts
- Use TypeScript for test files

## Test File Organization
- Store tests in `tests/` directory
- Use descriptive test file names
- Group related tests in subdirectories
- Include setup files in `tests/setup/`
- Store test data in `tests/fixtures/`

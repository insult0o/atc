// Test configuration constants
export const TEST_CONFIG = {
  // Use mocked API responses
  USE_MOCKS: true,
  
  // Timeouts
  DEFAULT_TIMEOUT: 30000,
  UPLOAD_TIMEOUT: 60000,
  PROCESSING_TIMEOUT: 120000,
  
  // Test data
  MOCK_ZONES_COUNT: 5,
  
  // Disable features that require backend
  ENABLE_WEBSOCKET_TESTS: false,
  ENABLE_EXPORT_TESTS: false,
  ENABLE_BATCH_PROCESSING: false,
};
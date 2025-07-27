# Epic 6: Backend API Completion & Integration

## Epic Overview
This epic addresses all missing API endpoints and integration issues identified in the MISSING_API_ENDPOINTS_REPORT.md. The goal is to complete the backend implementation to support all frontend features and ensure E2E tests pass.

## Current State
- **Backend Status**: Basic endpoints functional, but advanced features missing
- **Test Results**: 27/86 tests passing (31.4%)
- **Main Issues**: Missing API endpoints, WebSocket support, and test ID attributes

## Stories

### Story 1: Processing Status & Progress Tracking
**Priority**: High | **Effort**: Low | **Tests Affected**: 48

#### Description
Implement document processing status endpoint and real-time progress tracking to support processing workflow tests.

#### Acceptance Criteria
- [ ] `/api/v1/documents/{id}/status` endpoint returns processing status
- [ ] Status includes: state (processing/completed/failed), progress percentage, error messages
- [ ] Frontend displays processing progress with `data-testid="processing-complete"`
- [ ] Progress updates via Server-Sent Events or WebSocket
- [ ] Tests for processing workflow pass

#### Technical Details
- Backend: FastAPI endpoint with status tracking
- Frontend: Update useDocument hook to poll status
- Add progress bar component with test IDs

---

### Story 2: Zone Management System
**Priority**: High | **Effort**: Medium | **Tests Affected**: 24

#### Description
Implement complete zone CRUD operations and management features for document zones.

#### Acceptance Criteria
- [ ] GET `/api/v1/documents/{id}/zones` - List all zones
- [ ] POST `/api/v1/documents/{id}/zones` - Create new zone
- [ ] PUT `/api/v1/zones/{id}` - Update zone properties
- [ ] DELETE `/api/v1/zones/{id}` - Delete zone
- [ ] POST `/api/v1/zones/{id}/reprocess` - Reprocess zone content
- [ ] Frontend zone editor with `data-testid="zone-editor"`
- [ ] Zone detection and editing tests pass

#### Technical Details
- Backend: Zone model, service, and endpoints
- Frontend: Update useZones hook, add zone editor component
- Database: Zone storage schema

---

### Story 3: Export System Implementation
**Priority**: Medium | **Effort**: Medium | **Tests Affected**: 18

#### Description
Complete export system with preview, generation, validation, and download capabilities.

#### Acceptance Criteria
- [ ] POST `/api/v1/export/preview` - Generate export preview
- [ ] POST `/api/v1/export/generate` - Generate export file
- [ ] GET `/api/v1/export/{id}/download` - Download export
- [ ] POST `/api/v1/export/validate` - Validate export data
- [ ] Export dialog with `data-testid="export-dialog"`
- [ ] Support for RAG chunks, JSONL, and other formats
- [ ] Export workflow tests pass

#### Technical Details
- Backend: Export service with format handlers
- Frontend: Export dialog component with validation
- Storage: Export file management

---

### Story 4: WebSocket & Real-time Features
**Priority**: Medium | **Effort**: High | **Tests Affected**: 14

#### Description
Implement WebSocket support for real-time collaboration and updates.

#### Acceptance Criteria
- [ ] WebSocket endpoint at `/ws` for real-time connections
- [ ] Real-time document updates broadcast
- [ ] User presence and active indicators
- [ ] Conflict resolution for concurrent edits
- [ ] Connection management and reconnection
- [ ] Collaborative workflow tests pass

#### Technical Details
- Backend: WebSocket manager with room-based connections
- Frontend: WebSocket client with reconnection logic
- State synchronization system

---

### Story 5: Frontend Test ID Integration
**Priority**: High | **Effort**: Low | **Tests Affected**: All

#### Description
Add missing `data-testid` attributes to all UI components for test automation.

#### Acceptance Criteria
- [ ] All major components have appropriate test IDs
- [ ] Test IDs follow consistent naming convention
- [ ] Key test IDs implemented:
  - `processing-complete`
  - `zone-editor`
  - `export-dialog`
  - `validation-panel`
  - `progress-bar`
  - `error-message`
- [ ] E2E tests can locate all required elements

#### Technical Details
- Frontend: Update all components with test IDs
- Create test ID constants file
- Document test ID naming convention

---

### Story 6: API Response Standardization
**Priority**: Medium | **Effort**: Low | **Tests Affected**: All

#### Description
Standardize API response formats and error handling across all endpoints.

#### Acceptance Criteria
- [ ] Consistent response envelope format
- [ ] Standardized error response structure
- [ ] Proper HTTP status codes
- [ ] Response validation schemas
- [ ] Frontend API client handles all response formats
- [ ] No frontend crashes due to unexpected responses

#### Technical Details
- Backend: Response models and error handlers
- Frontend: API client error handling
- OpenAPI documentation updates

---

## Implementation Order
1. **Story 5** (Test IDs) - Quick win to improve test visibility
2. **Story 1** (Processing Status) - High impact, low effort
3. **Story 2** (Zone Management) - Core functionality
4. **Story 3** (Export System) - Key user feature
5. **Story 6** (API Standardization) - Foundation for stability
6. **Story 4** (WebSocket) - Advanced features

## Success Metrics
- E2E test pass rate increases from 31.4% to 90%+
- All critical user workflows functional
- No API-related errors in production
- Real-time features working smoothly

## Technical Considerations
- Use existing backend structure and patterns
- Maintain backward compatibility
- Focus on test-driven development
- Document all new endpoints in OpenAPI

## Dependencies
- Backend: FastAPI, SQLAlchemy, WebSocket support
- Frontend: React Query, WebSocket client
- Testing: Playwright E2E tests
- Database: PostgreSQL with proper schemas
# GitHub Copilot Instructions

This file provides guidance to GitHub Copilot and other AI assistants on how to maintain and contribute to the Mattermost-Slack Bridge project while preserving its architecture and conventions.

## Project Overview

This is a **bidirectional messaging bridge** between Mattermost and Slack that synchronizes messages, reactions, files, and threads between platforms. The codebase follows a **modular architecture** with clear separation of concerns.

## Core Principles

### 1. Modularity
- Each module has a **single, well-defined responsibility**
- Keep modules small and focused (ideally under 250 lines)
- Avoid circular dependencies between modules
- Use clear, descriptive module and function names

### 2. Testability
- Every module must have corresponding unit tests
- Tests mirror the source structure in `__tests__/`
- Maintain **minimum 70% code coverage**
- Mock external dependencies (Slack API, Mattermost API, Redis)

### 3. Type Safety & Documentation
- Use JSDoc comments for all public functions
- Document parameters, return types, and purpose
- Include usage examples in JSDoc for complex functions
- Keep inline comments minimal and meaningful

## Project Structure

**ALWAYS maintain this structure when adding new code:**

```
src/
├── config/              # Configuration and environment management
│   └── environment.js   # Env vars, channel mappings, config objects
├── handlers/            # Event handlers for both platforms
│   ├── slack.js        # Slack message/event handlers
│   ├── mattermost.js   # Mattermost post/event handlers
│   └── reactions.js    # Reaction sync handlers
├── storage/             # Data persistence layer
│   └── redis.js        # Redis operations, message mappings
├── utils/               # Utility functions (pure, reusable)
│   ├── markdown.js     # Markdown conversion
│   └── logger.js       # Logging utilities
└── index.js             # Application entry point, initialization

__tests__/               # Mirror src/ structure exactly
├── config/
├── handlers/
├── storage/
└── utils/
```

## Coding Standards

### Module Structure

Each module should follow this pattern:

```javascript
// Module imports
const dependency = require('./dependency');
const { createContextLogger } = require('../utils/logger');

// Module-level constants and logger
const log = createContextLogger('module-name');
const CONSTANTS = { /* ... */ };

// Private helper functions
function privateHelper() { /* ... */ }

// Public functions
/**
 * Brief description of what this function does
 * @param {Type} paramName - Parameter description
 * @returns {Type} Return value description
 */
function publicFunction(paramName) { /* ... */ }

// Module exports
module.exports = {
  publicFunction,
};
```

### Naming Conventions

- **Files**: `lowercase-with-hyphens.js` for multi-word files (e.g., `environment.js`, `markdown.js`)
- **Functions**: `camelCase` (e.g., `handleSlackMessage`, `convertMarkdown`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `REDIS_EXPIRY_SECONDS`)
- **Classes**: `PascalCase` (if needed)
- **Private functions**: Prefix with underscore if truly internal: `_helperFunction`

### Handler Functions

For new handlers, follow this pattern:

```javascript
async function handleNewFeature(client, api, eventData) {
  // 1. Guard conditions first (early returns)
  if (!eventData || !eventData.requiredField) {
    return;
  }
  
  // 2. Extract and validate data
  const { field1, field2 } = eventData;
  
  // 3. Perform main logic with try-catch
  try {
    // Business logic here
    log.info('Feature processed successfully', { field1 });
  } catch (error) {
    log.error('Error processing feature', { error: error.message });
  }
}
```

## Adding New Features

### 1. New Handler (e.g., for a new Slack/Mattermost event)

**Location**: `src/handlers/slack.js` or `src/handlers/mattermost.js` or create new handler file

**Steps**:
1. Add handler function to appropriate module
2. Export the function
3. Register event listener in `src/index.js`
4. Add unit tests in `__tests__/handlers/`
5. Update `docs/api.md` with new function documentation

**Example**:
```javascript
// In src/handlers/slack.js
async function handleNewSlackEvent(slackApp, mmApi, event) {
  // Implementation
}

// In src/index.js
slackApp.event('new_event', async ({ event }) => {
  try {
    await handleNewSlackEvent(slackApp, mmApi, event);
  } catch (err) {
    log.error('Error processing new event', { error: err.message });
  }
});
```

### 2. New Utility Function

**Location**: `src/utils/` - create new file if it's a new category

**Rules**:
- Must be **pure functions** when possible (no side effects)
- Should not directly interact with APIs or storage
- Must be fully unit tested
- Should have JSDoc documentation

### 3. New Storage Operation

**Location**: `src/storage/redis.js`

**Rules**:
- All Redis operations go here (don't scatter Redis calls)
- Use try-catch for error handling
- Log errors with context
- Return null/undefined on errors, don't throw
- Add corresponding test in `__tests__/storage/redis.test.js`

### 4. New Configuration Option

**Location**: `src/config/environment.js`

**Steps**:
1. Add to `.env.example` with description
2. Parse in `environment.js`
3. Add to exported `config` object
4. Document in main `README.md`
5. Add test for validation/parsing

## Logging Guidelines

Always use the structured logger:

```javascript
const { createContextLogger } = require('../utils/logger');
const log = createContextLogger('module-name');

// Good - structured logging with metadata
log.info('Message processed', { messageId, channelId });
log.error('Failed to sync', { error: err.message, userId });

// Bad - don't use console.log
console.log('Message processed'); // ❌
```

**Log Levels**:
- `error`: Failures, exceptions, critical issues
- `warn`: Recoverable issues, deprecations
- `info`: Normal operations, state changes
- `debug`: Detailed information for troubleshooting

## Testing Requirements

### Test File Structure

```javascript
// Mock dependencies BEFORE importing module under test
jest.mock('../../src/storage/redis');
jest.mock('../../src/utils/logger', () => ({
  createContextLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })
}));

const moduleUnderTest = require('../../src/module');

describe('Module Name', () => {
  describe('functionName', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should handle normal case', () => {
      // Arrange
      // Act
      // Assert
    });

    test('should handle error case', () => {
      // Test error handling
    });
  });
});
```

### Test Coverage Requirements

- **Minimum**: 70% coverage across all metrics
- **Aim for**: 80%+ on new code
- **Must test**: 
  - Happy path
  - Error conditions
  - Edge cases (null, undefined, empty)
  - Guard conditions

### Running Tests

```bash
npm test                 # Run all tests
npm run test:watch       # Watch mode during development
npm run test:coverage    # Coverage report
```

## Documentation Requirements

When adding/modifying features:

1. **Update API Reference** (`docs/api.md`): Document all public functions
2. **Update Architecture** (`docs/architecture.md`): If changing system design
3. **Update README.md**: If adding user-facing features
4. **Add JSDoc comments**: For all public functions
5. **Update docs/README.md**: If adding new documentation files

## Common Patterns

### Channel Mapping Lookup

```javascript
const { slackToMmChannelMap, mmToSlackChannelMap } = require('../config/environment');

// Slack to Mattermost
const mmChannelId = slackToMmChannelMap.get(slackChannelId);
if (!mmChannelId) return; // Not mapped

// Mattermost to Slack
const slackChannelId = mmToSlackChannelMap.get(mmChannelId);
if (!slackChannelId) return; // Not mapped
```

### Message Mapping Storage

```javascript
const { setSlackToMm, getSlackToMm, setMmToSlack, getMmToSlack } = require('../storage/redis');

// Store bidirectional mapping for new messages
await setSlackToMm(slackChannel, slackTs, mmPostId);
await setMmToSlack(mmChannel, mmPostId, slackTs);

// Retrieve mapping
const mmPostId = await getSlackToMm(slackChannel, slackTs);
const slackTs = await getMmToSlack(mmChannel, mmPostId);
```

### Markdown Conversion

```javascript
const { convertSlackToMattermost, convertMattermostToSlack } = require('../utils/markdown');

// Slack → Mattermost
const mmMarkdown = convertSlackToMattermost(slackText);

// Mattermost → Slack
const slackMarkdown = convertMattermostToSlack(mmText);
```

## Don't Do This ❌

1. **Don't add business logic to `src/index.js`** - it should only wire components together
2. **Don't use console.log** - use the logger
3. **Don't add Redis calls outside `src/storage/redis.js`**
4. **Don't create circular dependencies** between modules
5. **Don't skip writing tests** for new functionality
6. **Don't commit secrets or credentials** (use .env)
7. **Don't modify the project structure** without updating this file
8. **Don't use `require()` for external APIs** in utility functions

## Do This ✅

1. **Do follow the single responsibility principle**
2. **Do write unit tests for every function**
3. **Do use structured logging with context**
4. **Do handle errors gracefully**
5. **Do document public APIs with JSDoc**
6. **Do maintain backward compatibility**
7. **Do update documentation when changing features**
8. **Do use the existing patterns** shown above

## Environment Variables

All environment variables must be:
1. Documented in `.env.example`
2. Parsed in `src/config/environment.js`
3. Documented in main `README.md`
4. Validated with clear error messages if required

## Security Considerations

- **Never log sensitive data**: tokens, passwords, full message content
- **Validate all external input**: from Slack/Mattermost APIs
- **Use environment variables**: for all secrets
- **Follow least privilege**: bot permissions should be minimal
- **Review dependencies**: keep packages up to date

## Performance Guidelines

- **Avoid unnecessary API calls**: cache when possible
- **Use Redis efficiently**: batch operations when possible
- **Handle WebSocket reconnections**: implement exponential backoff
- **Monitor memory usage**: especially with file transfers
- **Log performance metrics**: for bottleneck identification

## Questions?

- Review existing code for patterns
- Check the documentation in `docs/`
- See `README.md` for architecture overview
- Look at test files for usage examples

---

**Remember**: This project prioritizes **maintainability**, **testability**, and **clear separation of concerns**. When in doubt, keep it simple and follow existing patterns.

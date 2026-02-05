# Development Guide

## Getting Started

### Prerequisites

- Node.js 14 or higher (for ES6 features and regex lookbehinds)
- Redis server (local or remote)
- Access to Slack workspace (for creating apps)
- Access to Mattermost instance (for bot setup)
- Git

### Initial Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/markkr125/mattermost-slack-bridge.git
   cd mattermost-slack-bridge
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Install Redis** (if not already installed)
   
   **macOS**:
   ```bash
   brew install redis
   brew services start redis
   ```
   
   **Ubuntu/Debian**:
   ```bash
   sudo apt-get install redis-server
   sudo service redis-server start
   ```
   
   **Docker**:
   ```bash
   docker run -d --name redis -p 6379:6379 redis:alpine
   ```

4. **Verify Redis**
   ```bash
   redis-cli ping  # Should return "PONG"
   ```

5. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your development credentials
   ```

### Environment Configuration

Create a `.env` file with your development settings:

```env
# Slack Configuration
SLACK_BOT_TOKEN=xoxb-your-dev-token
SLACK_SIGNING_SECRET=your-dev-signing-secret

# Mattermost Configuration
MM_TOKEN=your-dev-mm-token
MM_URL=http://localhost:8065  # Local Mattermost instance

# Channel Mappings (use dev channels)
CHANNEL_MAPPINGS=[{"slack":"C_DEV_SLACK","mattermost":"dev_mm_channel"}]

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_EXPIRY_DAYS=7  # Shorter expiry for development

# Server Configuration
PORT=3000
```

## Project Structure

```
mattermost-slack-bridge/
├── src/
│   ├── config/
│   │   └── environment.js       # Configuration management
│   ├── handlers/
│   │   ├── mattermost.js        # Mattermost event handlers
│   │   └── slack.js             # Slack event handlers
│   ├── storage/
│   │   └── redis.js             # Redis storage layer
│   ├── utils/
│   │   └── markdown.js          # Markdown conversion utilities
│   └── index.js                 # Main application entry point
├── __tests__/
│   ├── config/
│   │   └── environment.test.js  # Config tests
│   ├── handlers/
│   │   ├── mattermost.test.js   # Mattermost handler tests
│   │   └── slack.test.js        # Slack handler tests
│   ├── storage/
│   │   └── redis.test.js        # Redis storage tests
│   └── utils/
│       └── markdown.test.js     # Markdown conversion tests
├── docs/
│   ├── architecture.md          # System architecture
│   ├── api.md                   # API documentation
│   ├── deployment.md            # Deployment guide
│   └── development.md           # This file
├── .env.example                 # Example environment file
├── .gitignore                   # Git ignore rules
├── jest.config.js               # Jest configuration
├── package.json                 # NPM dependencies
├── README.md                    # Project readme
└── bridge.js                    # Legacy monolithic file (deprecated)
```

## Running the Application

### Development Mode

```bash
npm start
```

This will:
- Load environment variables from `.env`
- Connect to Redis
- Initialize Slack and Mattermost clients
- Start the WebSocket connection
- Listen for events on the configured port

### Expected Output

```
Loaded 1 channel mapping from CHANNEL_MAPPINGS
Channel mappings configured:
  Slack C_DEV_SLACK <-> Mattermost dev_mm_channel
Redis connected
Mattermost WebSocket connected
Bridge running on port 3000
```

## Testing

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

### Coverage Reports

Coverage reports are generated in the `coverage/` directory. Open `coverage/lcov-report/index.html` in a browser to view detailed coverage.

**Coverage Thresholds** (configured in `jest.config.js`):
- Branches: 70%
- Functions: 70%
- Lines: 70%
- Statements: 70%

### Writing Tests

#### Test Structure

```javascript
// __tests__/module/file.test.js
describe('Module Name', () => {
  describe('Function Name', () => {
    test('should do something', () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = someFunction(input);
      
      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

#### Mocking Dependencies

```javascript
// Mock external modules
jest.mock('ioredis');
jest.mock('../../src/storage/redis');

// Import after mocking
const { functionToTest } = require('../../src/module/file');
const { mockedFunction } = require('../../src/storage/redis');

// Setup mock behavior
mockedFunction.mockResolvedValue('mocked value');
```

#### Environment Setup

```javascript
// Set up environment before importing
process.env.CHANNEL_MAPPINGS = '[{"slack":"C12345","mattermost":"mm12345"}]';
process.env.REDIS_URL = 'redis://localhost:6379';

// Import after environment setup
const { config } = require('../../src/config/environment');
```

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes

- Edit files in `src/` directory
- Follow existing code style
- Add JSDoc comments for functions
- Keep functions small and focused

### 3. Write Tests

- Create corresponding test file in `__tests__/`
- Test happy paths and error cases
- Mock external dependencies
- Aim for high coverage

### 4. Run Tests

```bash
npm test
```

Ensure all tests pass and coverage meets thresholds.

### 5. Test Manually

Start the bridge and test real message flow:

```bash
npm start
```

- Send messages in Slack → verify in Mattermost
- Send messages in Mattermost → verify in Slack
- Test threads, edits, deletions
- Test file uploads
- Test markdown conversion

### 6. Commit Changes

```bash
git add .
git commit -m "feat: add new feature"
```

Use conventional commit messages:
- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation
- `test:` for tests
- `refactor:` for refactoring

### 7. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## Debugging

### Enable Verbose Logging

Add more console.log statements:

```javascript
console.log('Processing message:', message);
console.log('Channel mapping:', slackToMmChannelMap);
```

### Debug Redis Operations

Connect to Redis CLI:

```bash
redis-cli
> KEYS *                    # List all keys
> GET slack:C12345:123456   # Get specific value
> TTL slack:C12345:123456   # Check expiry time
> FLUSHALL                  # Clear all keys (careful!)
```

### Debug Slack Events

Use Slack's Event Subscriptions Request Log:
1. Go to https://api.slack.com/apps
2. Select your app
3. Navigate to "Event Subscriptions"
4. View request log at bottom

### Debug Mattermost WebSocket

Add logging to WebSocket events:

```javascript
ws.on('message', async (data) => {
  console.log('Raw WebSocket message:', data.toString());
  // ... rest of handler
});
```

### Use Node.js Inspector

```bash
node --inspect src/index.js
```

Then open `chrome://inspect` in Chrome and connect to the process.

## Common Development Tasks

### Adding a New Message Handler

1. **Create handler function** in appropriate file
   ```javascript
   // src/handlers/slack.js
   async function handleNewEvent(slackApp, mmApi, event) {
     // Implementation
   }
   ```

2. **Export function**
   ```javascript
   module.exports = {
     // ... existing exports
     handleNewEvent,
   };
   ```

3. **Register in main app**
   ```javascript
   // src/index.js
   const { handleNewEvent } = require('./handlers/slack');
   
   slackApp.event('event_type', async ({ event }) => {
     await handleNewEvent(slackApp, mmApi, event);
   });
   ```

4. **Write tests**
   ```javascript
   // __tests__/handlers/slack.test.js
   describe('handleNewEvent', () => {
     test('should handle event', async () => {
       // Test implementation
     });
   });
   ```

### Adding a New Utility Function

1. **Create function** in `src/utils/`
2. **Export function**
3. **Write tests** in `__tests__/utils/`
4. **Import and use** where needed

### Adding New Configuration

1. **Add to `.env.example`**
   ```env
   NEW_CONFIG_VAR=default_value
   ```

2. **Add to config object**
   ```javascript
   // src/config/environment.js
   const config = {
     // ... existing config
     newFeature: {
       setting: process.env.NEW_CONFIG_VAR || 'default',
     },
   };
   ```

3. **Write tests**
4. **Update documentation**

## Code Style Guidelines

### JavaScript Style

- Use `const` for constants, `let` for variables
- Prefer arrow functions for callbacks
- Use async/await over promises
- Add JSDoc comments for functions
- Keep functions under 50 lines
- Use meaningful variable names

### Example Function

```javascript
/**
 * Convert Slack markdown to Mattermost markdown
 * @param {string} text - The Slack markdown text
 * @returns {string} - Converted Mattermost markdown
 */
function convertSlackToMattermost(text) {
  if (!text) return text;
  
  let converted = text;
  // Conversion logic
  return converted;
}
```

### Testing Style

- One test file per source file
- Descriptive test names
- Arrange-Act-Assert pattern
- Mock external dependencies
- Test error cases

### Commit Messages

Follow conventional commits:

```
type(scope): subject

body

footer
```

Examples:
- `feat(handlers): add support for reactions`
- `fix(redis): handle connection timeout`
- `docs(api): update handler documentation`
- `test(markdown): add edge case tests`

## Troubleshooting

### Tests Failing

1. **Check environment variables** in test files
2. **Verify mocks** are set up correctly
3. **Clear module cache**: `jest --clearCache`
4. **Check console logs** for error details

### Redis Connection Issues

```bash
# Check if Redis is running
redis-cli ping

# Start Redis
# macOS: brew services start redis
# Linux: sudo service redis-server start
# Docker: docker start redis
```

### WebSocket Not Connecting

1. **Check Mattermost URL** in `.env`
2. **Verify token** is valid
3. **Check firewall** settings
4. **Test WebSocket endpoint** manually

### File Upload Failing

1. **Check file size** limits
2. **Verify API permissions**
3. **Check network connectivity**
4. **Review error logs**

## Performance Tips

### Local Development

- Use short Redis expiry (7 days)
- Limit number of channels
- Use local Mattermost instance if possible
- Enable debug logging selectively

### Testing

- Run specific test files during development
- Use `--watch` mode for active development
- Skip coverage during iteration

## Resources

- [Slack Bolt Documentation](https://slack.dev/bolt-js/)
- [Mattermost API Reference](https://api.mattermost.com/)
- [ioredis Documentation](https://github.com/luin/ioredis)
- [Jest Documentation](https://jestjs.io/)

## Getting Help

1. **Check documentation** in `docs/` folder
2. **Review existing issues** on GitHub
3. **Ask in discussions** on GitHub
4. **Create an issue** for bugs or features

## Contributing

See the main README.md for contribution guidelines.

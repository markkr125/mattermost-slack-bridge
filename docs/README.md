# Documentation Index

Welcome to the Mattermost-Slack Bridge documentation! This directory contains comprehensive guides to help you understand, develop, and deploy the bridge.

## 📖 Available Documentation

### [Architecture Documentation](architecture.md)
**Purpose**: Understanding the system design and how components work together

**Topics Covered**:
- System architecture overview and component diagram
- Module responsibilities and interactions
- Data flow for messages, files, and reactions
- Thread handling mechanism
- Redis storage strategy
- WebSocket connection management

**Audience**: Developers, system architects

---

### [API Reference](api.md)
**Purpose**: Detailed reference for all modules and their APIs

**Topics Covered**:
- Configuration module (`src/config/environment.js`)
- Storage module (`src/storage/redis.js`)
- Utility modules (`src/utils/markdown.js`, `src/utils/logger.js`)
- Handler modules (`src/handlers/slack.js`, `src/handlers/mattermost.js`, `src/handlers/reactions.js`)
- Function signatures and return types
- Usage examples for each module

**Audience**: Developers extending or integrating with the bridge

---

### [Development Guide](development.md)
**Purpose**: Setting up your development environment and contributing

**Topics Covered**:
- Local development setup
- Running tests and debugging
- Code organization patterns
- Development workflow
- Contributing guidelines
- Testing best practices

**Audience**: Contributors, developers

---

### [Deployment Guide](deployment.md)
**Purpose**: Deploying the bridge to production environments

**Topics Covered**:
- Infrastructure requirements
- Docker deployment
- Environment configuration
- Security considerations
- Monitoring and logging
- Troubleshooting production issues
- Scaling strategies

**Audience**: DevOps engineers, system administrators

---

### [Environment Variables Reference](environment-variables.md)
**Purpose**: Complete reference for all configuration environment variables

**Topics Covered**:
- Core configuration (Slack, Mattermost, server)
- Channel mapping configuration
- Storage backend options (Redis, in-memory)
- Logging and monitoring settings
- User mapping and identity customization
- Alerting and health checks
- Worker pools and performance tuning
- Presence synchronization settings
- Custom emoji synchronization
- Sharding configuration for distributed deployments
- Configuration examples for different scenarios

**Audience**: System administrators, DevOps engineers, developers

---

### [Custom Emoji Support](custom-emoji.md)
**Purpose**: Guide to Slack custom emoji synchronization

**Topics Covered**:
- Custom emoji detection and caching
- Configuration options for emoji sync
- Monitoring and troubleshooting
- Limitations and workarounds
- Best practices for emoji management

**Audience**: Developers, system administrators

---

### [Sharding Guide](sharding.md)
**Purpose**: Distributed deployment with sharding

**Topics Covered**:
- Sharding architecture and channel assignment
- Configuration for multi-instance deployments
- Docker Compose and Kubernetes examples
- Monitoring and operations
- Scaling guidelines and best practices
- Troubleshooting distributed deployments

**Audience**: DevOps engineers, system administrators

---

### [Usage Examples](usage-examples.md)
**Purpose**: Practical examples for using new features

**Topics Covered**:
- Worker pool usage for concurrent processing
- Performance monitoring and benchmarking
- Slash command examples
- Presence synchronization setup
- Production-ready configurations
- Troubleshooting common issues

**Audience**: Developers, system administrators

---

## 🚀 Quick Start Paths

### I want to understand how the bridge works
1. Start with [Architecture Documentation](architecture.md)
2. Review the data flow diagrams
3. Check [API Reference](api.md) for implementation details

### I want to contribute code
1. Read [Development Guide](development.md)
2. Check [Architecture Documentation](architecture.md) for context
3. Review existing code patterns in [API Reference](api.md)
4. See `.github/copilot-instructions.md` for project structure guidelines

### I want to deploy the bridge
1. Review [Deployment Guide](deployment.md)
2. Check Docker deployment options in main [README.md](../README.md)
3. Refer to [Architecture Documentation](architecture.md) for infrastructure understanding

### I want to troubleshoot issues
1. Check the troubleshooting section in main [README.md](../README.md)
2. Review [Deployment Guide](deployment.md) for production issues
3. Enable debug logging (see [Development Guide](development.md))

---

## 📁 Project Structure

```
mattermost-slack-bridge/
├── src/                        # Source code
│   ├── config/                 # Configuration management
│   ├── handlers/               # Message and reaction handlers
│   ├── storage/                # Redis storage layer
│   ├── utils/                  # Utility functions
│   └── index.js                # Application entry point
├── __tests__/                  # Test suites (mirrors src/ structure)
├── docs/                       # Documentation (you are here!)
│   ├── README.md               # This file
│   ├── architecture.md         # System design
│   ├── api.md                  # API reference
│   ├── development.md          # Development guide
│   ├── deployment.md           # Deployment guide
│   ├── environment-variables.md # Environment variable reference
│   └── usage-examples.md       # Feature usage examples
├── .github/                    # GitHub configuration
│   ├── workflows/              # CI/CD workflows
│   └── copilot-instructions.md # AI assistant guidelines
├── Dockerfile                  # Container image definition
├── docker-compose.yml          # Multi-container setup
└── README.md                   # Main project documentation
```

---

## 🔄 Documentation Updates

When making changes to the codebase:

1. **Update API Reference** if you modify function signatures or add new modules
2. **Update Architecture Documentation** if you change system design or add new components
3. **Update Development Guide** if you add new development tools or change workflows
4. **Update Deployment Guide** if you modify deployment requirements or procedures
5. **Update this index** if you add new documentation files

---

## 📝 Documentation Standards

### File Organization
- One topic per file
- Clear headings and table of contents
- Code examples with syntax highlighting
- Diagrams for complex concepts

### Writing Style
- Clear and concise language
- Use active voice
- Include practical examples
- Link to related sections

### Code Examples
- Use proper syntax highlighting (```javascript)
- Include comments for complex logic
- Show both input and output where relevant
- Keep examples focused and minimal

---

## 🤝 Contributing to Documentation

Found an issue or want to improve the docs?

1. Documentation follows the same PR process as code
2. Run spell check before submitting
3. Verify all links work correctly
4. Update this index if adding new documentation files
5. Follow the documentation standards above

See [Development Guide](development.md) for the full contribution workflow.

---

## 💡 Additional Resources

- **Main README**: [../README.md](../README.md) - Quick start and feature overview
- **GitHub Repository**: [markkr125/mattermost-slack-bridge](https://github.com/markkr125/mattermost-slack-bridge)
- **Issue Tracker**: Report bugs or request features
- **Slack API Docs**: [api.slack.com](https://api.slack.com/)
- **Mattermost API Docs**: [api.mattermost.com](https://api.mattermost.com/)

---

**Last Updated**: 2026-02-05

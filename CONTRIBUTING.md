# Contributing to Super Stream

Thank you for your interest in contributing to Super Stream! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors. We expect all participants to:

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

### Unacceptable Behavior

- Harassment, trolling, or discriminatory comments
- Publishing others' private information without permission
- Other conduct which could reasonably be considered inappropriate

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- Node.js v18 or higher
- MongoDB v5.0 or higher
- FFmpeg v4.4 or higher
- Git
- A code editor (VS Code recommended)

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/your-username/super-stream-app.git
   cd super-stream-app
   ```
3. Add the upstream repository:
   ```bash
   git remote add upstream https://github.com/original-owner/super-stream-app.git
   ```

## Development Setup

### Install Dependencies

```bash
npm install
```

### Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your development configuration.

### Start Development Server

```bash
npm run dev
```

The application will start with auto-reload enabled.

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- tests/unit/services/channelService.test.js

# Run with coverage
npm test -- --coverage
```

## Project Structure

```
super-stream-app/
├── src/
│   ├── config/          # Configuration files (database, logger, passport)
│   ├── controllers/     # Route controllers (handle HTTP requests)
│   ├── middleware/      # Express middleware (auth, error handling, security)
│   ├── models/          # Mongoose models (database schemas)
│   ├── routes/          # Express routes (URL mappings)
│   ├── services/        # Business logic (core functionality)
│   ├── utils/           # Utility functions (helpers, validators)
│   ├── views/           # EJS templates (frontend views)
│   └── index.js         # Application entry point
├── tests/
│   ├── unit/            # Unit tests
│   ├── properties/      # Property-based tests
│   └── integration/     # Integration tests
├── public/              # Static assets (CSS, JS, images)
├── uploads/             # Uploaded video files
└── logs/                # Application logs
```

### Key Directories

- **controllers/**: Handle HTTP requests, validate input, call services
- **services/**: Contain business logic, interact with models and external APIs
- **models/**: Define database schemas and data validation
- **middleware/**: Process requests before they reach controllers
- **utils/**: Reusable helper functions

## Coding Standards

### JavaScript Style Guide

We use ESLint and Prettier for code formatting. Configuration is in `.eslintrc.json` and `.prettierrc.json`.

#### General Rules

- Use `const` for variables that won't be reassigned, `let` otherwise
- Never use `var`
- Use arrow functions for callbacks
- Use async/await instead of callbacks or raw promises
- Use template literals instead of string concatenation
- Use destructuring when appropriate
- Add JSDoc comments for functions

#### Example

```javascript
/**
 * Creates a new YouTube broadcast
 * @param {string} channelId - The YouTube channel ID
 * @param {string} title - The broadcast title
 * @param {string} description - The broadcast description
 * @returns {Promise<Object>} The created broadcast object
 */
async function createBroadcast(channelId, title, description) {
  const channel = await Channel.findById(channelId);
  
  if (!channel) {
    throw new Error('Channel not found');
  }
  
  const broadcast = await youtubeApi.createBroadcast({
    title,
    description,
    channelId: channel.channelId,
  });
  
  return broadcast;
}
```

### Naming Conventions

- **Files**: camelCase (e.g., `channelService.js`)
- **Classes**: PascalCase (e.g., `class ChannelService`)
- **Functions**: camelCase (e.g., `function createBroadcast()`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `const MAX_RETRIES = 3`)
- **Private functions**: Prefix with underscore (e.g., `_validateInput()`)

### Error Handling

Always handle errors appropriately:

```javascript
// Good
try {
  const result = await someAsyncOperation();
  return result;
} catch (error) {
  logger.error('Operation failed', { error: error.message, stack: error.stack });
  throw new AppError('Failed to complete operation', 500);
}

// Bad
try {
  const result = await someAsyncOperation();
  return result;
} catch (error) {
  console.log(error); // Don't use console.log
  throw error; // Don't throw raw errors
}
```

### Logging

Use the configured logger, not `console.log`:

```javascript
const logger = require('../config/logger');

// Good
logger.info('Stream started', { streamId, channelId });
logger.error('Stream failed', { error: error.message });

// Bad
console.log('Stream started');
console.error('Stream failed', error);
```

## Testing Guidelines

### Test Structure

We use Jest for testing with three types of tests:

1. **Unit Tests**: Test individual functions and methods
2. **Property-Based Tests**: Test properties across many inputs using fast-check
3. **Integration Tests**: Test complete workflows

### Writing Unit Tests

```javascript
const { createBroadcast } = require('../services/broadcastService');
const Channel = require('../models/Channel');

describe('BroadcastService', () => {
  describe('createBroadcast', () => {
    it('should create a broadcast with valid inputs', async () => {
      // Arrange
      const channelId = 'channel123';
      const title = 'Test Stream';
      const description = 'Test Description';
      
      // Act
      const result = await createBroadcast(channelId, title, description);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.title).toBe(title);
      expect(result.description).toBe(description);
    });
    
    it('should throw error when channel not found', async () => {
      // Arrange
      const invalidChannelId = 'invalid';
      
      // Act & Assert
      await expect(
        createBroadcast(invalidChannelId, 'Title', 'Description')
      ).rejects.toThrow('Channel not found');
    });
  });
});
```

### Writing Property-Based Tests

```javascript
const fc = require('fast-check');

describe('Video Upload Properties', () => {
  it('Property 10: Video upload requires title and description', () => {
    // Feature: super-stream-app, Property 10: Video upload requires title and description
    // Validates: Requirements 4.2
    
    fc.assert(
      fc.property(
        fc.record({
          title: fc.constantFrom('', '   ', '\t\n'),
          description: fc.string(),
          channelId: fc.string(),
        }),
        async (invalidVideo) => {
          await expect(uploadVideo(invalidVideo)).rejects.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Test Coverage

- Aim for at least 80% code coverage
- All new features must include tests
- All bug fixes must include regression tests
- Run coverage report: `npm test -- --coverage`

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- channelService.test.js

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage

# Run only property tests
npm run test:properties
```

## Commit Guidelines

### Commit Message Format

Use conventional commit format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, no logic change)
- **refactor**: Code refactoring
- **test**: Adding or updating tests
- **chore**: Maintenance tasks

#### Examples

```
feat(channels): add support for channel statistics refresh

Implement automatic refresh of channel statistics from YouTube API
every 5 minutes. This ensures dashboard shows up-to-date metrics.

Closes #123
```

```
fix(scheduler): prevent concurrent scheduler execution

Add locking mechanism to prevent multiple scheduler instances
from running simultaneously, which was causing duplicate streams.

Fixes #456
```

```
docs(readme): update installation instructions for Windows

Add detailed steps for Windows users including FFmpeg installation
and PATH configuration.
```

### Commit Best Practices

- Write clear, descriptive commit messages
- Keep commits focused on a single change
- Reference issue numbers when applicable
- Use present tense ("add feature" not "added feature")
- Keep subject line under 72 characters

## Pull Request Process

### Before Submitting

1. **Update your fork**:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run tests**:
   ```bash
   npm test
   ```

3. **Run linter**:
   ```bash
   npm run lint
   ```

4. **Check formatting**:
   ```bash
   npm run format
   ```

### Creating a Pull Request

1. **Push to your fork**:
   ```bash
   git push origin feature/your-feature
   ```

2. **Create PR on GitHub**:
   - Go to the original repository
   - Click "New Pull Request"
   - Select your fork and branch
   - Fill in the PR template

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Property tests added/updated
- [ ] Integration tests added/updated
- [ ] All tests passing

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated

## Related Issues
Closes #(issue number)
```

### Review Process

1. Maintainers will review your PR
2. Address any requested changes
3. Once approved, your PR will be merged
4. Your contribution will be credited

## Reporting Bugs

### Before Reporting

1. Check existing issues
2. Verify it's reproducible
3. Test with latest version

### Bug Report Template

```markdown
**Describe the bug**
Clear description of the bug

**To Reproduce**
Steps to reproduce:
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen

**Actual behavior**
What actually happened

**Screenshots**
If applicable

**Environment**
- OS: [e.g., Windows 10, macOS 12, Ubuntu 20.04]
- Node.js version: [e.g., 18.0.0]
- MongoDB version: [e.g., 5.0.0]
- FFmpeg version: [e.g., 4.4.0]

**Logs**
Relevant log excerpts

**Additional context**
Any other relevant information
```

## Suggesting Features

### Feature Request Template

```markdown
**Is your feature request related to a problem?**
Clear description of the problem

**Describe the solution you'd like**
Clear description of desired solution

**Describe alternatives you've considered**
Alternative solutions or features

**Additional context**
Mockups, examples, or other context

**Implementation ideas**
If you have technical suggestions
```

## Development Tips

### Debugging

Use the VS Code debugger with this configuration (`.vscode/launch.json`):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Application",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/src/index.js",
      "envFile": "${workspaceFolder}/.env"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand"],
      "console": "integratedTerminal"
    }
  ]
}
```

### Useful Commands

```bash
# Check for outdated dependencies
npm outdated

# Update dependencies
npm update

# Security audit
npm audit

# Fix security issues
npm audit fix

# Clean install
rm -rf node_modules package-lock.json
npm install
```

## Questions?

If you have questions about contributing:

- Check existing documentation
- Search closed issues
- Open a discussion on GitHub
- Ask in the community chat (if available)

## Thank You!

Your contributions make this project better. We appreciate your time and effort!

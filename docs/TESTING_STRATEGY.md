# Testing Strategy

**Per R-5: Integration Testing**

## Overview

This document outlines the testing strategy for the `xivdyetools-discord-bot`, including unit tests, integration tests, and performance benchmarks.

## Test Structure

### Unit Tests
- **Location:** `src/**/*.test.ts` (alongside source files)
- **Purpose:** Test individual functions, commands, and services in isolation
- **Coverage:** Command logic, validators, utilities, services

### Integration Tests
- **Location:** `src/__tests__/integration/`
- **Purpose:** Test complete command execution workflows
- **Files:**
  - `command-flow.test.ts` - Individual command flows
  - `end-to-end-command.test.ts` - Complete command execution
  - `performance-benchmarks.test.ts` - Performance testing

## Test Categories

### 1. Command Flow Tests
Tests individual command execution:
- Match command with hex colors and dye names
- Harmony command with various harmony types
- Dye command information retrieval
- Error handling and validation

**Key Assertions:**
- Commands defer reply correctly
- Commands return properly formatted embeds
- Error messages are user-friendly
- Validation works correctly

### 2. End-to-End Command Tests
Tests complete command execution workflows:
- Full command execution from input to response
- Autocomplete workflows
- Error recovery
- Response quality

**Key Assertions:**
- Commands complete successfully
- Responses contain all required information
- Error recovery is graceful
- Performance targets are met

### 3. Performance Benchmarks
Tests performance targets:
- Command execution speed
- Color conversion performance
- Dye matching performance
- Harmony generation performance

**Key Assertions:**
- Match command: < 1500ms
- Harmony command: < 1000ms
- Color conversions: < 1ms
- Dye matching: < 10ms

## Running Tests

### All Tests
```bash
npm test
```

### Integration Tests Only
```bash
npm run test:integration
```

### Performance Benchmarks
```bash
npm run test -- src/__tests__/integration/performance-benchmarks.test.ts
```

### With Coverage
```bash
npm run test:coverage
```

### Watch Mode
```bash
npm run test:watch
```

## CI/CD Integration

Integration tests run automatically on:
- Push to `main` branch
- Pull requests to `main` branch
- Manual workflow dispatch

**Workflow:** `.github/workflows/integration-tests.yml`

**Steps:**
1. Checkout code
2. Setup Node.js
3. Install dependencies
4. Build project
5. Run integration tests
6. Run performance benchmarks
7. Generate coverage report
8. Upload coverage to Codecov

## Performance Targets

Based on optimization goals:

| Command | Target | Test |
|---------|--------|------|
| `/match` | < 1500ms | ✅ |
| `/harmony` | < 1000ms | ✅ |
| Color conversion | < 1ms | ✅ |
| Dye matching | < 10ms | ✅ |
| Harmony generation | < 50ms | ✅ |

## Coverage Goals

- **Unit Tests:** > 70% coverage
- **Integration Tests:** > 60% coverage
- **Overall:** > 65% coverage

## Mocking Strategy

### Discord Interactions
- Use Vitest mocks for `ChatInputCommandInteraction`
- Mock `deferReply`, `editReply`, `reply` methods
- Mock `options.getString`, `options.getInteger`

### External Services
- Mock Redis client (use in-memory fallback)
- Mock Discord.js client
- Mock emoji service

### Core Library
- Use actual `xivdyetools-core` library
- Test with real dye database
- Verify actual color calculations

## Best Practices

1. **Test Real User Scenarios**
   - Test complete command flows, not just isolated functions
   - Include both valid and invalid inputs
   - Test error recovery paths

2. **Performance Testing**
   - Test with realistic data
   - Measure actual execution times
   - Verify performance targets are met

3. **Response Quality**
   - Verify embeds are properly formatted
   - Check that all required information is included
   - Ensure error messages are user-friendly

4. **Error Handling**
   - Test validation errors
   - Test rate limit errors
   - Test network/service errors
   - Verify graceful degradation

## Future Enhancements

- [ ] Load testing with concurrent commands
- [ ] Memory leak detection
- [ ] Stress testing with high command volumes
- [ ] Real Discord API integration tests (with test bot)
- [ ] Visual regression testing (for embed formatting)

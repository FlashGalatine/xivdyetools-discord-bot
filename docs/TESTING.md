# Testing Strategy

**Per R-5: Integration Testing**

## Overview

This document describes the testing strategy for `xivdyetools-discord-bot`, including unit tests, integration tests, and performance benchmarks.

## Test Structure

### Unit Tests
- Located in: `src/**/__tests__/` and `src/**/*.test.ts`
- Purpose: Test individual functions, commands, and services in isolation
- Coverage: Commands, services, utilities, validators

### Integration Tests
- Located in: `src/__tests__/integration/`
- Purpose: Test complete command execution flows and end-to-end workflows
- Files:
  - `command-flow.test.ts` - Tests complete command execution flows
  - `performance-benchmarks.test.ts` - Performance and benchmark tests

## Running Tests

### All Tests
```bash
npm test
```

### Integration Tests Only
```bash
npm test -- src/__tests__/integration/
```

### Performance Benchmarks
```bash
npm test -- src/__tests__/integration/performance-benchmarks.test.ts
```

### With Coverage
```bash
npm test -- --coverage
```

### Watch Mode
```bash
npm run test:watch
```

## Test Coverage Goals

- **Unit Tests:** > 70% coverage
- **Integration Tests:** All command flows covered
- **Performance Tests:** All benchmarks passing

## Integration Test Scenarios

### Command Flow Tests
1. **Match Command**
   - Execute with hex color
   - Execute with dye name
   - Handle invalid input gracefully
   - Error handling without crashing
   - Response format validation
   - Performance within time limits

2. **Future Commands** (when refactored to CommandBase)
   - Harmony command flow
   - Dye command flow
   - Mixer command flow
   - Image matching command flow

### Performance Benchmarks
1. Color conversion performance
2. Dye matching performance
3. Harmony generation performance
4. Command execution performance
5. Memory usage monitoring

## Performance Targets

- **Color Conversion:** < 1ms per conversion
- **Dye Matching:** < 10ms per match
- **Harmony Generation:** < 50ms per harmony set
- **Command Execution:** < 2 seconds total
- **Memory Usage:** < 50MB increase for 1000 operations

## CI/CD Integration

Integration tests run automatically on:
- Push to `main` branch
- Pull requests
- Manual workflow dispatch

See `.github/workflows/integration-tests.yml` for configuration.

## Mocking Strategy

### Discord Interactions
- Use Vitest mocks for `ChatInputCommandInteraction`
- Mock all Discord.js methods (deferReply, editReply, etc.)
- Simulate user input and responses

### Services
- Mock Redis client for rate limiting and caching tests
- Mock external APIs (if any)
- Use in-memory fallbacks where possible

## Best Practices

1. **Test Isolation:** Each test should be independent
2. **Clear Assertions:** Use descriptive expect messages
3. **Performance Targets:** Set realistic but challenging targets
4. **Error Handling:** Test both success and failure paths
5. **Mock Management:** Clear mocks between tests

## Future Enhancements

- End-to-end Discord bot testing (with test Discord server)
- Load testing for concurrent command execution
- Security testing for input validation
- Rate limiting behavior testing
- Integration with external services (Redis, etc.)


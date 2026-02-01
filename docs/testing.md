# Testing Strategy

## Testing Pyramid

| Level | Coverage | Focus |
|-------|----------|-------|
| Unit Tests | 70% | Pure functions, business logic, validators |
| Integration Tests | 20% | API endpoints, database operations |
| E2E Tests | 10% | Critical user journeys |

## Unit Tests

- Pure business logic
- Data transformations
- Utility functions
- Validators
- Mock external dependencies
- Fast execution (milliseconds)

## Integration Tests

- API endpoints (request → response)
- Database operations (CRUD flows)
- Service-to-service communication
- Authentication/authorization flows
- External API integrations

## E2E Tests

- Cross-page workflows
- UI behavior and interactions
- Business acceptance criteria
- Visual regression tests

## Directory Structure

```
tests/
├── unit/           # Unit tests (70%)
├── integration/    # Integration tests (20%)
├── e2e/            # End-to-end tests (10%)
└── fixtures/       # Test data and mocks
```

## Mocking Guidelines

### Do Mock

- External APIs
- Databases (for unit tests)
- Time/dates
- Random values

### Don't Mock

- The code under test
- Simple data transformations
- Internal business logic

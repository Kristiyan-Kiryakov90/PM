# Coding Conventions

## General Principles
- Keep solutions simple and focused
- Avoid over-engineering
- Only add features that are requested
- Don't add unnecessary abstractions

## SOLID (Applied Pragmatically)
- **Single Responsibility**: One reason to change per module
- **Open/Closed**: Extend behavior without modifying source
- **Liskov Substitution**: Subtypes must be substitutable
- **Interface Segregation**: Small, focused interfaces
- **Dependency Inversion**: Depend on abstractions

## Functions
- Max 20-30 lines (guideline, not law)
- Single level of abstraction
- Early returns over nested conditionals
- Pure functions where possible

## JavaScript/React
- Use ES modules (import/export)
- Functional components with hooks
- Use arrow functions for component definitions
- Destructure props and state
- Keep components focused and single-purpose

## File Naming
- Components: PascalCase (e.g., `TaskList.jsx`)
- Utilities: camelCase (e.g., `apiHelper.js`)
- Constants: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`)
- Variables: descriptive, intention-revealing

## Backend Conventions
- Use async/await over callbacks
- Proper error handling with try/catch
- Use prepared statements for database queries
- Transaction wrapping for multi-step operations
- Validate input at controller level

## Frontend Conventions
- Use Redux for shared state
- Use local state for component-specific data
- Handle loading and error states
- Provide user feedback for actions
- Keep components under 300 lines when possible

## API Design
- RESTful endpoints
- Consistent response format: `{ success, data, error }`
- Use proper HTTP status codes
- Include error messages in responses


## Anti-Patterns to Avoid

| Pattern | Problem | Solution |
|---------|---------|----------|
| God objects | Too many responsibilities | Split into focused classes |
| Magic numbers | Unclear intent | Named constants |
| Deep nesting | Hard to follow | Early returns, extraction |
| Copy-paste | Maintenance nightmare | DRY via abstraction |
| Premature optimization | Wasted effort | Profile first, optimize second |

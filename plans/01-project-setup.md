# 01 - Project Setup & Dependencies

> **Status**: 🟡 Pending
> **Phase**: Phase 1 - Setup & Authentication
> **Dependencies**: None (First spec)

---

## 1. Overview

### Feature Description
Initialize the project foundation with npm, Vite build tool, Bootstrap UI framework, and all necessary dependencies. Configure the development environment, build system, and project structure.

### Goals
- Set up npm project with proper package.json configuration
- Install and configure Vite for fast development and optimized builds
- Integrate Bootstrap 5 for responsive UI components
- Create organized folder structure following project conventions
- Configure .gitignore for clean version control
- Set up development scripts for local testing

### User Value Proposition
Provides a solid, maintainable foundation for rapid development with modern tooling and best practices.

### Prerequisites
- [ ] Node.js 18+ installed
- [ ] npm 9+ installed
- [ ] Git initialized in project root
- [ ] Code editor (VS Code recommended)

---

## 2. User Stories & Acceptance Criteria

### User Stories

**As a** developer
**I want to** have a properly configured build system
**So that** I can develop features efficiently with hot reload and fast builds

**As a** developer
**I want to** use modern tooling (Vite, Bootstrap)
**So that** I can write clean code without wrestling with legacy build systems

### Acceptance Criteria

- [ ] `npm install` runs successfully without errors
- [ ] `npm run dev` starts development server on localhost
- [ ] Hot module replacement (HMR) works for HTML/CSS/JS changes
- [ ] Bootstrap CSS and JS available globally
- [ ] Folder structure matches CLAUDE.md specifications
- [ ] .gitignore excludes node_modules, .env, and build artifacts
- [ ] package.json has correct project metadata

### Definition of Done

- [ ] All dependencies installed
- [ ] Dev server runs without errors
- [ ] Folder structure created
- [ ] .gitignore configured
- [ ] Initial commit made
- [ ] README.md updated with setup instructions

### Success Metrics

| Metric | Target |
|--------|--------|
| Dev server start time | < 3 seconds |
| HMR update time | < 500ms |
| Build success rate | 100% |

---

## 3. Database Requirements

### Tables Needed

**None** - This spec covers project setup only, no database changes.

---

## 4. Backend/Service Layer

**None** - No backend services in this spec. Service layer will be created in subsequent specs.

---

## 5. Frontend/UI Implementation

### Folder Structure to Create

### package.json Configuration

### vite.config.js Configuration

### .env.example Template

### Initial index.html Structure

### src/js/main.js

### src/css/styles.css

---

## 6. Security Considerations

### .gitignore Configuration

### Security Notes

- [ ] Never commit .env file with credentials
- [ ] Use .env.example as template without real credentials
- [ ] Keep dependencies up to date for security patches
- [ ] Review Bootstrap version for known vulnerabilities

---

## 7. Implementation Steps

- [ ] Outline database changes (tables, indexes, RLS)
- [ ] Define service layer functions and error handling
- [ ] Describe UI updates and required pages/components
- [ ] List integration touchpoints and config updates
- [ ] Note validation and edge cases to handle

---

## 9. Related Specs

### Dependencies (Must Complete First)

**None** - This is the first spec and has no dependencies.

### Depends On This (Blocked Until Complete)

- [02-supabase-setup.md](./02-supabase-setup.md) - Needs npm project to install Supabase SDK
- [03-database-schema.md](./03-database-schema.md) - Needs migrations folder structure
- [04-authentication.md](./04-authentication.md) - Needs HTML structure and Bootstrap

### Related Features (Integration Points)

- All subsequent specs depend on this foundation

### Documentation References

- [CLAUDE.md](../CLAUDE.md) - Project structure requirements
- [Project Summary](../ai-docs/project-summary.md) - Tech stack decisions
- [Coding Conventions](../ai-docs/coding-conventions.md) - File naming conventions

---

## Appendix

### Useful Resources

- [Vite Documentation](https://vitejs.dev/) - Build tool configuration
- [Bootstrap 5 Documentation](https://getbootstrap.com/docs/5.3/) - UI components
- [npm Documentation](https://docs.npmjs.com/) - Package management

### Notes & Considerations

- Vite uses ES modules by default (type: "module" in package.json)
- Bootstrap 5 doesn't require jQuery
- Use CDN for Bootstrap to avoid bundle size increase
- Keep .env separate for local development vs production

### Future Enhancements

- [ ] Add ESLint for code linting
- [ ] Add Prettier for code formatting
- [ ] Consider adding Sass for advanced CSS features
- [ ] Add environment-specific configs (dev/staging/production)

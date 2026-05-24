# Medical QC Manager - Agent Guidelines

This file provides instructions for agentic coding agents working on this repository.

## Build, Lint, and Test Commands

### Available Scripts
From `package.json`:

- `npm run dev` - Start development server with `tsx server.ts`
  - Runs Vite frontend dev server with HMR
  - Runs Express backend with tsx for TypeScript execution
  - Accessible at http://localhost:3000

- `npm run build` - Build for production:
  - `vite build` (frontend) - Compiles React app to static assets in /dist
  - `esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs` (backend)
  - Creates production-ready bundle in /dist directory

- `npm start` - Run built application: `node dist/server.cjs`
  - Serves the production build
  - Frontend assets served from /dist
  - API routes handled by the bundled server

- `npm run preview` - Preview production build: `vite preview`
  - Serves the built frontend for preview purposes
  - Uses Vite's preview server to simulate production environment

- `npm run clean` - Remove dist directory: `rm -rf dist`
  - Cleans build artifacts
  - Useful before rebuilding to ensure clean state

- `npm run lint` - Type checking only: `tsc --noEmit`
  - Performs TypeScript type checking without emitting files
  - No ESLint or Prettier currently configured
  - Checks for type errors across all .ts and .tsx files

### Running Tests
No test framework is currently configured in this repository. When tests are added, you can run them with:

#### Single Test Execution
- With Jest: `npm test -- --testNamePattern="test name"`
  - Runs tests matching the provided name pattern
  - Use quotes around the pattern for exact matching

- With Vitest: `npx vitest run --testNamePattern="test name"`
  - Fast Vite-native test runner
  - Supports filtering by test name pattern

- With Mocha: `npm test -- --grep="test pattern"`
  - Uses grep to filter tests by pattern
  - Supports regular expressions in the pattern

#### Test File Conventions (when implemented)
- Test files should be placed alongside source files
- Naming convention: `[filename].test.ts` or `[filename].spec.ts`
- Example: `src/components/QCForm.test.tsx`

## Code Style Guidelines

### TypeScript Conventions
- Use strict TypeScript with `tsconfig.json` configuration
- Prefer interfaces over types for object shapes (except for union/types)
- Use type assertions sparingly and with clear justification (prefer type guards)
- Enable `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, and other strict options
- Avoid `any` type; use `unknown` when type is uncertain and narrow it
- Use `readonly` arrays and tuples when appropriate
- Prefer `const` over `let` for variables that don't reassigne

### Import Organization
Follow this order with blank line between groups:
1. External libraries (React, express, zod, etc.)
   - Sort alphabetically: `@types/`, then library name
2. Internal utilities and helpers (from src/ or relative paths)
3. Component imports (for React components)
4. Styles and assets (CSS, images, etc.)
- Sort alphabetically within each group
- Use path aliases where configured (none currently configured)
- Relative imports use `./` or `../` prefixes
- Never use wildcard imports (`import * as`) unless necessary

### Formatting
- Use 2-space indentation (standard for TypeScript/JavaScript)
- Prefer double quotes for strings (except in JSX where single quotes are common)
- Trailing commas on multi-line objects/arrays and function parameters
- Semicolons required at end of statements
- Maximum line length: 100 characters (flexible for readability)
- No ESLint/Prettier config yet; follow existing code patterns
- Blank lines:
  - Between import groups
  - Between logical sections in functions
  - Before return statements
  - Between class members (methods, properties)

### Naming Conventions
- Components: PascalCase (e.g., `QCForm`, `HospitalStats`)
- Functions and variables: camelCase (e.g., `handleSubmit`, `isLoading`)
- Constants: UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`, `API_BASE_URL`)
- Types and interfaces: PascalCase (e.g., `QCItem`, `SubmitFormData`)
- Files: 
  - kebab-case for components (.tsx) - `qc-form.tsx`
  - camelCase for utilities and hooks (.ts) - `useQCValidation.ts`
  - PascalCase for context providers (.tsx) - `QCContext.tsx`
- Acronyms and initialisms: 
  - 2 letters: uppercase (ID, URL)
  - 3+ letters: PascalCase (XmlHttpRequest becomes XmlHttpRequest)

### Error Handling
- Use try/catch for async operations (especially API calls)
- Validate inputs with Zod schemas (already implemented in server.ts)
- Provide meaningful, user-friendly error messages to users
- Log errors server-side with console.error for debugging (include context)
- Don't expose internal error details (stack traces, DB errors) to clients
- Use error boundaries in React for graceful UI degradation
- Handle loading states explicitly in UI (show spinners/skeletons)
- Consider using result types or either-pattern for complex error handling

### React Specific
- Use functional components with hooks (useState, useEffect, useContext)
- Prefer `useState` for local state, `useContext` or state management for shared state
- Memoize expensive computations with `useMemo` and `useCallback`
  - Dependency arrays must be exhaustive
  - Use `useCallback` for event handlers passed as props
- Key props should be stable and predictable (use IDs, not indices)
- Handle loading and error states in UI (show appropriate feedback)
- Use proper TypeScript for component props (define interfaces)
- Split large components into smaller, focused ones
- Custom hooks for reusable logic (naming: use[LogicName])
- Fragments (`<>...</>`) when no extra wrapper element needed
- Avoid inline object/function creation in render (causes unnecessary re-renders)

### Database Operations
- Use parameterized queries to prevent SQL injection (always use placeholders)
- Wrap related operations in transactions for data consistency
- Handle database errors gracefully (try/catch around db operations)
- Close connections properly (better-sqlite3 manages this automatically)
- Use PRAGMA statements for performance optimization when needed
- Consider connection pooling for high-scale applications (not needed here)
- Migrations should be backward-compatible when possible

### Security
- Validate all user inputs (Zod validation in server.ts for API endpoints)
- Use parameterized queries for database operations (prepared statements)
- Implement proper CORS policies (currently allows all origins - restrict in prod)
- Sanitize outputs to prevent XSS (React auto-escapes, be careful with dangerouslySetInnerHTML)
- Use environment variables for secrets (never commit .env files)
- Implement rate limiting on public APIs (to be added)
- Use HTTPS in production (handled by reverse proxy)
- Regularly update dependencies to patch vulnerabilities

### Performance
- Lazy load components when appropriate (React.lazy + Suspense)
- Use React.memo for expensive re-renders (shallow prop comparison)
- Optimize database queries with proper indexing (add indexes as needed)
- Consider pagination for large datasets (implement limit/offset)
- Minimize re-renders with proper state management (split state logic)
- Use useEffect cleanup functions to prevent memory leaks
- Debounce/throttle expensive operations (search, resize handlers)
- Optimize images and assets (use appropriate formats, compress)
- Bundle analysis: use `vite build --mode analyzer` to check bundle size

## Current Project Structure
```
medical-qc-manager/
├── src/                    # Frontend React application source
│   ├── App.tsx             # Main React application component
│   │   - Contains routing, state management, and UI layout
│   │   - Implements form submission, validation, and stats display
│   ├── index.css           # Global styles and CSS variables
│   │   - Defines color scheme, typography, and base styles
│   │   - Includes custom scrollbar styles and animations
│   └── main.tsx            # React entry point
│       - Renders <App /> into DOM root
│       - Sets up React StrictMode for development
├── server.ts               # Express/Vite backend server
│   - Initializes SQLite database with schema
│   - Seeds initial QC configuration data
│   - Defines REST API endpoints (/api/*)
│   - Serves frontend static assets in production
│   - Integrates Vite middleware for HMR in development
├── package.json            # Project dependencies and scripts
│   - Lists frontend (React, etc.) and backend (Express, etc.) deps
│   - Defines npm scripts for dev, build, start, etc.
│   - Specifies TypeScript version and type definitions
├── tsconfig.json           # TypeScript compiler configuration
│   - Enables strict mode, JSX support, ES module target
│   - Configures paths and module resolution
├── vite.config.ts          # Vite frontend build configuration
│   - Configures React plugin, server port, build options
│   - Sets up Tailwind CSS integration via plugin
└── .env.example            # Example environment variables
    - Template for required configuration values
    - Copy to .env and fill in actual values
```

## API Endpoints
Defined in server.ts with Zod validation:

### GET `/api/qc-config`
- Retrieve QC configuration for the form
- Returns array of QC items with their associated problems
- Used on app load to populate the quality control checklist
- Response: `[{ id, item_name, problems: [{ id, problem_code, problem_desc, is_custom_required }] }]`
- No parameters required
- Caching: Not implemented (could add ETag/Last-Modified)

### POST `/api/qc-cases`
- Submit a completed QC case with metadata and selections
- Expects JSON body matching Zod schema:
  ```ts
  {
    metadata: {
      hospital_name: string,
      medical_record_no: string,
      patient_status?: number,
      death_reason?: string,
      surgery_level?: number,
      main_diagnosis?: string,
      main_operation?: string,
      main_surgery?: string,
      expert_name: string,
      has_defects?: number
    },
    details: Array<{
      item_id: number,
      selected_problems: Array<{
        problem_id: number,
        custom_text?: string
      }>
    }>
  }
  ```
- Stores case in qc_cases table and results in qc_results table
- Returns `{ success: true, caseId: number }` on success
- Validation errors return 400 with Zod error details
- Database errors return 500 with generic error message

### GET `/api/stats/hospitals`
- Get hospital statistics for the analytics view
- Returns array of objects with hospital names and case counts
- Response: `[{ hospital_name: string, count: number }]`
- Ordered by count descending (most cases first)
- Used to populate the hospital statistics cards
- No parameters required

### GET `/api/export`
- Export all QC case data as CSV file
- Returns CSV with UTF-8 BOM for Excel compatibility
- Columns: Hospital Name, Medical Record Number, Patient Status, Death Reason,
          Surgery Level, Main Diagnosis, Main Surgery, Main Operation,
          Expert Name, Has Defects Text, Created At, QC Item, Problem Description,
          Custom Content
- Uses LEFT JOINs to include cases even without QC results
- Ordered by case ID descending (newest first), then item ID ascending
- Triggers file download with filename "qc_export.csv"
- No parameters required
- Performance: May need pagination for very large datasets

## Environment Variables
Reference `.env.example` for required variables. Create `.env` file in root directory.

### Required Variables
- `VITE_API_BASE_URL` - Base URL for API calls (defaults to relative in dev)
- `NODE_ENV` - Environment mode: development, production, or test
- `PORT` - Server port (defaults to 3000)
- `DB_PATH` - Path to SQLite database file (defaults to ./qc_system.db)

### Development
- Copy `.env.example` to `.env` and adjust values as needed
- Vite prefixes client-side env vars with `VITE_` for exposure to frontend
- Never commit `.env` file to version control
- Use different env files for different environments (.env.dev, .env.prod)

### Production
- Set environment variables through hosting platform
- Ensure sensitive values are kept secret
- Consider using a secrets manager or encrypted storage

## Development Workflow

### Getting Started
1. Clone repository
2. Run `npm install` to install dependencies
3. Copy `.env.example` to `.env` and configure if needed
4. Run `npm run dev` to start development server
5. Open http://localhost:3000 in browser

### Making Changes
1. Create feature branch from main: `git checkout -b feature/your-feature-name`
2. Make changes following code style guidelines
3. Test changes locally with `npm run dev`
4. Lint code with `npm run lint` (when configured)
5. Commit changes with descriptive messages
6. Push branch and open pull request

### Database Changes
- Schema modifications go in server.ts initialization
- Consider adding migration system for production deployments
- Seed data modifications affect all instances (use with caution)
- Backup database before making structural changes

### Frontend Development
- Components go in src/ directory
- Use Tailwind CSS for styling (already configured)
- Follow existing component patterns in App.tsx
- Use Lucide React icons for consistency
- Implement loading states for async operations
- Handle errors gracefully with user-friendly messages

### Backend Development
- API endpoints in server.ts
- Use Zod for request validation
- Use parameterized queries for database operations
- Wrap related DB operations in transactions
- Log errors appropriately for debugging
- Consider separating routes into modules as API grows

## Common Tasks

### Adding a New QC Item/Problem
1. Edit the `items` array in server.ts seed data section
2. Add new object with `name` and `problems` array
3. Each problem needs `code`, `desc`, and optional `custom` flag
4. Restart server to reseed database (forceRefresh: true)
5. Frontend will automatically pick up changes via /api/qc-config

### Modifying Validation Rules
1. Update Zod schema in POST `/api/qc-cases` handler
2. Adjust validation logic in handleSubmit function in App.tsx
3. Ensure client and server validation match
4. Add/update error messages as needed
5. Test with valid and invalid inputs

### Styling Updates
1. Modify index.css for global style changes
2. Use Tailwind utility classes in JSX for component-specific styles
3. Follow existing color scheme and spacing conventions
4. Test responsive behavior at different breakpoints
5. Consider dark mode support for future enhancement

### Performance Optimization
1. Identify expensive computations in render cycles
2. Apply useMemo/useCallback where appropriate
3. Consider React.memo for components with stable props
4. Optimize database queries with EXPLAIN ANALYZE
5. Add indexes to frequently queried columns
6. Implement pagination for large result sets
7. Lazy load non-critical components and routes

## Contributing
Follow the existing code patterns and conventions. When in doubt, look at similar code in the repository for guidance.

### Pull Request Process
1. Fork the repository and create your branch
2. Make your changes following these guidelines
3. Ensure code lints and builds successfully
4. Update documentation if needed
5. Submit pull request with clear description
6. Address review feedback promptly
7. Keep branch updated with main branch

### Code Review Guidelines
- Look for adherence to TypeScript best practices
- Verify proper error handling and validation
- Check for security vulnerabilities
- Ensure performance considerations are addressed
- Confirm following of established patterns
- Test changes manually when possible
- Provide constructive, specific feedback

### Reporting Issues
- Use clear, descriptive titles
- Include steps to reproduce for bugs
- Suggest expected behavior vs actual behavior
- Add screenshots or screen recordings when helpful
- Label appropriately (bug, enhancement, question, etc.)

### Licensing
By contributing, you agree that your contributions will be licensed under the project's license.

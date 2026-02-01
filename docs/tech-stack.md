# Technology Stack

> **Capstone Project**: Software Technologies with AI (SoftUni AI)

## Frontend

- **Languages**: HTML5, CSS3, JavaScript (ES6+)
- **Build Tool**: Vite
- **UI Framework**: Bootstrap 5
- **Module System**: ES Modules (type: "module")
- **Navigation**: Multi-page (separate HTML files)

## Backend

- **Backend-as-a-Service**: Supabase
- **Database**: Supabase PostgreSQL
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage (file uploads)
- **Real-time**: Supabase Realtime (optional)
- **API**: Supabase REST API & JavaScript Client

## Development

- **Package Manager**: npm
- **Build Tool**: Vite
- **Dev Server**: Vite Dev Server
- **Module System**: ES Modules (type: "module")
- **Linting**: ESLint (optional)
- **Formatting**: Prettier (optional)

## Deployment

- **Hosting**: Netlify / Vercel
- **Backend**: Supabase Cloud
- **Domain**: Custom domain or platform subdomain

## Architecture

- **Pattern**: Multi-page application with modular components
- **Structure**: Separate files for pages, services, utils
- **Navigation**: Traditional page navigation (not SPA)
- **Data Flow**: Supabase Client → UI Components
- **State Management**: Browser localStorage + Supabase real-time

## Project Structure

```
project-root/
├── frontend/                   # All frontend code
│   ├── package.json            # Frontend dependencies
│   ├── package-lock.json
│   ├── node_modules/
│   ├── vite.config.js          # Vite configuration
│   ├── .env                    # Supabase credentials
│   ├── public/                 # HTML pages
│   │   ├── index.html          # Landing page
│   │   ├── login.html          # Login page
│   │   ├── register.html       # Register page
│   │   ├── dashboard.html      # Main dashboard
│   │   ├── projects.html       # Projects list
│   │   ├── tasks.html          # Task board/list
│   │   └── admin.html          # Admin panel
│   └── src/
│       ├── js/
│       │   ├── services/       # Supabase service modules
│       │   └── utils/          # Utility functions
│       ├── css/
│       │   └── styles.css      # Custom styles
│       └── assets/             # Images, icons
├── backend/                    # All backend code
│   └── database/
│       └── migrations/         # Database schema scripts
├── tests/                      # Test files
├── ai-docs/                    # Technical documentation
├── .github/
│   └── copilot-instructions.md
├── .gitignore                  # Git ignore rules
└── README.md                   # Project documentation
```

**IMPORTANT: All npm commands run from `frontend/` directory.**


## Database Schema (Supabase)

### Tables (Minimum 4)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| users | User accounts (Supabase Auth) | id, email, role, created_at |
| projects | Project containers | id, name, description, owner_id, created_at |
| tasks | Task items | id, title, description, status, priority, project_id, assignee_id, due_date |
| attachments | File references | id, task_id, file_name, file_url, uploaded_by, created_at |

### Relationships

- `projects.owner_id` → `users.id`
- `tasks.project_id` → `projects.id`
- `tasks.assignee_id` → `users.id`
- `attachments.task_id` → `tasks.id`
- `attachments.uploaded_by` → `users.id`

## Design Rationale

| Technology | Reason |
|------------|--------|
| Vite | Fast development server, modern build tool, simple setup |
| Bootstrap 5 | Responsive design system, ready-to-use components, no custom CSS needed |
| Supabase | Complete backend solution, no server code needed, built-in auth and storage |
| Multi-page | Simple navigation, SEO-friendly, meets assignment requirements |
| ES Modules | Modern JavaScript, clean imports, better code organization |

## Assignment Compliance

| Requirement | Implementation |
|-------------|----------------|
| HTML, CSS, JavaScript | ✅ No frameworks (React/Vue) |
| Vite + Bootstrap | ✅ Using Vite and Bootstrap 5 |
| Supabase Backend | ✅ Database, Auth, Storage |
| Multi-page Navigation | ✅ Separate HTML files per page |
| Modular Design | ✅ Services, utils, components |
| 5+ App Screens | ✅ 6 pages planned |
| 4+ DB Tables | ✅ 4 tables (users, projects, tasks, attachments) |
| Authentication | ✅ Supabase Auth (register/login/logout) |
| Admin Panel | ✅ Separate admin.html with role checks |
| File Storage | ✅ Supabase Storage for attachments |
| Deployment | ✅ Netlify/Vercel deployment |

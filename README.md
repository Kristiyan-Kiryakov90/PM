# TaskFlow - Task & Project Management Application

## 1. Project Topic, Scope, Description & Goal

### Topic
**TaskFlow** is a comprehensive task and project management application designed for small to medium-sized teams to collaborate, organize, and track their work efficiently.

### Scope
TaskFlow provides a complete solution for:
- Multi-tenant project management with company-based organization
- Task tracking with advanced workflow management
- Real-time collaboration and communication
- Team member management with role-based access control
- Comprehensive analytics and reporting
- Time tracking and productivity monitoring

### Description
TaskFlow is a modern, feature-rich task management platform built with vanilla JavaScript and Vite. It enables teams to:
- Organize work across multiple projects and spaces
- Track tasks through custom workflow statuses
- Collaborate in real-time with comments, mentions, and activity logs
- Monitor productivity with time tracking and analytics
- Manage team members with granular permission levels

### Goal
To provide a lightweight, efficient, and user-friendly alternative to enterprise project management tools, enabling small teams to:
- Increase productivity and visibility
- Improve team collaboration and communication
- Track project progress and team performance
- Maintain data security with role-based access control
- Scale effortlessly as the team grows

---

## 2. App Features

### Core Features
- **Project Management**
  - Create, edit, and delete projects
  - Organize projects with spaces
  - Set project status (active, paused, archived)
  - Track project duration with start/end years
  

- **Task Management**
  - Full CRUD operations on tasks
  - Assign tasks to team members
  - Set priorities (low, medium, high)
  - Kanban board view with drag-and-drop
  - Custom workflow statuses
  - Subtasks and checklists for detailed task breakdown

- **Collaboration Features**
  - Threaded comments with @mentions
  - Action items within comments
  - Real-time activity log tracking all changes
  - Notification system for assignments and mentions
  

- **Time Tracking**
  - Manual time entry creation
  - Prevent overlapping timers
  - Total time aggregation per task/user

- **Organization & Tagging**
  - Create and assign tags/labels to tasks
  - Admin-only tag creation
  - Filter tasks by tags
  - Tag usage analytics

- **Analytics & Reporting**
  - Task completion metrics
  - Status and priority distribution
  - Overdue task identification
  - Time tracking summary reports
  - Team productivity metrics
  - PDF export functionality
  - Date range and project-based filtering

- **Team Management**
  - Company-based team organization
  - Two role levels: admin, user
  - Admin panel for team member management
  - User management and role assignment

- **Dashboard**
  - Overview widgets showing key metrics
  - Recent activity feed
  - Quick access to projects and tasks
  - Personalized user information

---

## 3. Technologies, Stack & Architecture

### Technology Stack

#### Frontend
- **Framework**: Vanilla JavaScript (ES6+)
- **Build Tool**: Vite
- **UI Framework**: Bootstrap 5
- **Styling**: CSS3
- **Real-time Updates**: Supabase Realtime
- **Testing**: Vitest with Playwright

#### Backend
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth (JWT-based)
- **Real-time Database**: Supabase Realtime subscriptions
- **Edge Functions**: Deno-based serverless functions
- **API**: RESTful API (Supabase PostgREST)

#### Infrastructure
- **Hosting**: Supabase Cloud
- **CDN**: Supabase CDN for static assets
- **Database Migrations**: Custom SQL migrations

### Architecture Overview

#### Multi-Page Application (MPA) Structure
```
Frontend Root (frontend/ with Vite)
├── HTML Pages (Vite entry points - processed by build)
│   ├── index.html (Landing/Bootstrap)
│   ├── signin.html (Authentication)
│   ├── signup.html (Registration)
│   ├── dashboard.html (User Overview)
│   ├── projects.html (Project Management)
│   ├── tasks.html (Task Board)
│   ├── admin.html (Admin Panel)
│   ├── profile.html (User Profile)
│   └── reports.html (Analytics)
├── src/features/ (Feature-based modules)
│   ├── landing/           # Landing page feature
│   ├── auth/              # Auth pages (signin, signup)
│   ├── projects/          # Project management
│   ├── tasks/             # Task board
│   ├── dashboard/         # Dashboard
│   ├── admin/             # Admin panel
│   ├── reports/           # Analytics
│   ├── comments/          # Comments system
│   ├── time-tracking/     # Time tracking
│   └── notifications/     # Notifications
├── src/shared/ (Shared across features)
│   ├── services/          # API/business logic
│   ├── components/        # Reusable components
│   ├── utils/             # Helper functions
│   └── constants/         # Enums & constants
├── src/styles/ (CSS organization)
│   ├── global/            # Bootstrap, variables
│   ├── shared/            # Component CSS
│   └── features/          # Feature-specific CSS
└── src/assets/            # Static files
```

#### Multi-Tenant Architecture
- **Company-based Isolation**: Each company operates independently
- **Row-Level Security (RLS)**: PostgreSQL RLS policies enforce data isolation
- **Role-Based Access Control (RBAC)**: Three-tier permission model
  - `sys_admin`: System-level administration - only one for the app
  - `admin`: Company-level administration
  - `user`: Standard team member

#### Authentication Flow
1. User registers/signs in via Supabase Auth
2. JWT token stored in browser
3. All API requests include JWT in Authorization header
4. RLS policies validate user access at database level

#### Real-time Communication
- Supabase Realtime subscriptions for live updates
- Event-driven architecture for state synchronization
- Automatic notifications on task/comment updates

---

## 4. App Development Processes

### Planning & Design Phase
1. **Requirements Gathering**: Identified core features for MVP
2. **Database Schema Design**: Normalized PostgreSQL schema with proper relationships
3. **User Story Creation**: Defined user workflows and interactions
4. **Wireframing**: Designed UI layouts and user flows
5. **Architecture Design**: Planned multi-tenant, multi-page architecture

### Development Steps

#### Phase 1: Core Foundation
- **1A: Spaces** - Organize projects into logical spaces
- **1B: Custom Statuses** - Support custom workflow statuses per company
- **1C: Subtasks & Checklists** - Task decomposition capabilities
- **1D: Dashboard** - User overview and quick metrics
- **1E: Sidebar** - Navigation and project tree

#### Phase 2: Collaboration
- **2A: Comments & Mentions** - Threaded discussions with @mentions
- **2B: Activity Log** - Automatic change tracking with PostgreSQL triggers
- **2C: Notifications** - Real-time notifications for assignments and mentions
- **2D: Team Members** - Team member management and organization

#### Phase 3: Advanced Features
- **3A: Time Tracking** - Timer and manual time entry tracking
- **3B: Tags/Labels** - Flexible task organization
- **3C: Reports & Analytics** - Comprehensive analytics dashboard

#### Phase 4: Optimization
- **N+1 Query Fixes**: 51 queries → 1 RPC (51x reduction for tag counts)
- **CLS Optimization**: Layout shift score 0.29 → <0.05 (83% improvement)
- **Performance Tuning**: Parallel data loading, lazy loading, caching

#### Phase 5: Refactoring
- **Service Standardization**: All 20 services converted to object pattern
- **Utility Standardization**: All 7 utils converted to object pattern
- **Feature-Based Organization**: All 17 page scripts moved to feature folders
- **CSS Reorganization**: 33 CSS files organized by feature

### Development Workflow
- **Version Control**: Git with feature branching
- **Code Organization**: Feature-based folder structure
- **Naming Conventions**: camelCase for functions, kebab-case for files
- **Code Review**: Manual review of pull requests
- **Documentation**: Inline comments for complex logic

### Testing Strategy

#### Unit Tests
- Service layer testing with Vitest
- Database query validation
- Business logic verification

#### Integration Tests
- API endpoint testing with Playwright
- CRUD operation validation
- Permission and RLS policy testing

#### E2E Tests
- User workflow validation
- Multi-page navigation testing
- Real-time feature testing


## 5. Project Structure

```
PM/
├── frontend/                          # Frontend application (Vite root)
│   ├── src/
│   │   ├── features/                 # Feature-based modules
│   │   │   ├── projects/
│   │   │   │   ├── pages/            # Page scripts (tasks.js, dashboard.js, etc.)
│   │   │   │   ├── services/         # Business logic
│   │   │   │   ├── components/       # UI components
│   │   │   │   └── styles/           # Feature CSS
│   │   │   ├── tasks/
│   │   │   ├── comments/
│   │   │   ├── time-tracking/
│   │   │   ├── notifications/
│   │   │   ├── reports/
│   │   │   ├── landing/
│   │   │   ├── auth/
│   │   │   ├── admin/
│   │   │   ├── dashboard/
│   │   │   └── ...
│   │   ├── shared/                   # Shared across features
│   │   │   ├── services/             # Service layer (project, task, etc.)
│   │   │   ├── components/           # Shared components (navbar, sidebar)
│   │   │   ├── utils/                # Utility functions (auth, validation)
│   │   │   └── constants/            # Constants and enums
│   │   ├── styles/                   # Global & shared styles
│   │   │   ├── global/               # Global CSS (bootstrap, variables)
│   │   │   ├── shared/               # Shared component CSS
│   │   │   └── features/             # Feature-specific CSS
│   │   └── assets/                   # Images, icons, static files
│   ├── public/                        # Static files served as-is
│   ├── index.html                     # Landing/bootstrap page (Vite entry)
│   ├── dashboard.html                 # Dashboard page (Vite entry)
│   ├── projects.html                  # Projects page (Vite entry)
│   ├── tasks.html                     # Tasks board page (Vite entry)
│   ├── admin.html                     # Admin panel page (Vite entry)
│   ├── profile.html                   # User profile page (Vite entry)
│   ├── signin.html                    # Sign in page (Vite entry)
│   ├── signup.html                    # Registration page (Vite entry)
│   ├── reports.html                   # Reports page (Vite entry)
│   ├── tests/                         # Test files
│   │   ├── unit/                      # Unit tests
│   │   ├── integration/               # Integration tests
│   │   └── e2e/                       # End-to-end tests
│   ├── vite.config.js                 # Vite configuration (defines HTML entries)
│   ├── package.json
│   └── .env                           # Environment variables
├── supabase/                          # Database migrations
│   ├── migrations/
│   │   ├── 20260208_001_initial_schema.sql
│   │   ├── 20260209_001_create_spaces.sql
│   │   ├── 20260210_*.sql
│   │   └── ...
│   └── functions/                     # Edge functions
│       └── admin-reset-password/
├── docs/                              # Documentation
│   ├── project-technical-summary.md
│   ├── coding-conventions.md
│   ├── security.md
│   └── ...
├── CLAUDE.md                          # Project instructions
└── README.md                          # This file
```

---

## 6. Database Schema

### Core Tables

#### 1. Companies
```sql
CREATE TABLE companies (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```
Stores company information for multi-tenant isolation.

#### 2. Users (via Supabase Auth)
```
Metadata stored in auth.users:
- company_id (nullable - NULL = personal user)
- role ('sys_admin', 'admin', 'user')
- department
- avatar_url
```

#### 3. Projects
```sql
CREATE TABLE projects (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  company_id BIGINT REFERENCES companies(id) (nullable - personal projects),
  space_id BIGINT REFERENCES spaces(id),
  created_by UUID REFERENCES auth.users(id),
  status TEXT CHECK (status IN ('active', 'paused', 'archived')),
  color TEXT,
  icon TEXT,
  start_year INT,
  end_year INT,
  sort_order INT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### 4. Tasks
```sql
CREATE TABLE tasks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  project_id BIGINT REFERENCES projects(id),
  space_id BIGINT REFERENCES spaces(id),
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')),
  due_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### 5. Comments
```sql
CREATE TABLE comments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id BIGINT REFERENCES tasks(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  content TEXT NOT NULL,
  parent_comment_id BIGINT REFERENCES comments(id) (for threading),
  is_action_item BOOLEAN DEFAULT FALSE,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### 6. Mentions
```sql
CREATE TABLE mentions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  comment_id BIGINT REFERENCES comments(id) ON DELETE CASCADE,
  mentioned_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 7. Activity Log
```sql
CREATE TABLE activity_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id BIGINT NOT NULL,
  action TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  company_id BIGINT REFERENCES companies(id),
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 8. Notifications
```sql
CREATE TABLE notifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL,
  related_user_id UUID REFERENCES auth.users(id),
  task_id BIGINT REFERENCES tasks(id),
  comment_id BIGINT REFERENCES comments(id),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 9. Time Entries
```sql
CREATE TABLE time_entries (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id BIGINT REFERENCES tasks(id),
  user_id UUID REFERENCES auth.users(id),
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  duration_seconds INT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### 10. Tags
```sql
CREATE TABLE tags (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  company_id BIGINT REFERENCES companies(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 11. Task Tags (Junction Table)
```sql
CREATE TABLE task_tags (
  task_id BIGINT REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id BIGINT REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);
```

#### 12. Spaces
```sql
CREATE TABLE spaces (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  company_id BIGINT REFERENCES companies(id),
  color TEXT,
  icon TEXT,
  sort_order INT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### 13. Statuses
```sql
CREATE TABLE statuses (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  order INT,
  company_id BIGINT REFERENCES companies(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 14. Checklists
```sql
CREATE TABLE checklists (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id BIGINT REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Key Database Features
- **Row-Level Security (RLS)**: All tables have RLS policies
- **PostgreSQL Triggers**: Auto-calculate durations, track activity, generate notifications
- **Helper Functions**: `is_system_admin()`, `user_company_id()`, `is_company_admin()`
- **Performance**: Indexes on foreign keys, company_id, and frequently queried columns
- **Data Type Standards**:
  - PKs: `bigint GENERATED ALWAYS AS IDENTITY`
  - User references: `uuid` (from auth.users)
  - Company/Project/Task IDs: `bigint`

---


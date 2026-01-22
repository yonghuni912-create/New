# BBQ Chicken Franchise Management Platform

A comprehensive platform for managing BBQ Chicken franchise store openings, built with Next.js, Prisma, and TypeScript.

## Features

- 🔐 **Authentication & Authorization**: NextAuth v4 with role-based access control (ADMIN, PM, CONTRIBUTOR, VIEWER)
- 🏪 **Store Management**: Create, view, and manage franchise stores across multiple countries
- ✅ **Task Management**: Organize tasks by phases with dependencies and cascade rescheduling
- 📊 **Dashboard**: Real-time KPIs and insights on store opening progress
- 📁 **File Management**: Upload and manage store-related documents
- 🔔 **Notifications**: Stay updated with system notifications
- 🔍 **Global Search**: Search across stores, manuals, and ingredients
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🌍 **Multi-country Support**: Manage stores across different countries and currencies
- 📝 **Audit Logging**: Track all changes with detailed audit trails

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: SQLite (local) / Turso (production)
- **ORM**: Prisma
- **Authentication**: NextAuth v4
- **UI**: Tailwind CSS, Lucide React
- **Notifications**: React Hot Toast
- **Testing**: Vitest, Playwright

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm or yarn

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd New
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and configure:

   - `DATABASE_URL`: SQLite database path (default: `file:./prisma/dev.db`)
   - `NEXTAUTH_SECRET`: Random string for NextAuth (generate with `openssl rand -base64 32`)
   - `NEXTAUTH_URL`: Your app URL (default: `http://localhost:3000`)

4. Initialize the database:

   ```bash
   npm run db:push
   npm run db:seed
   ```

5. Run the development server:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Demo Accounts

After seeding, you can log in with these accounts:

- **Admin**: `admin@bbq.com` / `admin123`
- **PM**: `pm@bbq.com` / `pm123`
- **Contributor**: `user@bbq.com` / `user123`

## Project Structure

```text
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── auth/          # NextAuth
│   │   ├── stores/        # Store endpoints
│   │   ├── tasks/         # Task endpoints
│   │   ├── notifications/ # Notifications
│   │   └── search/        # Search endpoint
│   ├── dashboard/         # Dashboard pages
│   │   └── stores/        # Store pages
│   └── login/             # Login page
├── components/            # React components
│   └── ui/                # UI components
├── lib/                   # Core libraries
│   ├── auth.ts            # NextAuth configuration
│   ├── prisma.ts          # Prisma client
│   ├── rbac.ts            # Role-based access control
│   ├── utils.ts           # Utility functions
│   ├── enums.ts           # Application enums
│   └── storage/           # File storage adapters
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # Seed script
└── public/
    └── uploads/           # File uploads (local)
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm test` - Run tests with Vitest
- `npm run test:e2e` - Run E2E tests with Playwright
- `npm run db:push` - Push Prisma schema to database
- `npm run db:seed` - Seed database with demo data
- `npm run db:studio` - Open Prisma Studio

## Database Schema

The platform includes comprehensive models for:

- **Users & Authentication**: User roles and permissions
- **Stores**: Store information, locations, and status
- **Tasks**: Task management with dependencies and phases
- **Templates**: Reusable store opening templates
- **Files**: Document management
- **Notifications**: User notifications
- **Audit Logs**: Change tracking
- **Ingredients & Manuals**: Menu and ingredient management
- **Inventory**: Stock management
- **Sales & Pricing**: Financial tracking

## API Endpoints

### Authentication

- `POST /api/auth/signin` - Login
- `POST /api/auth/signout` - Logout

### Stores

- `GET /api/stores` - List all stores
- `POST /api/stores` - Create new store
- `GET /api/stores/[id]` - Get store details
- `PUT /api/stores/[id]` - Update store
- `POST /api/stores/[id]/files` - Upload file
- `POST /api/stores/[id]/tasks` - Create task

### Tasks

- `PATCH /api/tasks/[id]` - Update task (with cascade options)
- `DELETE /api/tasks/[id]` - Delete task

### Notifications

- `GET /api/notifications` - List notifications
- `PATCH /api/notifications` - Mark as read

### Search

- `GET /api/search?q=query` - Global search

### Health

- `GET /api/health` - Health check

## Role-Based Access Control

The platform implements RBAC with four roles:

- **ADMIN**: Full access to all features
- **PM**: Can manage stores and tasks
- **CONTRIBUTOR**: Can edit tasks and view stores
- **VIEWER**: Read-only access

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in Vercel
3. Configure environment variables:
   - `DATABASE_URL` (if using SQLite) or
   - `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` (for Turso)
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL`
4. Deploy!

### Using Turso (Production Database)

Turso is automatically used when both `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` environment variables are set. Otherwise, the app falls back to SQLite.

1. Create a Turso database:

   ```bash
   turso db create bbq-franchise
   turso db show bbq-franchise
   ```

2. Get connection details:

   ```bash
   turso db show bbq-franchise --url
   turso db tokens create bbq-franchise
   ```

3. Update `.env`:

   ```text
   TURSO_DATABASE_URL=libsql://your-database.turso.io
   TURSO_AUTH_TOKEN=your-auth-token
   ```

4. Push schema and seed:

   ```bash
   npm run db:push
   npm run db:seed
   ```

## Task Cascade Policies

When updating task schedules, you can choose:

- **THIS_ONLY**: Only update the current task
- **CASCADE_LATER**: Update dependent tasks that come after
- **CASCADE_ALL**: Update all related tasks

## File Storage

The platform supports two storage adapters:

- **LocalFS**: For development (files stored in `public/uploads/`)
- **S3**: For production (configure AWS credentials)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Observability

### OpenTelemetry Tracing

The platform includes built-in distributed tracing via OpenTelemetry. Traces are automatically captured for HTTP requests and can be exported to any OTLP-compatible backend (Jaeger, Zipkin, Honeycomb, etc.).

**Configuration:**

Set these environment variables to enable tracing:

```bash
OTEL_SERVICE_NAME=bbq-franchise-platform     # Service name in traces
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318  # OTLP collector endpoint
OTEL_TRACES_ENABLED=true                     # Enable/disable tracing
```

**Manual Tracing in Code:**

Use the helper functions in `lib/tracing.ts`:

```typescript
import { traceApiRoute, traceDbOperation, withTrace } from '@/lib/tracing';

// Wrap an API route
export async function GET(request: NextRequest) {
  return traceApiRoute('GET', '/api/my-endpoint', async (span) => {
    span.setAttribute('custom.attribute', 'value');
    // ... your logic
    return NextResponse.json({ data });
  });
}

// Wrap a database operation
const result = await traceDbOperation('SELECT', 'users', async (span) => {
  return prisma.user.findMany();
});
```

**Running a Local Collector (Jaeger):**

```bash
docker run -d --name jaeger \
  -p 16686:16686 \
  -p 4318:4318 \
  jaegertracing/all-in-one:latest
```

Access Jaeger UI at <http://localhost:16686>

## License

ISC

## Support

For issues and questions, please open an issue on GitHub.

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Database with [Prisma](https://www.prisma.io/)
- Authentication by [NextAuth](https://next-auth.js.org/)
- UI components styled with [Tailwind CSS](https://tailwindcss.com/)

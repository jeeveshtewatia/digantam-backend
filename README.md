# Sketchers3D API

A comprehensive, scalable inventory management system built with NestJS by Sketchers3D, supporting multiple projects from a single backend with dynamic schema management, role-based access control, and complete API documentation.

## 🚀 Features

### Core Features
- ✅ **Multi-Project Support**: Manage multiple projects from a single backend
- ✅ **Dynamic Schema Management**: Each project can have custom inventory and customer schemas
- ✅ **Role-Based Access Control**: Super Admin, Admin, RM, and User roles with granular permissions
- ✅ **JWT Authentication**: Secure authentication with JWT tokens
- ✅ **Open API Support**: Projects can be configured to work without authentication
- ✅ **Swagger Documentation**: Complete API documentation with interactive testing
- ✅ **Clean Architecture**: Modular, scalable, and maintainable code structure

### Project Management
- Create and manage multiple projects
- Define custom schemas per project
- Configure authentication requirements per project
- Set allowed roles for each project
- Toggle project active status

### Inventory Management
- Create, read, update, and delete inventory items
- Bulk inventory creation
- **CSV Bulk Updates**: Download, edit, and upload inventory data
- **Automatic Backups**: Every CSV upload creates a backup
- **Rollback Support**: Restore to any previous state
- **Update History**: Complete audit trail with user tracking
- **Tower Statistics API**: Server-side aggregated statistics by tower (floors, flats, unit types, area range)
- Filter inventories by status, tower, floor, unit type
- Custom fields based on project schema
- Admin-only update restrictions

### Customer Management
- Manage customers across projects
- Custom customer fields per project
- Filter by type, unit, email, phone
- Role-based access control

## 📋 Prerequisites

- Node.js (v16 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

## 🛠️ Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd sketchers-backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**

Copy `.env.example` to `.env` and update the values:
```bash
# Windows PowerShell
Copy-Item .env.example .env

# Linux/Mac
cp .env.example .env
```

**Important:** Edit `.env` and update all placeholder values, especially:
- MongoDB connection strings
- JWT secret (use a strong random string)
- Super admin credentials (change default password!)
- AWS credentials (if using S3)

See [Environment Setup Guide](./docs/ENV_SETUP.md) for detailed configuration.

4. **Start MongoDB**
```bash
# If using MongoDB locally
mongod

# Or using Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

5. **Run the application**

Development mode:
```bash
npm run start:dev
```

Production build:
```bash
npm run build
npm run start:prod
```

## 📚 API Documentation

Once the server is running, access the Swagger documentation at:
```
http://localhost:8000/api-docs

## 🏗️ Project Structure

```
src/
├── config/                  # Configuration files
│   ├── config.module.ts    # NestJS config module
│   └── constants.ts        # Constants and enums
├── database/               # Database configuration
│   ├── database.module.ts
│   ├── database.service.ts
│   ├── projects-utils.service.ts  # Dynamic model management
│   └── schemas/            # MongoDB schemas
│       └── index.ts
├── modules/                # Feature modules
│   ├── auth/              # Authentication
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/
│   │   └── dto/
│   ├── projects/          # Project management
│   │   ├── projects.module.ts
│   │   ├── projects.controller.ts
│   │   ├── projects.service.ts
│   │   └── dto/
│   ├── inventories/       # Inventory management
│   │   ├── inventories.module.ts
│   │   ├── inventories.controller.ts
│   │   ├── inventories.service.ts
│   │   └── dto/
│   └── customers/         # Customer management
│       ├── customers.module.ts
│       ├── customers.controller.ts
│       ├── customers.service.ts
│       └── dto/
├── shared/                # Shared resources
│   ├── decorators/        # Custom decorators
│   │   ├── roles.decorator.ts
│   │   ├── permissions.decorator.ts
│   │   ├── public.decorator.ts
│   │   ├── current-user.decorator.ts
│   │   └── project-id.decorator.ts
│   └── guards/            # Guards for authorization
│       ├── jwt-auth.guard.ts
│       ├── roles.guard.ts
│       ├── permissions.guard.ts
│       ├── project-validation.guard.ts
│       └── project-auth.guard.ts
├── app.module.ts          # Root module
├── app.controller.ts
├── app.service.ts
└── main.ts               # Application entry point
```

## 🔐 Authentication & Authorization

### User Roles

1. **Super Admin**: Full access to all features
   - Create/manage projects
   - Create admin users
   - Access all project data

2. **Admin**: Project-level administrator
   - Full CRUD on inventory
   - Full CRUD on customers
   - Manage project users

3. **RM (Relationship Manager)**: Limited access
   - Read inventory
   - Create/update customers

4. **User**: Read-only access
   - Read inventory
   - Read customers

### Authentication Flow

1. **Register**
```bash
POST /auth/register
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "role": "user"
}
```

2. **Login**
```bash
POST /auth/login
{
  "email": "user@example.com",
  "password": "password123"
}
```

Response includes JWT token:
```json
{
  "user": {...},
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

3. **Use Token**

Add to request headers:
```
Authorization: Bearer <your-token>
```

## 🎯 Usage Examples

### 📊 CSV Bulk Update Workflow

**Step 1: Download Current Inventory**
```bash
GET /inventories/project_001/csv/download
```
→ Downloads CSV file with all inventory data

**Step 2: Edit in Excel/Sheets**
- Open the downloaded CSV
- Modify fields (unit_number, status, total_cost, etc.)
- Keep `id` column unchanged
- Save the file

**Step 3: Upload Modified CSV**
```bash
POST /inventories/project_001/csv/upload
Authorization: Bearer <admin-token>
Content-Type: multipart/form-data

file: [your-modified-file.csv]
```

**Step 4: Check Results**
```json
{
  "message": "CSV processing completed",
  "total": 150,
  "success": 145,
  "failed": 2,
  "skipped": 3,
  "errors": ["Row 25: Inventory not found"],
  "backup": {
    "filename": "backup_project_001_2026-02-03T10-30-45.csv"
  }
}
```

**Step 5: Rollback if Needed**
```bash
# View history
GET /inventories/project_001/csv/history

# Rollback to previous state
POST /inventories/project_001/csv/rollback/{historyId}
Authorization: Bearer <admin-token>
```

### 1. Create a Project (Super Admin)

```bash
POST /projects
Authorization: Bearer <super-admin-token>

{
  "projectId": "project_001",
  "projectName": "Real Estate Project",
  "projectType": "real_estate",
  "description": "Luxury apartments",
  "inventorySchema": {
    "unit_number": { "type": "String", "required": true },
    "tower": { "type": "String", "required": true },
    "floor": { "type": "String", "required": true },
    "area": { "type": "Number", "required": true },
    "bhk_type": { "type": "String", "required": true },
    "price": { "type": "Number", "required": true },
    "status": { "type": "String", "required": true, "default": "available" }
  },
  "requires_auth": true,
  "allowed_roles": ["admin", "rm", "user"]
}
```

### 2. Create Inventory (Admin)

```bash
POST /inventories/project_001
Authorization: Bearer <admin-token>

{
  "unit_number": "A-101",
  "tower": "Tower A",
  "floor": "10",
  "area": 1200,
  "bhk_type": "2BHK",
  "price": 5000000,
  "status": "available"
}
```

### 3. Get Inventories (Public or Authenticated)

```bash
GET /inventories/project_001?status=available&tower=Tower A
```

### 4. Create Customer

```bash
POST /customers/project_001
Authorization: Bearer <token>

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "unit_id": "A-101",
  "type": "enquiry"
}
```

### 5. Update Inventory (Admin Only)

```bash
PUT /inventories/project_001/inventory_id
Authorization: Bearer <admin-token>

{
  "status": "sold",
  "remarks": "Sold to John Doe"
}
```

## 🔧 Configuration

### Custom Schema Definition

Each project can have custom schemas. Schema fields support:

**Field Types:**
- `String`
- `Number`
- `Boolean`
- `Date`
- `Array`
- `Object`

**Field Options:**
- `required`: true/false
- `default`: default value
- `unique`: true/false
- `enum`: array of allowed values

Example:
```json
{
  "unit_number": { "type": "String", "required": true, "unique": true },
  "status": { "type": "String", "enum": ["available", "sold", "hold"] },
  "price": { "type": "Number", "required": true },
  "amenities": { "type": "Array" }
}
```

### Open API Projects

To create a project that doesn't require authentication:

```json
{
  "projectId": "public_project",
  "projectName": "Public Project",
  "requires_auth": false
}
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# Test coverage
npm run test:cov

# E2E tests
npm run test:e2e
```

## 📦 Building for Production

```bash
# Build
npm run build

# Start production server
npm run start:prod
```

## 🔒 Security Features

- Password hashing with bcrypt
- JWT token authentication
- Role-based access control
- Permission-based authorization
- Input validation with class-validator
- MongoDB injection prevention
- CORS configuration
- Environment variable management

## 🐛 Troubleshooting

### MongoDB Connection Issues
```bash
# Check if MongoDB is running
mongosh

# Or check Docker container
docker ps | grep mongo
```

### Port Already in Use
```bash
# Change PORT in .env file
PORT=8001
```

### JWT Token Issues
- Ensure JWT_SECRET is set in .env
- Check token expiration time
- Verify Bearer token format in headers

## 📝 API Endpoints Summary

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `GET /auth/profile` - Get user profile

### Projects (Super Admin)
- `POST /projects` - Create project
- `GET /projects` - List all projects
- `GET /projects/:projectId` - Get project
- `PUT /projects/:projectId` - Update project
- `DELETE /projects/:projectId` - Delete project
- `PUT /projects/:projectId/toggle-status` - Toggle project status

### Inventories
- `POST /inventories/:projectId` - Create inventory
- `POST /inventories/:projectId/bulk` - Bulk create
- `GET /inventories/:projectId` - List inventories
- `GET /inventories/:projectId/:id` - Get inventory
- `PUT /inventories/:projectId/:id` - Update inventory
- `DELETE /inventories/:projectId/:id` - Delete inventory

### Customers
- `POST /customers/:projectId` - Create customer
- `GET /customers/:projectId` - List customers
- `GET /customers/:projectId/:customer_id` - Get customer
- `PUT /customers/:projectId/:customer_id` - Update customer
- `DELETE /customers/:projectId/:customer_id` - Delete customer

## 🔒 Security Notes

- **Never commit `.env` files** - They contain sensitive credentials
- Always use `.env.example` as a template
- Change default super admin password immediately after first deployment
- Use strong, unique passwords and JWT secrets in production
- Review [Environment Setup Guide](./docs/ENV_SETUP.md) for security best practices

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

ISC

## 👥 Support

For support, email your-email@example.com or create an issue in the repository.

---

**Built with ❤️ by Sketchers3D using NestJS, MongoDB, and TypeScript**

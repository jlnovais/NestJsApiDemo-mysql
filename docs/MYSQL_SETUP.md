# MySQL Setup Guide

This project now uses MySQL with raw SQL queries (no ORM).

## Database Configuration

Set the following environment variables in your `.env` file:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=testdb
```

## Database Schema

Run the SQL script to create the Employee table:

```bash
mysql -u root -p < database-schema.sql
```

Or manually execute the SQL in `database-schema.sql`:

```sql
CREATE DATABASE IF NOT EXISTS testdb;
USE testdb;

CREATE TABLE IF NOT EXISTS Employee (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  role ENUM('INTERN', 'ENGINEER', 'ADMIN') NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_role (role),
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Make sure MySQL is running and the database is created.

3. Start the application:
```bash
npm run start:dev
```

## API Endpoints

The API endpoints remain the same:
- `POST /employees` - Create a new employee
- `GET /employees` - Get all employees (optional query: `?role=INTERN|ENGINEER|ADMIN`)
- `GET /employees/:id` - Get a specific employee
- `PATCH /employees/:id` - Update an employee
- `DELETE /employees/:id` - Delete an employee

## Notes

- The project uses `mysql2` package for MySQL connectivity
- All database operations use raw SQL queries
- The `DatabaseService` provides helper methods: `query()`, `queryOne()`, and `execute()`


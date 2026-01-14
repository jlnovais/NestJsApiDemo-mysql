import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPool, PoolConnection } from 'mysql2/promise';
import * as bcrypt from 'bcrypt';
import { v7 as uuidv7 } from 'uuid';
import { UserType } from 'src/users/entities/user';
import { DatabaseContextService } from './database-context.service';

type Pool = Awaited<ReturnType<typeof createPool>>;

@Injectable()
export class MysqlDatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool | undefined;

  constructor(
    private configService: ConfigService,
    private contextService: DatabaseContextService,
  ) {}

  async onModuleInit() {
    this.pool = createPool({
      host: this.configService.get<string>('DB_HOST', 'localhost'),
      port: this.configService.get<number>('DB_PORT', 3306),
      user: this.configService.get<string>('DB_USERNAME', 'root'),
      password: this.configService.get<string>('DB_PASSWORD', ''),
      database: this.configService.get<string>('DB_DATABASE', 'nest_api'),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,

      multipleStatements: true,
    });

    // Create tasks table if it doesn't exist
    await this.initializeDatabase();
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
    }
  }

  getPool(): Pool {
    if (!this.pool) {
      throw new Error('[getPool] Database pool not initialized');
    }
    return this.pool;
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    if (!this.pool) {
      throw new Error('[query] Database pool not initialized');
    }

    // If a write occurred in this request context, use the stored connection (master)
    // This ensures read-after-write consistency with ProxySQL
    if (this.contextService.hasWrite()) {
      const connection = this.contextService.getConnection();
      if (connection) {
        // For SELECT after a write, use execute() to match INSERT
        // Both use execute() which uses prepared statements on the same connection
        // This ensures read-after-write consistency within the transaction
        const [rows] = await connection.execute(sql, params);
        const rowsArray = Array.isArray(rows) ? rows : [];

        // Commit the transaction after the SELECT to make everything visible
        await connection.query('COMMIT');
        // Re-enable autocommit for future operations
        await connection.query('SET autocommit = 1');

        return rowsArray as T[];
      } else {
        console.warn(
          '[MysqlDatabaseService.query] hasWrite=true but no connection found',
        );
      }
    }

    // Otherwise, use the pool (which may route to a replica via ProxySQL)
    const [rows] = await this.pool.query(sql, params);
    return rows as T[];
  }

  async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async execute(sql: string, params?: any[]): Promise<any> {
    if (!this.pool) {
      throw new Error('[execute] Database pool not initialized');
    }

    // Execute operations (INSERT, UPDATE, DELETE) always go to master
    // Reuse existing connection from context if available, otherwise get a new one
    let connection = this.contextService.getConnection();

    if (!connection) {
      // Get a connection from the pool and store it in context
      connection = await this.pool.getConnection();
      this.contextService.setConnection(connection);
      // Disable autocommit and start a transaction
      // This ensures read-after-write consistency within the transaction
      await connection.query('SET autocommit = 0');
      await connection.query('START TRANSACTION');
    }

    // Mark that a write has occurred (this ensures subsequent reads use this connection)
    this.contextService.markWrite(connection);

    // Use execute() for INSERT/UPDATE/DELETE to match SELECT queries
    // Both use execute() which uses prepared statements on the same connection
    // This ensures read-after-write consistency
    const result = await connection.execute(sql, params);

    // Don't commit here - keep transaction open for subsequent SELECT
    // The transaction will be committed in the query() method after SELECT

    // result is [ResultSetHeader, FieldPacket[]]
    return result;
  }

  /**
   * Get a connection from the pool for transaction or read-after-write operations.
   * This ensures operations use the same connection (master) to avoid replication lag.
   * The caller is responsible for releasing the connection.
   *
   * Note: With sticky sessions, you typically don't need to call this manually.
   * The execute() method automatically manages connections for write operations.
   */
  async getConnection(): Promise<PoolConnection> {
    if (!this.pool) {
      throw new Error('[getConnection] Database pool not initialized');
    }
    return await this.pool.getConnection();
  }

  /**
   * Release a connection back to the pool.
   * This should be called when you're done with a manually acquired connection.
   */
  releaseConnection(connection: PoolConnection): void {
    connection.release();
  }

  async initializeDatabase() {
    if (!this.pool) {
      throw new Error('[initializeDatabase] Database pool not initialized');
    }
    const createEmployeeTableQuery = `
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
    `;
    await this.pool.execute(createEmployeeTableQuery);

    const createUserTableQuery = `
      CREATE TABLE IF NOT EXISTS Users (
        id BINARY(16) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        passwordHash VARCHAR(255) NOT NULL,
        type ENUM('user', 'admin') NOT NULL DEFAULT 'user',
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_type (type),
        INDEX idx_email (email),
        INDEX idx_username (username)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await this.pool.execute(createUserTableQuery);

    // Create stored procedure for paginated employee listing
    await this.createEmployeesListProcedure();

    // Seed users table with one user of each type
    await this.seedUsers();
  }

  async createEmployeesListProcedure() {
    if (!this.pool) {
      throw new Error(
        '[createEmployeesListProcedure] Database pool not initialized',
      );
    }

    // MySQL2 doesn't support DELIMITER, so we need to split the statements
    // First drop the procedure if it exists
    // Use query() instead of execute() for DDL statements (CREATE/DROP PROCEDURE)
    try {
      await this.pool.query('DROP PROCEDURE IF EXISTS Employees_List');
    } catch {
      // Ignore error if procedure doesn't exist
    }

    // Then create the procedure without DELIMITER
    const createProcedureQueryWithoutDelimiter = `
CREATE PROCEDURE \`Employees_List\`(
    IN Page INT,
    IN PageSize INT,
    IN Role VARCHAR(20),
    IN SearchName VARCHAR(255),
    IN SearchEmail VARCHAR(255),
    IN SortBy VARCHAR(50),
    IN SortOrder VARCHAR(10)
)
BEGIN
    IF (Page <= 0) THEN
        SET @_page = 1;
    ELSE
        SET @_page = Page;
    END IF;

    SET @recordsOffset = (@_page - 1) * PageSize;
    
    SET @sqlMain = '';
    
    -- Add role filter
    IF Role IS NOT NULL AND NOT Role = '' THEN
        SET @sqlMain = CONCAT(@sqlMain, ' AND role = ''', Role, '''');
    END IF;
    
    -- Add name search filter
    IF SearchName IS NOT NULL AND NOT SearchName = '' THEN
        SET @sqlMain = CONCAT(@sqlMain, ' AND name LIKE ''%', REPLACE(SearchName, '''', ''''''), '%''');
    END IF;
    
    -- Add email search filter
    IF SearchEmail IS NOT NULL AND NOT SearchEmail = '' THEN
        SET @sqlMain = CONCAT(@sqlMain, ' AND email LIKE ''%', REPLACE(SearchEmail, '''', ''''''), '%''');
    END IF;
    
    -- Set default sort column and order
    IF SortBy IS NULL OR SortBy = '' THEN
        SET @sortColumn = 'id';
    ELSEIF SortBy = 'createdAt' OR SortBy = 'name' THEN
        SET @sortColumn = SortBy;
    ELSE
        SET @sortColumn = 'id';
    END IF;
    
    IF SortOrder IS NULL OR SortOrder = '' THEN
        SET @sortDirection = 'ASC';
    ELSEIF UPPER(SortOrder) = 'DESC' THEN
        SET @sortDirection = 'DESC';
    ELSE
        SET @sortDirection = 'ASC';
    END IF;

    SET @sqlTxt = CONCAT('
        WITH _data AS (
            SELECT * FROM Employee WHERE 1=1 
        ', @sqlMain, '
        ),
        _count AS (
            SELECT COUNT(*) AS TotalCount FROM _data
        )
        SELECT * FROM _data, _count 
        ORDER BY ', @sortColumn, ' ', @sortDirection, '
        LIMIT ', PageSize, ' OFFSET ', @recordsOffset, ';');
     
    PREPARE execQuery FROM @sqlTxt;
    EXECUTE execQuery;
    DEALLOCATE PREPARE execQuery;
END

    `;

    await this.pool.query(createProcedureQueryWithoutDelimiter);
  }

  async seedUser(
    name: string,
    username: string,
    email: string,
    password: string,
    type: UserType,
  ) {
    if (!this.pool) {
      throw new Error('[seedUser] Database pool not initialized');
    }
    const id = uuidv7();
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    await this.pool.execute(
      `INSERT INTO Users (id, name, username, email, passwordHash, type, createdAt, updatedAt)
    VALUES (UUID_TO_BIN(?), ?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, name, username, email, hashedPassword, type],
    );
  }

  async seedUsers() {
    if (!this.pool) {
      throw new Error('[seedUsers] Database pool not initialized');
    }

    try {
      // Check if users already exist
      const existingUsers = await this.query<{ count: number }>(
        'SELECT COUNT(*) as count FROM Users',
      );

      if (existingUsers[0].count > 0) {
        console.log('Users table already has data, skipping seed');
        return;
      }

      await this.seedUser(
        'Regular User',
        'user',
        'user@example.com',
        '123',
        UserType.USER,
      );
      await this.seedUser(
        'Admin User',
        'admin',
        'admin@example.com',
        '123',
        UserType.ADMIN,
      );
    } catch (error) {
      console.error('Error seeding users table:', error);
    }
  }
}

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

  /**
   * Health check method to verify database connection
   * @returns true if database is accessible, false otherwise
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.pool) {
        return false;
      }
      // Simple query to check connection
      await this.pool.query('SELECT 1');
      return true;
    } catch (error) {
      console.error(
        '[MysqlDatabaseService.healthCheck] Database health check failed:',
        error,
      );
      return false;
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

    // If a write occurred in this request context, use the stored connection.
    // We keep a transaction open for the duration of the request (see DatabaseContextInterceptor),
    // which forces ProxySQL to keep the backend "sticky" (master) and avoids replication lag.
    if (this.contextService.hasWrite()) {
      const connection = this.contextService.getConnection();
      if (connection) {
        const [rows] = await connection.execute(sql, params);
        const rowsArray = Array.isArray(rows) ? rows : [];

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

  async queryOneMaster<T = any>(
    sql: string,
    params?: any[],
  ): Promise<T | null> {
    const rows = await this.queryMaster<T>(sql, params);
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

    // Don't commit here - keep the transaction open for the duration of the request
    // so ProxySQL keeps the backend sticky (master) for any read-after-write queries.
    // Commit/rollback is handled at the end of the request by DatabaseContextInterceptor.

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

  /**
   * Run a SELECT on a dedicated master connection.
   * Useful for tests and admin flows where replica lag would be confusing.
   */
  async queryMaster<T = any>(sql: string, params?: any[]): Promise<T[]> {
    if (!this.pool) {
      throw new Error('[queryMaster] Database pool not initialized');
    }

    const connection = await this.pool.getConnection();
    try {
      // Force ProxySQL sticky routing to the master by opening a transaction
      // on this connection before executing the SELECT.
      await connection.query('SET autocommit = 0');
      await connection.query('START TRANSACTION');
      const [rows] = await connection.execute(sql, params);
      await connection.query('COMMIT');
      return (Array.isArray(rows) ? rows : []) as T[];
    } finally {
      await connection.query('SET autocommit = 1').catch(() => undefined);
      connection.release();
    }
  }

  async initializeDatabase() {
    if (!this.pool) {
      throw new Error('[initializeDatabase] Database pool not initialized');
    }
    const createAuditLogTableQuery = `
      CREATE TABLE IF NOT EXISTS AuditLog (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        eventType VARCHAR(100) NOT NULL,
        entityType VARCHAR(50) NOT NULL,
        entityId VARCHAR(64) NOT NULL,
        actorUserId VARCHAR(64) NULL,
        actorType VARCHAR(20) NULL,
        ip VARCHAR(45) NULL,
        userAgent VARCHAR(1024) NULL,
        data JSON NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_entity (entityType, entityId),
        INDEX idx_entity_createdAt (entityType, entityId, createdAt),
        INDEX idx_actor (actorUserId),
        INDEX idx_createdAt (createdAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await this.pool.execute(createAuditLogTableQuery);

    // If the table already existed (older schema), ensure key schema improvements exist.
    const auditUserAgentLen = await this.query<{
      maxLen: number | null;
    }>(
      `
      SELECT CHARACTER_MAXIMUM_LENGTH AS maxLen
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'AuditLog'
        AND COLUMN_NAME = 'userAgent'
      `,
    );
    if (
      (auditUserAgentLen[0]?.maxLen ?? 0) > 0 &&
      (auditUserAgentLen[0]?.maxLen ?? 0) < 1024
    ) {
      await this.pool.execute(
        `ALTER TABLE AuditLog MODIFY COLUMN userAgent VARCHAR(1024) NULL`,
      );
    }

    const auditIndex = await this.query<{ count: number }>(
      `
      SELECT COUNT(*) AS count
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'AuditLog'
        AND INDEX_NAME = 'idx_entity_createdAt'
      `,
    );
    if ((auditIndex[0]?.count ?? 0) === 0) {
      await this.pool.execute(
        `CREATE INDEX idx_entity_createdAt ON AuditLog (entityType, entityId, createdAt)`,
      );
    }

    const createEmployeeTableQuery = `
      CREATE TABLE IF NOT EXISTS Employee (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        role ENUM('INTERN', 'ENGINEER', 'ADMIN') NOT NULL,
        photoUrl VARCHAR(2048) NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_role (role),
        INDEX idx_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await this.pool.execute(createEmployeeTableQuery);

    // If the table already existed (older schema), ensure the new column exists.
    // MySQL doesn't alter existing tables when using CREATE TABLE IF NOT EXISTS.
    const photoUrlColumn = await this.query<{ count: number }>(
      `
      SELECT COUNT(*) AS count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'Employee'
        AND COLUMN_NAME = 'photoUrl'
      `,
    );
    if ((photoUrlColumn[0]?.count ?? 0) === 0) {
      await this.pool.execute(
        `ALTER TABLE Employee ADD COLUMN photoUrl VARCHAR(2048) NULL`,
      );
    }

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

    // ProxySQL note: ensure this runs on the writer by opening a transaction
    // on a dedicated connection.
    const connection = await this.pool.getConnection();

    // Then create the procedure without DELIMITER (MySQL2 doesn't support DELIMITER).
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

    try {
      await connection.query('SET autocommit = 0');
      await connection.query('START TRANSACTION');
      await connection.query('DROP PROCEDURE IF EXISTS Employees_List');
      await connection.query(createProcedureQueryWithoutDelimiter);
      await connection.query('COMMIT');
    } finally {
      await connection.query('SET autocommit = 1').catch(() => undefined);
      connection.release();
    }
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

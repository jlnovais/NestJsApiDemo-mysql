import { Injectable } from '@nestjs/common';
import { MysqlDatabaseService } from 'src/database/mysql-database.service';
import { User, UserType } from '../entities/user';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { ResultWithData, ResultNoData } from 'src/common/result';
import { handleDatabaseError } from 'src/common/error-handlers';
import * as bcrypt from 'bcrypt';
import { v7 as uuidv7 } from 'uuid';

@Injectable()
export class UsersRepository {
  constructor(private readonly databaseService: MysqlDatabaseService) {}

  async create(createUserDto: CreateUserDto): Promise<ResultWithData<string>> {
    const result = new ResultWithData<string>();

    try {
      // Generate UUID for the new user
      const id = uuidv7();

      // Hash the password before storing
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(
        createUserDto.password,
        saltRounds,
      );

      const sql = `
        INSERT INTO Users (id, name, username, email, passwordHash, type, createdAt, updatedAt)
        VALUES (UUID_TO_BIN(?), ?, ?, ?, ?, ?, NOW(), NOW())
      `;

      await this.databaseService.execute(sql, [
        id,
        createUserDto.name,
        createUserDto.username,
        createUserDto.email,
        hashedPassword,
        createUserDto.type,
      ]);

      result.Success = true;
      result.Message = 'User created successfully';
      result.ErrorCode = 0;
      result.ReturnedObject = id;

      return result;
    } catch (error) {
      console.log('UsersRepository.create. error', error);

      const errorResult = handleDatabaseError(error, 'Failed to create user');
      return new ResultWithData<string>(
        errorResult.Success,
        errorResult.Message,
        undefined,
        errorResult.ErrorCode,
      );
    }
  }

  async findAll(type?: UserType): Promise<ResultWithData<User[]>> {
    const result = new ResultWithData<User[]>();
    try {
      let users: User[];
      if (type) {
        const sql = `SELECT BIN_TO_UUID(id) as id, name, username, email, passwordHash, type, createdAt, updatedAt 
                     FROM Users WHERE type = ? ORDER BY createdAt ASC`;
        users = await this.databaseService.query<User>(sql, [type]);
      } else {
        const sql = `SELECT BIN_TO_UUID(id) as id, name, username, email, passwordHash, type, createdAt, updatedAt 
                     FROM Users ORDER BY createdAt ASC`;
        users = await this.databaseService.query<User>(sql);
      }

      result.Success = true;
      result.Message = 'Users retrieved successfully';
      result.ErrorCode = 0;
      result.ReturnedObject = users;
      return result;
    } catch (error) {
      console.log('UsersRepository.findAll. error', error);

      const errorResult = handleDatabaseError(
        error,
        'Failed to retrieve users',
      );
      return new ResultWithData<User[]>(
        errorResult.Success,
        errorResult.Message,
        [],
        errorResult.ErrorCode,
      );
    }
  }

  async findOne(id: string): Promise<ResultWithData<User | null>> {
    const result = new ResultWithData<User | null>();
    try {
      const sql = `SELECT BIN_TO_UUID(id) as id, name, username, email, passwordHash, type, createdAt, updatedAt 
                   FROM Users WHERE id = UUID_TO_BIN(?)`;
      const user = await this.databaseService.queryOne<User>(sql, [id]);

      if (user) {
        result.Success = true;
        result.Message = 'User retrieved successfully';
        result.ErrorCode = 0;
        result.ReturnedObject = user;
        return result;
      } else {
        result.Success = false;
        result.Message = `User with id ${id} not found`;
        result.ErrorCode = 404;
        result.ReturnedObject = null;
        return result;
      }
    } catch (error) {
      console.log('UsersRepository.findOne. error', error);

      const errorResult = handleDatabaseError(error, 'Failed to retrieve user');
      return new ResultWithData<User | null>(
        errorResult.Success,
        errorResult.Message,
        null,
        errorResult.ErrorCode,
      );
    }
  }

  async findByUsername(username: string): Promise<ResultWithData<User | null>> {
    const result = new ResultWithData<User | null>();
    try {
      const sql = `SELECT BIN_TO_UUID(id) as id, name, username, email, passwordHash, type, createdAt, updatedAt 
                   FROM Users WHERE username = ?`;
      const user = await this.databaseService.queryOne<User>(sql, [username]);

      if (user) {
        result.Success = true;
        result.Message = 'User retrieved successfully';
        result.ErrorCode = 0;
        result.ReturnedObject = user;
        return result;
      } else {
        result.Success = false;
        result.Message = `User with username ${username} not found`;
        result.ErrorCode = 404;
        result.ReturnedObject = null;
        return result;
      }
    } catch (error) {
      console.log('UsersRepository.findByUsername. error', error);

      const errorResult = handleDatabaseError(error, 'Failed to retrieve user');
      return new ResultWithData<User | null>(
        errorResult.Success,
        errorResult.Message,
        null,
        errorResult.ErrorCode,
      );
    }
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<ResultNoData> {
    const result = new ResultNoData();
    try {
      const updates: string[] = [];
      const values: any[] = [];

      if (updateUserDto.name !== undefined) {
        updates.push('name = ?');
        values.push(updateUserDto.name);
      }

      if (updateUserDto.username !== undefined) {
        updates.push('username = ?');
        values.push(updateUserDto.username);
      }

      if (updateUserDto.email !== undefined) {
        updates.push('email = ?');
        values.push(updateUserDto.email);
      }

      if (updateUserDto.password !== undefined) {
        // Hash the password before storing
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(
          updateUserDto.password,
          saltRounds,
        );
        updates.push('passwordHash = ?');
        values.push(hashedPassword);
      }

      if (updateUserDto.type !== undefined) {
        updates.push('type = ?');
        values.push(updateUserDto.type);
      }

      if (updates.length === 0) {
        result.Success = false;
        result.Message = 'No fields to update';
        result.ErrorCode = 400;
        return result;
      }

      updates.push('updatedAt = NOW()');
      values.push(id);

      const sql = `UPDATE Users SET ${updates.join(', ')} WHERE id = UUID_TO_BIN(?)`;
      await this.databaseService.execute(sql, values);

      result.Success = true;
      result.Message = 'User updated successfully';
      result.ErrorCode = 0;
      return result;
    } catch (error) {
      console.log('UsersRepository.update. error', error);

      const errorResult = handleDatabaseError(error, 'Failed to update user');
      return new ResultNoData(
        errorResult.Success,
        errorResult.Message,
        errorResult.ErrorCode,
      );
    }
  }

  async delete(id: string): Promise<ResultNoData> {
    const result = new ResultNoData();
    try {
      const sql = 'DELETE FROM Users WHERE id = UUID_TO_BIN(?)';
      await this.databaseService.execute(sql, [id]);
      result.Success = true;
      result.Message = 'User deleted successfully';
      result.ErrorCode = 0;
      return result;
    } catch (error) {
      console.log('UsersRepository.delete. error', error);

      const errorResult = handleDatabaseError(error, 'Failed to delete user');
      return new ResultNoData(
        errorResult.Success,
        errorResult.Message,
        errorResult.ErrorCode,
      );
    }
  }
}

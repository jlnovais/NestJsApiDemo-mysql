import { Injectable } from '@nestjs/common';
import { UsersRepository } from './repository/users.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserType } from './entities/user';
import { handleRepositoryError } from 'src/common/error-handlers';
import { UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    console.log('Creating User. createUserDto', createUserDto);

    const result = await this.usersRepository.create(createUserDto);

    if (!result.Success) {
      handleRepositoryError(result);
    }
    return this.findOne(result.ReturnedObject as string);
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const result = await this.usersRepository.findOne(id);

    if (!result.Success) {
      handleRepositoryError(result);
    }

    const { passwordHash, ...userResponse } = result.ReturnedObject as User;
    void passwordHash; // Explicitly mark as intentionally unused
    return userResponse as UserResponseDto;
  }

  async findAll(type?: UserType): Promise<UserResponseDto[]> {
    const result = await this.usersRepository.findAll(type);

    if (!result.Success) {
      handleRepositoryError(result);
    }
    // Exclude passwordHash from each user in the response
    const users = result.ReturnedObject as User[];
    return users.map((user) => {
      const { passwordHash, ...userResponse } = user;
      void passwordHash; // Explicitly mark as intentionally unused
      return userResponse as UserResponseDto;
    });
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    // Check if user exists
    const result = await this.usersRepository.findOne(id);

    if (!result.Success) {
      handleRepositoryError(result);
    }

    const resultUpdate = await this.usersRepository.update(id, updateUserDto);

    if (!resultUpdate.Success) {
      handleRepositoryError(resultUpdate);
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<UserResponseDto> {
    const result = await this.usersRepository.findOne(id);

    if (!result.Success) {
      handleRepositoryError(result);
    }

    const { passwordHash, ...userDto } = result.ReturnedObject as User;
    void passwordHash; // Explicitly mark as intentionally unused
    const resultDelete = await this.usersRepository.delete(id);

    if (!resultDelete.Success) {
      handleRepositoryError(resultDelete);
    }

    return userDto as UserResponseDto;
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  Delete,
  Query,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserType } from './entities/user';
import { SessionGuard } from '../auth/guards/session.guard';
import { AllowedUserTypes } from '../auth/decorators/allowed-user-types.decorator';

@ApiTags('users')
@Controller('users') // rota: /users
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get() // GET /users
  @UseGuards(SessionGuard)
  @AllowedUserTypes('admin')
  @ApiOperation({
    summary: 'Get all users',
    description:
      'Retrieve a list of all users. Optionally filter by type using query parameter.',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: UserType,
    description: 'Filter users by type',
  })
  @ApiResponse({
    status: 200,
    description: 'List of users retrieved successfully',
    type: [UserResponseDto],
  })
  @ApiResponse({
    status: 404,
    description: 'No users found with the specified type',
  })
  async findall(@Query('type') type?: UserType) {
    return this.usersService.findAll(type);
  }

  @Get(':id') // GET /users/:id
  @UseGuards(SessionGuard)
  @AllowedUserTypes('admin')
  @ApiOperation({
    summary: 'Get user by ID',
    description: 'Retrieve a specific user by their unique identifier',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'User ID (GUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'User retrieved successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post() // POST /users
  @UseGuards(SessionGuard)
  @AllowedUserTypes('admin')
  @ApiOperation({
    summary: 'Create a new user',
    description:
      'Create a new user with name, username, email, password, and type',
  })
  @ApiBody({
    type: CreateUserDto,
    description: 'User data to create',
  })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  async create(@Body(ValidationPipe) createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Patch(':id') // PATCH /users/:id
  @UseGuards(SessionGuard)
  @AllowedUserTypes('admin')
  @ApiOperation({
    summary: 'Update user',
    description:
      'Update an existing user. Only provided fields will be updated.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'User ID (GUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiBody({
    type: UpdateUserDto,
    description: 'User data to update (partial)',
  })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  async update(
    @Param('id') id: string,
    @Body(ValidationPipe) updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id') // DELETE /users/:id
  @UseGuards(SessionGuard)
  @AllowedUserTypes('admin')
  @ApiOperation({
    summary: 'Delete user',
    description: 'Delete a user by their unique identifier',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'User ID (GUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'User deleted successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}

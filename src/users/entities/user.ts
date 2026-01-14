export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  passwordHash: string;
  type: UserType;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserType {
  USER = 'user',
  ADMIN = 'admin',
}

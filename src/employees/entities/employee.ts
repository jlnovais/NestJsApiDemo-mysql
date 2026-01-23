export interface Employee {
  id: number;
  name: string;
  email: string;
  role: Role;
  photoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmployeeWithTotalCount extends Employee {
  TotalCount: number;
}

export enum Role {
  INTERN = 'INTERN',
  ENGINEER = 'ENGINEER',
  ADMIN = 'ADMIN',
}

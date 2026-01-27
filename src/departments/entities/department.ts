export interface Department {
  id: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DepartmentWithTotalCount extends Department {
  TotalCount: number;
}

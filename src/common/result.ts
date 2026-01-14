// Non-generic Result class (for operations without return data)
export class ResultNoData {
  public Success: boolean;
  public Message: string;
  public ErrorCode: number;

  constructor(
    success: boolean = false,
    message: string = '',
    errorCode: number = 0,
  ) {
    this.Success = success;
    this.Message = message;
    this.ErrorCode = errorCode;
  }
}

// Generic Result class (for operations with return data)
// Note: TypeScript doesn't allow both Result and Result<T> as classes with the same name
// So we use ResultWithData<T> as the class name
export class ResultWithData<T> {
  public Success: boolean;
  public Message: string;
  public ErrorCode: number;
  public ReturnedObject: T | undefined;

  constructor(
    success: boolean = false,
    message: string = '',
    returnedObject?: T,
    errorCode: number = 0,
  ) {
    this.Success = success;
    this.Message = message;
    this.ReturnedObject = returnedObject;
    this.ErrorCode = errorCode;
  }
}

// Type alias for convenience - allows Result<T> syntax in type signatures
// For instantiation with data, use: new ResultWithData<T>(...)
// For instantiation without data, use: new Result(...)
//export type ResultGeneric<T> = ResultWithData<T>;

// Type alias for Result<void> equivalent
//export type ResultNoData = Result;

export class PaginationResult<T> {
  public Success: boolean;
  public Message: string;
  public ErrorCode: number;
  public Page: number;
  public PageSize: number;
  public Total: number;
  public TotalPages: number;
  public ReturnedObject: T | undefined;

  constructor(
    success: boolean = false,
    message: string = '',
    page: number = 0,
    pageSize: number = 0,
    total: number = 0,
    totalPages: number = 0,
    returnedObject?: T,
    errorCode: number = 0,
  ) {
    this.Success = success;
    this.Message = message;
    this.ReturnedObject = returnedObject;
    this.ErrorCode = errorCode;
    this.Page = page;
    this.PageSize = pageSize;
    this.Total = total;
    this.TotalPages = totalPages;
  }
}

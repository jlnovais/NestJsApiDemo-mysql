export interface IRabbitResult {
  Success: boolean;
  ReturnedObject: any;
  ErrorCode: number;
  ErrorDescription?: string;
  ErrorDescription2?: string;
  DebugDetails?: string;
  ProcessingTimeMs?: number;
}

export class RabbitResult<T = any> implements IRabbitResult {
  Success: boolean = false;
  ReturnedObject: T | null = null;
  ErrorCode: number = 0;
  ErrorDescription?: string;
  ErrorDescription2?: string;
  DebugDetails?: string;
  ProcessingTimeMs?: number;
}

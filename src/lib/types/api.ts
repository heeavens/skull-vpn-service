export type ApiErrorCode =
  | 'AUTH_RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'REQUEST_BODY_TOO_LARGE'
  | 'REQUEST_CONTENT_TYPE_INVALID'
  | 'REQUEST_ORIGIN_INVALID'
  | 'TELEGRAM_INIT_DATA_EXPIRED'
  | 'TELEGRAM_INIT_DATA_INVALID';

export type ApiErrorEnvelope = Readonly<{
  error: Readonly<{
    code: ApiErrorCode;
    message: string;
    fieldErrors: Readonly<Record<string, readonly string[]>>;
    requestId: string;
  }>;
}>;

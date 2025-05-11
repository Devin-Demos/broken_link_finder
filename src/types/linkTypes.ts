
export interface LinkCheckResult {
  url: string;
  isWorking: boolean;
  statusCode?: number | string;
  error?: string;
}

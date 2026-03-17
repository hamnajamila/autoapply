export type AppStatus =
  | "PENDING"
  | "SUBMITTED"
  | "FAILED"
  | "SKIPPED_THRESHOLD"
  | "SKIPPED_DUPLICATE"
  | "SKIPPED_CAPTCHA"
  | "SKIPPED_MANUAL"
  | "UNCERTAIN";

export type ApplicationResult = {
  success: boolean;
  status: AppStatus;
  method: string;
  errorMessage?: string;
  screenshotBefore?: string;
  screenshotAfter?: string;
  skipReason?: string;
};


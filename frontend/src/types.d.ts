export interface UserData {
  id: number;
  apiKey: string;
  username: string;
  email: string;
  profilePic: string | null;
  telegramUsername: string | null;
  totalCalls: number;
  failedCalls: number;
  balance: number;
  currency: string;
  concurrentCalls: number;
  isNewUser: boolean;
  testCreditUsed: boolean;
  suspensionDate: string | null;
}

export interface AdminStats {
  totalApiKeys: number;
  totalSuccessCalls: number;
  totalFailedCalls: number;
}
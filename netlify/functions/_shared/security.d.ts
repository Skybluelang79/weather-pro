export interface SubscriptionLike {
  plan?: string;
  status?: string;
  source?: string;
  since?: number | null;
  expiresAt?: number | null;
}

export declare const PLAN_RANK: Record<string, number>;
export declare const FEATURE_PLAN: Record<string, string>;
export declare const SESSION_COOKIE: string;
export declare const USER_COOKIE: string;

export declare function createSubscriberId(): string;
export declare function createUserId(): string;
export declare function signSubscriberId(id: string): string;
export declare function verifySignedSubscriberId(token: string): string | null;
export declare function signUserId(id: string): string;
export declare function verifySignedUserId(token: string): string | null;
export declare function setAuthCookies(res: any, subscriberId: string, userId?: string | null): void;
export declare function clearAuthCookies(res: any): void;
export declare function sessionMiddleware(req: any, res: any, next: () => void): void;
export declare function activeSubscription(subscription?: SubscriptionLike | null): SubscriptionLike;
export declare function hasEntitlement(subscription: SubscriptionLike | null | undefined, feature: string): boolean;
export declare function maxFavoritesFor(subscription: SubscriptionLike | null | undefined): number;
export declare function maxHistoryFor(subscription: SubscriptionLike | null | undefined): number;
export declare function maxForecastDaysFor(subscription: SubscriptionLike | null | undefined): number;

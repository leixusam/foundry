export declare function sleep(ms: number): Promise<void>;
export declare function handleRateLimit(retryAfterMs: number): Promise<void>;
export declare function parseRateLimitReset(jsonOrText: unknown): number;
export declare function isRateLimitError(text: string): boolean;
//# sourceMappingURL=rate-limit.d.ts.map
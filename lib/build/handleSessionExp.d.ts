export declare function onUnauthorisedResponse(refreshTokenUrl: string, preRequestIdToken: string, refreshAPICustomHeaders: any, sessionExpiredStatusCode: number): Promise<{
    result: "SESSION_EXPIRED";
} | {
    result: "API_ERROR";
    error: any;
} | {
    result: "RETRY";
}>;

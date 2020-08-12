/**
 * @description returns true if retry, else false is session has expired completely.
 */
export declare function handleUnauthorised(refreshAPI: string | undefined, preRequestIdToken: string | undefined, refreshAPICustomHeaders: any, sessionExpiredStatusCode: number): Promise<boolean>;
export declare function getDomainFromUrl(url: string): string;
/**
 * @class AuthHttpRequest
 * @description wrapper for common http methods.
 */
export default class AuthHttpRequest {
    private static refreshTokenUrl;
    private static sessionExpiredStatusCode;
    private static initCalled;
    static originalFetch: any;
    private static apiDomain;
    private static viaInterceptor;
    private static refreshAPICustomHeaders;
    static init(refreshTokenUrl: string, viaInterceptor?: boolean | null, refreshAPICustomHeaders?: any, sessionExpiredStatusCode?: number): void;
    /**
     * @description sends the actual http request and returns a response if successful/
     * If not successful due to session expiry reasons, it
     * attempts to call the refresh token API and if that is successful, calls this API again.
     * @throws Error
     */
    private static doRequest;
    static get: (url: RequestInfo, config?: RequestInit | undefined) => Promise<Response>;
    static post: (url: RequestInfo, config?: RequestInit | undefined) => Promise<Response>;
    static delete: (url: RequestInfo, config?: RequestInit | undefined) => Promise<Response>;
    static put: (url: RequestInfo, config?: RequestInit | undefined) => Promise<Response>;
    static fetch: (url: RequestInfo, config?: RequestInit | undefined) => Promise<Response>;
    static doesSessionExist: () => Promise<boolean>;
}

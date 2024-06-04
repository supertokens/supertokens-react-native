import { AxiosPromise, AxiosRequestConfig as OriginalAxiosRequestConfig, AxiosResponse } from "axios";
declare type AxiosRequestConfig = OriginalAxiosRequestConfig & {
    __supertokensSessionRefreshAttempts?: number;
    __supertokensAddedAuthHeader?: boolean;
};
export declare function interceptorFunctionRequestFulfilled(config: AxiosRequestConfig): Promise<AxiosRequestConfig>;
export declare function responseInterceptor(axiosInstance: any): (response: AxiosResponse<any>) => Promise<AxiosResponse<any>>;
export declare function responseErrorInterceptor(axiosInstance: any): (error: any) => Promise<AxiosResponse<any>>;
/**
 * @class AuthHttpRequest
 * @description wrapper for common http methods.
 */
export default class AuthHttpRequest {
    /**
     * @description sends the actual http request and returns a response if successful/
     * If not successful due to session expiry reasons, it
     * attempts to call the refresh token API and if that is successful, calls this API again.
     * @throws Error
     */
    static doRequest: (httpCall: (config: AxiosRequestConfig) => AxiosPromise<any>, config: AxiosRequestConfig, url?: string | undefined, prevResponse?: AxiosResponse<any> | undefined, prevError?: any, viaInterceptor?: boolean) => Promise<AxiosResponse<any>>;
}
export {};

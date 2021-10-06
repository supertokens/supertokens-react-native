import { IdRefreshTokenType, InputType, NormalisedInputType } from "./types";
import RecipeImplementation from "./recipeImplementation";
/**
 * @class AuthHttpRequest
 * @description wrapper for common http methods.
 */
export default class AuthHttpRequest {
    static refreshTokenUrl: string;
    static signOutUrl: string;
    static initCalled: boolean;
    static rid: string;
    static env: any;
    static recipeImpl: RecipeImplementation;
    static config: NormalisedInputType;
    static init(options: InputType): void;
    /**
     * @description sends the actual http request and returns a response if successful/
     * If not successful due to session expiry reasons, it
     * attempts to call the refresh token API and if that is successful, calls this API again.
     * @throws Error
     */
    static doRequest: (httpCall: (config?: RequestInit | undefined) => Promise<Response>, config?: RequestInit | undefined, url?: any) => Promise<Response>;
    static attemptRefreshingSession: () => Promise<boolean>;
}
export declare function onUnauthorisedResponse(preRequestIdToken: IdRefreshTokenType): Promise<{
    result: "SESSION_EXPIRED";
    error?: any;
} | {
    result: "API_ERROR";
    error: any;
} | {
    result: "RETRY";
}>;

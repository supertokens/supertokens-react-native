import { InputType, NormalisedInputType, TokenType } from "./types";
export declare function isAnIpAddress(ipaddress: string): boolean;
export declare function normaliseURLDomainOrThrowError(input: string): string;
export declare function normaliseURLPathOrThrowError(input: string): string;
export declare function normaliseCookieDomainOrThrowError(cookieDomain: string): string;
export declare function validateAndNormaliseInputOrThrowError(options: InputType): NormalisedInputType;
export declare function shouldDoInterceptionBasedOnUrl(toCheckUrl: string, apiDomain: string, sessionTokenBackendDomain: string | undefined): boolean;
export declare function setToken(tokenType: TokenType, value: string): Promise<void>;
export declare function storeInStorage(name: string, value: string, expiry: number): Promise<void>;
/**
 * Last access token update is used to record the last time the access token had changed.
 * This is used to synchronise parallel calls to the refresh API to prevent multiple calls
 * to the refresh endpoint
 */
export declare function saveLastAccessTokenUpdate(): Promise<void>;
export declare function getStorageNameForToken(tokenType: TokenType): "st-refresh-token" | "st-access-token";
export declare function getTokenForHeaderAuth(tokenType: TokenType): Promise<string | undefined>;
export declare type LocalSessionState = {
    status: "NOT_EXISTS" | "MAY_EXIST";
} | {
    status: "EXISTS";
    lastAccessTokenUpdate: string;
};
/**
 * The web SDK has additional checks for this function. This difference is because
 * for the mobile SDKs there will never be a case where the fronttoken is undefined
 * but a session may still exist
 */
export declare function getLocalSessionState(): Promise<LocalSessionState>;
export declare function fireSessionUpdateEventsIfNecessary(wasLoggedIn: boolean, status: number, frontTokenHeaderFromResponse: string | null | undefined): void;

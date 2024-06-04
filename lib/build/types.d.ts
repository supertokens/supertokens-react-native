import OverrideableBuilder from "supertokens-js-override";
export declare type Event = {
    action: "SIGN_OUT" | "REFRESH_SESSION" | "SESSION_CREATED";
} | {
    action: "UNAUTHORISED";
    sessionExpiredOrRevoked: boolean;
};
export declare type EventHandler = (event: Event) => void;
export declare type InputType = {
    enableDebugLogs?: boolean;
    apiDomain: string;
    apiBasePath?: string;
    sessionExpiredStatusCode?: number;
    autoAddCredentials?: boolean;
    tokenTransferMethod?: "cookie" | "header";
    /**
     * This specifies the maximum number of times the interceptor will attempt to refresh
     * the session when a 401 Unauthorized response is received. If the number of retries
     * exceeds this limit, no further attempts will be made to refresh the session, and
     * the last response will be returned to the caller.
     */
    maxRetryAttemptsForSessionRefresh?: number;
    sessionTokenBackendDomain?: string;
    preAPIHook?: (context: {
        action: "SIGN_OUT" | "REFRESH_SESSION";
        requestInit: RequestInit;
        url: string;
    }) => Promise<{
        url: string;
        requestInit: RequestInit;
    }>;
    onHandleEvent?: EventHandler;
    override?: {
        functions?: (originalImplementation: RecipeInterface, builder?: OverrideableBuilder<RecipeInterface>) => RecipeInterface;
    };
};
export declare type NormalisedInputType = {
    apiDomain: string;
    apiBasePath: string;
    sessionExpiredStatusCode: number;
    autoAddCredentials: boolean;
    tokenTransferMethod: string;
    maxRetryAttemptsForSessionRefresh: number;
    sessionTokenBackendDomain: string | undefined;
    preAPIHook: (context: {
        action: "SIGN_OUT" | "REFRESH_SESSION";
        requestInit: RequestInit;
        url: string;
    }) => Promise<{
        url: string;
        requestInit: RequestInit;
    }>;
    onHandleEvent: EventHandler;
    override: {
        functions: (originalImplementation: RecipeInterface, builder?: OverrideableBuilder<RecipeInterface>) => RecipeInterface;
    };
};
export declare type PreAPIHookFunction = (context: {
    requestInit: RequestInit;
    url: string;
}) => Promise<{
    url: string;
    requestInit: RequestInit;
}>;
export declare type RecipeInterface = {
    addFetchInterceptorsAndReturnModifiedFetch: (originalFetch: any, config: NormalisedInputType) => typeof fetch;
    addAxiosInterceptors: (axiosInstance: any, config: NormalisedInputType) => void;
    getUserId: (config: NormalisedInputType) => Promise<string>;
    getAccessTokenPayloadSecurely: (config: NormalisedInputType) => Promise<any>;
    doesSessionExist: (config: NormalisedInputType) => Promise<boolean>;
    signOut: (config: NormalisedInputType) => Promise<void>;
    shouldDoInterceptionBasedOnUrl(toCheckUrl: string, apiDomain: string, sessionTokenBackendDomain: string | undefined): boolean;
};
export declare type IdRefreshTokenType = {
    status: "NOT_EXISTS" | "MAY_EXIST";
} | {
    status: "EXISTS";
    token: string;
};
export declare type TokenType = "access" | "refresh";

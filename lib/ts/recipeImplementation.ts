import { URL } from "react-native-url-polyfill";
import { RecipeInterface, NormalisedInputType } from "./types";
import AuthHttpRequest, { onUnauthorisedResponse } from "./fetch";
import FrontToken from "./frontToken";
import { supported_fdi } from "./version";
import { interceptorFunctionRequestFulfilled, responseErrorInterceptor, responseInterceptor } from "./axios";
import { SuperTokensGeneralError } from "./error";
import { getLocalSessionState, normaliseCookieDomainOrThrowError, normaliseURLDomainOrThrowError } from "./utils";
import { logDebugMessage } from "./logger";

export default function RecipeImplementation(): RecipeInterface {
    return {
        addFetchInterceptorsAndReturnModifiedFetch: function(originalFetch: any, _: NormalisedInputType): typeof fetch {
            logDebugMessage("addFetchInterceptorsAndReturnModifiedFetch: called");
            return async function(url: RequestInfo, config?: RequestInit): Promise<Response> {
                return await AuthHttpRequest.doRequest(
                    (config?: RequestInit) => {
                        return originalFetch(url, {
                            ...config
                        });
                    },
                    config,
                    url
                );
            };
        },

        addAxiosInterceptors: function(axiosInstance: any, _: NormalisedInputType): void {
            logDebugMessage("addAxiosInterceptors: called");
            // we first check if this axiosInstance already has our interceptors.
            let requestInterceptors = axiosInstance.interceptors.request;
            for (let i = 0; i < requestInterceptors.handlers.length; i++) {
                if (requestInterceptors.handlers[i].fulfilled === interceptorFunctionRequestFulfilled) {
                    logDebugMessage("addAxiosInterceptors: not adding because already added on this instance");
                    return;
                }
            }
            // Add a request interceptor
            axiosInstance.interceptors.request.use(interceptorFunctionRequestFulfilled, async function(error: any) {
                throw error;
            });

            // Add a response interceptor
            axiosInstance.interceptors.response.use(
                responseInterceptor(axiosInstance),
                responseErrorInterceptor(axiosInstance)
            );
        },

        getUserId: async function(config: NormalisedInputType): Promise<string> {
            logDebugMessage("getUserId: called");
            let tokenInfo = await FrontToken.getTokenInfo();
            if (tokenInfo === undefined) {
                throw new Error("No session exists");
            }
            logDebugMessage("getUserId: returning: " + tokenInfo.uid);
            return tokenInfo.uid;
        },

        getAccessTokenPayloadSecurely: async function(config: NormalisedInputType): Promise<any> {
            logDebugMessage("getAccessTokenPayloadSecurely: called");
            let tokenInfo = await FrontToken.getTokenInfo();
            if (tokenInfo === undefined) {
                throw new Error("No session exists");
            }

            if (tokenInfo.ate < Date.now()) {
                logDebugMessage("getAccessTokenPayloadSecurely: access token expired. Refreshing session");
                let retry = await AuthHttpRequest.attemptRefreshingSession();
                if (retry) {
                    return await this.getAccessTokenPayloadSecurely(config);
                } else {
                    throw new Error("Could not refresh session");
                }
            }
            logDebugMessage("getAccessTokenPayloadSecurely: returning: " + JSON.stringify(tokenInfo.up));
            return tokenInfo.up;
        },

        doesSessionExist: async function(config: NormalisedInputType): Promise<boolean> {
            logDebugMessage("doesSessionExist: called");
            const tokenInfo = await FrontToken.getTokenInfo();

            if (tokenInfo === undefined) {
                logDebugMessage("doesSessionExist: access token does not exist locally");
                return false;
            }

            if (tokenInfo.ate < Date.now()) {
                logDebugMessage("doesSessionExist: access token expired. Refreshing session");

                const preRequestLocalSessionState = await getLocalSessionState();
                const refresh = await onUnauthorisedResponse(preRequestLocalSessionState);
                return refresh.result === "RETRY";
            }

            return true;
        },

        signOut: async function(config: NormalisedInputType): Promise<void> {
            logDebugMessage("signOut: called");
            if (!(await this.doesSessionExist(config))) {
                config.onHandleEvent({
                    action: "SIGN_OUT"
                });
                return;
            }

            logDebugMessage("signOut: Calling refresh pre API hook");
            let preAPIResult = await config.preAPIHook({
                action: "SIGN_OUT",
                requestInit: {
                    method: "post",
                    headers: {
                        "fdi-version": supported_fdi.join(","),
                        rid: AuthHttpRequest.rid
                    }
                },
                url: AuthHttpRequest.signOutUrl
            });

            logDebugMessage("signOut: Calling API");
            let resp = await fetch(preAPIResult.url, preAPIResult.requestInit);
            logDebugMessage("signOut: API ended");
            logDebugMessage("signOut: API responded with status code: " + resp.status);

            if (resp.status === config.sessionExpiredStatusCode) {
                // refresh must have already sent session expiry event
                return;
            }

            if (resp.status >= 300) {
                throw resp;
            }

            let responseJson = await resp.clone().json();

            if (responseJson.status === "GENERAL_ERROR") {
                logDebugMessage("doRequest: Throwing general error");
                let message = responseJson.message === undefined ? "No Error Message Provided" : responseJson.message;
                throw new SuperTokensGeneralError(message);
            }

            // we do not send an event here since it's triggered in fireSessionUpdateEventsIfNecessary.
        },

        shouldDoInterceptionBasedOnUrl: (toCheckUrl, apiDomain, sessionTokenBackendDomain) => {
            logDebugMessage(
                "shouldDoInterceptionBasedOnUrl: toCheckUrl: " +
                    toCheckUrl +
                    " apiDomain: " +
                    apiDomain +
                    " sessionTokenBackendDomain: " +
                    sessionTokenBackendDomain
            );
            function isNumeric(str: any) {
                if (typeof str != "string") return false; // we only process strings!
                return (
                    !isNaN(str as any) && !isNaN(parseFloat(str)) // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
                ); // ...and ensure strings of whitespace fail
            }
            toCheckUrl = normaliseURLDomainOrThrowError(toCheckUrl);
            // @ts-ignore (Typescript complains that URL does not expect a parameter in constructor even though it does for react-native-url-polyfill)
            let urlObj: any = new URL(toCheckUrl);
            let domain = urlObj.hostname;
            if (sessionTokenBackendDomain === undefined) {
                domain = urlObj.port === "" ? domain : domain + ":" + urlObj.port;
                apiDomain = normaliseURLDomainOrThrowError(apiDomain);
                // @ts-ignore (Typescript complains that URL does not expect a parameter in constructor even though it does for react-native-url-polyfill)
                let apiUrlObj: any = new URL(apiDomain);
                return (
                    domain === (apiUrlObj.port === "" ? apiUrlObj.hostname : apiUrlObj.hostname + ":" + apiUrlObj.port)
                );
            } else {
                let normalisedSessionDomain = normaliseCookieDomainOrThrowError(sessionTokenBackendDomain);
                if (sessionTokenBackendDomain.split(":").length > 1) {
                    // this means that a port may have been provided
                    let portStr = sessionTokenBackendDomain.split(":")[sessionTokenBackendDomain.split(":").length - 1];
                    if (isNumeric(portStr)) {
                        normalisedSessionDomain += ":" + portStr;
                        domain = urlObj.port === "" ? domain : domain + ":" + urlObj.port;
                    }
                }
                if (sessionTokenBackendDomain.startsWith(".")) {
                    return ("." + domain).endsWith(normalisedSessionDomain);
                } else {
                    return domain === normalisedSessionDomain;
                }
            }
        }
    };
}

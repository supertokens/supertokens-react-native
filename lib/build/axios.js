var __awaiter =
    (this && this.__awaiter) ||
    function(thisArg, _arguments, P, generator) {
        function adopt(value) {
            return value instanceof P
                ? value
                : new P(function(resolve) {
                      resolve(value);
                  });
        }
        return new (P || (P = Promise))(function(resolve, reject) {
            function fulfilled(value) {
                try {
                    step(generator.next(value));
                } catch (e) {
                    reject(e);
                }
            }
            function rejected(value) {
                try {
                    step(generator["throw"](value));
                } catch (e) {
                    reject(e);
                }
            }
            function step(result) {
                result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
            }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    };
import { createAxiosErrorFromFetchResp } from "./axiosError";
import AuthHttpRequestFetch, { onUnauthorisedResponse } from "./fetch";
import FrontToken from "./frontToken";
import AntiCSRF from "./antiCsrf";
import { PROCESS_STATE, ProcessState } from "./processState";
import { fireSessionUpdateEventsIfNecessary, getLocalSessionState, getTokenForHeaderAuth, setToken } from "./utils";
import { logDebugMessage } from "./logger";
function incrementSessionRefreshAttemptCount(config) {
    if (config.__supertokensSessionRefreshAttempts === undefined) {
        config.__supertokensSessionRefreshAttempts = 0;
    }
    config.__supertokensSessionRefreshAttempts++;
}
function hasExceededMaxSessionRefreshAttempts(config) {
    if (config.__supertokensSessionRefreshAttempts === undefined) {
        config.__supertokensSessionRefreshAttempts = 0;
    }
    return config.__supertokensSessionRefreshAttempts >= AuthHttpRequestFetch.config.maxRetryAttemptsForSessionRefresh;
}
function getUrlFromConfig(config) {
    let url = config.url === undefined ? "" : config.url;
    let baseURL = config.baseURL;
    if (baseURL !== undefined) {
        if (url.charAt(0) === "/" && baseURL.charAt(baseURL.length - 1) === "/") {
            url = baseURL + url.substr(1);
        } else if (url.charAt(0) !== "/" && baseURL.charAt(baseURL.length - 1) !== "/") {
            url = baseURL + "/" + url;
        } else {
            url = baseURL + url;
        }
    }
    return url;
}
export function interceptorFunctionRequestFulfilled(config) {
    return __awaiter(this, void 0, void 0, function*() {
        logDebugMessage("interceptorFunctionRequestFulfilled: started axios interception");
        let url = getUrlFromConfig(config);
        let doNotDoInterception = false;
        try {
            doNotDoInterception =
                typeof url === "string" &&
                !AuthHttpRequestFetch.recipeImpl.shouldDoInterceptionBasedOnUrl(
                    url,
                    AuthHttpRequestFetch.config.apiDomain,
                    AuthHttpRequestFetch.config.sessionTokenBackendDomain
                );
        } catch (err) {
            // This is because when this function is called we always have a full URL (refer to getUrlFromConfig),
            // so we do not need to check for the case where axios is called with just a path (for example axios.post("/login"))
            throw err;
        }
        logDebugMessage("interceptorFunctionRequestFulfilled: Value of doNotDoInterception: " + doNotDoInterception);
        if (doNotDoInterception) {
            logDebugMessage("interceptorFunctionRequestFulfilled: Returning config unchanged");
            // this check means that if you are using axios via inteceptor, then we only do the refresh steps if you are calling your APIs.
            return config;
        }
        logDebugMessage("interceptorFunctionRequestFulfilled: Modifying config");
        ProcessState.getInstance().addState(PROCESS_STATE.CALLING_INTERCEPTION_REQUEST);
        const preRequestLocalSessionState = yield getLocalSessionState();
        let configWithAntiCsrf = config;
        if (preRequestLocalSessionState.status === "EXISTS") {
            const antiCsrfToken = yield AntiCSRF.getToken(preRequestLocalSessionState.lastAccessTokenUpdate);
            if (antiCsrfToken !== undefined) {
                logDebugMessage("interceptorFunctionRequestFulfilled: Adding anti-csrf token to request");
                configWithAntiCsrf = Object.assign(Object.assign({}, configWithAntiCsrf), {
                    headers:
                        configWithAntiCsrf === undefined
                            ? {
                                  "anti-csrf": antiCsrfToken
                              }
                            : Object.assign(Object.assign({}, configWithAntiCsrf.headers), {
                                  "anti-csrf": antiCsrfToken
                              })
                });
            }
        }
        if (AuthHttpRequestFetch.config.autoAddCredentials && configWithAntiCsrf.withCredentials === undefined) {
            logDebugMessage("interceptorFunctionRequestFulfilled: Adding credentials include");
            configWithAntiCsrf = Object.assign(Object.assign({}, configWithAntiCsrf), { withCredentials: true });
        }
        // adding rid for anti-csrf protection: Anti-csrf via custom header
        logDebugMessage(
            "interceptorFunctionRequestFulfilled: Adding rid header: anti-csrf (it may be overriden by the user's provided rid)"
        );
        configWithAntiCsrf = Object.assign(Object.assign({}, configWithAntiCsrf), {
            headers:
                configWithAntiCsrf === undefined
                    ? {
                          rid: "anti-csrf"
                      }
                    : Object.assign({ rid: "anti-csrf" }, configWithAntiCsrf.headers)
        });
        const transferMethod = AuthHttpRequestFetch.config.tokenTransferMethod;
        logDebugMessage("interceptorFunctionRequestFulfilled: Adding st-auth-mode header: " + transferMethod);
        configWithAntiCsrf.headers["st-auth-mode"] = transferMethod;
        configWithAntiCsrf = yield removeAuthHeaderIfMatchesLocalToken(configWithAntiCsrf);
        yield setAuthorizationHeaderIfRequired(configWithAntiCsrf);
        logDebugMessage("interceptorFunctionRequestFulfilled: returning modified config");
        return configWithAntiCsrf;
    });
}
export function responseInterceptor(axiosInstance) {
    return response =>
        __awaiter(this, void 0, void 0, function*() {
            let doNotDoInterception = false;
            if (!AuthHttpRequestFetch.initCalled) {
                throw new Error("init function not called");
            }
            logDebugMessage("responseInterceptor: started");
            logDebugMessage(
                "responseInterceptor: already intercepted: " + response.headers["x-supertokens-xhr-intercepted"]
            );
            let url = getUrlFromConfig(response.config);
            try {
                doNotDoInterception =
                    typeof url === "string" &&
                    !AuthHttpRequestFetch.recipeImpl.shouldDoInterceptionBasedOnUrl(
                        url,
                        AuthHttpRequestFetch.config.apiDomain,
                        AuthHttpRequestFetch.config.sessionTokenBackendDomain
                    );
            } catch (err) {
                // This is because when this function is called we always have a full URL (refer to getUrlFromConfig),
                // so we do not need to check for the case where axios is called with just a path (for example axios.post("/login"))
                throw err;
            }
            logDebugMessage("responseInterceptor: Value of doNotDoInterception: " + doNotDoInterception);
            if (doNotDoInterception) {
                logDebugMessage("responseInterceptor: Returning without interception");
                // this check means that if you are using axios via inteceptor, then we only do the refresh steps if you are calling your APIs.
                return response;
            }
            logDebugMessage("responseInterceptor: Interception started");
            ProcessState.getInstance().addState(PROCESS_STATE.CALLING_INTERCEPTION_RESPONSE);
            const preRequestLocalSessionState = yield getLocalSessionState();
            yield saveTokensFromHeaders(response);
            fireSessionUpdateEventsIfNecessary(
                preRequestLocalSessionState.status === "EXISTS",
                response.status,
                response.headers["front-token"]
            );
            if (response.status === AuthHttpRequestFetch.config.sessionExpiredStatusCode) {
                logDebugMessage("responseInterceptor: Status code is: " + response.status);
                let config = response.config;
                return AuthHttpRequest.doRequest(
                    config => {
                        // we create an instance since we don't want to intercept this.
                        // const instance = axios.create();
                        // return instance(config);
                        return axiosInstance(config);
                    },
                    config,
                    url,
                    response,
                    true
                );
            } else {
                return response;
            }
        });
}
export function responseErrorInterceptor(axiosInstance) {
    return error => {
        logDebugMessage("responseErrorInterceptor: called");
        logDebugMessage(
            "responseErrorInterceptor: already intercepted: " +
                (error.response && error.response.headers["x-supertokens-xhr-intercepted"])
        );
        if (
            error.response !== undefined &&
            error.response.status === AuthHttpRequestFetch.config.sessionExpiredStatusCode
        ) {
            logDebugMessage("responseErrorInterceptor: Status code is: " + error.response.status);
            let config = error.config;
            return AuthHttpRequest.doRequest(
                config => {
                    // we create an instance since we don't want to intercept this.
                    // const instance = axios.create();
                    // return instance(config);
                    return axiosInstance(config);
                },
                config,
                getUrlFromConfig(config),
                undefined,
                error,
                true
            );
        } else {
            throw error;
        }
    };
}
/**
 * @class AuthHttpRequest
 * @description wrapper for common http methods.
 */
export default class AuthHttpRequest {}
/**
 * @description sends the actual http request and returns a response if successful/
 * If not successful due to session expiry reasons, it
 * attempts to call the refresh token API and if that is successful, calls this API again.
 * @throws Error
 */
AuthHttpRequest.doRequest = (httpCall, config, url, prevResponse, prevError, viaInterceptor = false) =>
    __awaiter(void 0, void 0, void 0, function*() {
        if (!AuthHttpRequestFetch.initCalled) {
            throw Error("init function not called");
        }
        logDebugMessage("doRequest: called");
        let doNotDoInterception = false;
        try {
            doNotDoInterception =
                typeof url === "string" &&
                !AuthHttpRequestFetch.recipeImpl.shouldDoInterceptionBasedOnUrl(
                    url,
                    AuthHttpRequestFetch.config.apiDomain,
                    AuthHttpRequestFetch.config.sessionTokenBackendDomain
                ) &&
                viaInterceptor;
        } catch (err) {
            // This is because when this function is called we always have a full URL (refer to getUrlFromConfig),
            // so we do not need to check for the case where axios is called with just a path (for example axios.post("/login"))
            throw err;
        }
        logDebugMessage("doRequest: Value of doNotDoInterception: " + doNotDoInterception);
        if (doNotDoInterception) {
            logDebugMessage("doRequest: Returning without interception");
            if (prevError !== undefined) {
                throw prevError;
            } else if (prevResponse !== undefined) {
                return prevResponse;
            }
            return yield httpCall(config);
        }
        logDebugMessage("doRequest: Interception started");
        config = yield removeAuthHeaderIfMatchesLocalToken(config);
        let returnObj = undefined;
        while (true) {
            // we read this here so that if there is a session expiry error, then we can compare this value (that caused the error) with the value after the request is sent.
            // to avoid race conditions
            const preRequestLocalSessionState = yield getLocalSessionState();
            let configWithAntiCsrf = config;
            if (preRequestLocalSessionState.status === "EXISTS") {
                const antiCsrfToken = yield AntiCSRF.getToken(preRequestLocalSessionState.lastAccessTokenUpdate);
                if (antiCsrfToken !== undefined) {
                    logDebugMessage("doRequest: Adding anti-csrf token to request");
                    configWithAntiCsrf = Object.assign(Object.assign({}, configWithAntiCsrf), {
                        headers:
                            configWithAntiCsrf === undefined
                                ? {
                                      "anti-csrf": antiCsrfToken
                                  }
                                : Object.assign(Object.assign({}, configWithAntiCsrf.headers), {
                                      "anti-csrf": antiCsrfToken
                                  })
                    });
                }
            }
            if (AuthHttpRequestFetch.config.autoAddCredentials && configWithAntiCsrf.withCredentials === undefined) {
                logDebugMessage("doRequest: Adding credentials include");
                configWithAntiCsrf = Object.assign(Object.assign({}, configWithAntiCsrf), { withCredentials: true });
            }
            // adding rid for anti-csrf protection: Anti-csrf via custom header
            logDebugMessage("doRequest: Adding rid header: anti-csrf (May get overriden by user's rid)");
            configWithAntiCsrf = Object.assign(Object.assign({}, configWithAntiCsrf), {
                headers:
                    configWithAntiCsrf === undefined
                        ? {
                              rid: "anti-csrf"
                          }
                        : Object.assign({ rid: "anti-csrf" }, configWithAntiCsrf.headers)
            });
            const transferMethod = AuthHttpRequestFetch.config.tokenTransferMethod;
            logDebugMessage("doRequest: Adding st-auth-mode header: " + transferMethod);
            configWithAntiCsrf.headers["st-auth-mode"] = transferMethod;
            yield setAuthorizationHeaderIfRequired(configWithAntiCsrf);
            try {
                let localPrevError = prevError;
                let localPrevResponse = prevResponse;
                prevError = undefined;
                prevResponse = undefined;
                if (localPrevError !== undefined) {
                    logDebugMessage("doRequest: Not making call because localPrevError is not undefined");
                    throw localPrevError;
                }
                if (localPrevResponse !== undefined) {
                    logDebugMessage("doRequest: Not making call because localPrevResponse is not undefined");
                } else {
                    logDebugMessage("doRequest: Making user's http call");
                }
                let response = localPrevResponse === undefined ? yield httpCall(configWithAntiCsrf) : localPrevResponse;
                // NOTE: No need to check for unauthorized response status here for session refresh,
                // as we only reach this point on a successful response. Axios handles error responses
                // by throwing an error, which is handled in the catch block.
                logDebugMessage("doRequest: User's http call ended");
                yield saveTokensFromHeaders(response);
                fireSessionUpdateEventsIfNecessary(
                    preRequestLocalSessionState.status === "EXISTS",
                    response.status,
                    response.headers["front-token"]
                );
                return response;
            } catch (err) {
                const response = err.response;
                if (response !== undefined) {
                    yield saveTokensFromHeaders(response);
                    fireSessionUpdateEventsIfNecessary(
                        preRequestLocalSessionState.status === "EXISTS",
                        response.status,
                        response.headers["front-token"]
                    );
                    if (err.response.status === AuthHttpRequestFetch.config.sessionExpiredStatusCode) {
                        logDebugMessage("doRequest: Status code is: " + response.status);
                        /**
                         * An API may return a 401 error response even with a valid session, causing a session refresh loop in the interceptor.
                         * To prevent this infinite loop, we break out of the loop after retrying the original request a specified number of times.
                         * The maximum number of retry attempts is defined by maxRetryAttemptsForSessionRefresh config variable.
                         */
                        if (hasExceededMaxSessionRefreshAttempts(config)) {
                            logDebugMessage(
                                `doRequest: Maximum session refresh attempts reached. sessionRefreshAttempts: ${config.__supertokensSessionRefreshAttempts}, maxRetryAttemptsForSessionRefresh: ${AuthHttpRequestFetch.config.maxRetryAttemptsForSessionRefresh}`
                            );
                            throw new Error(
                                `Received a 401 response from ${url}. Attempted to refresh the session and retry the request with the updated session tokens ${AuthHttpRequestFetch.config.maxRetryAttemptsForSessionRefresh} times, but each attempt resulted in a 401 error. The maximum session refresh limit has been reached. Please investigate your API. To increase the session refresh attempts, update maxRetryAttemptsForSessionRefresh in the config.`
                            );
                        }
                        const refreshResult = yield onUnauthorisedResponse(preRequestLocalSessionState);
                        incrementSessionRefreshAttemptCount(config);
                        logDebugMessage(
                            "doRequest: sessionRefreshAttempts: " + config.__supertokensSessionRefreshAttempts
                        );
                        if (refreshResult.result !== "RETRY") {
                            logDebugMessage("doRequest: Not retrying original request");
                            // Returning refreshResult.error as an Axios Error if we attempted a refresh
                            // Returning the original error if we did not attempt refreshing
                            returnObj =
                                refreshResult.error !== undefined
                                    ? yield createAxiosErrorFromFetchResp(refreshResult.error)
                                    : err;
                            break;
                        }
                        logDebugMessage("doRequest: Retrying original request");
                    } else {
                        throw err;
                    }
                } else {
                    throw err;
                }
            }
        }
        // if it comes here, means we called break. which happens only if we have logged out.
        // which means it's a 401, so we throw
        throw returnObj;
    });
function saveTokensFromHeaders(response) {
    return __awaiter(this, void 0, void 0, function*() {
        logDebugMessage("saveTokensFromHeaders: Saving updated tokens from the response");
        const refreshToken = response.headers["st-refresh-token"];
        if (refreshToken !== undefined && refreshToken !== null) {
            logDebugMessage("saveTokensFromHeaders: saving new refresh token");
            yield setToken("refresh", refreshToken);
        }
        const accessToken = response.headers["st-access-token"];
        if (accessToken !== undefined && accessToken !== null) {
            logDebugMessage("saveTokensFromHeaders: saving new access token");
            yield setToken("access", accessToken);
        }
        const frontToken = response.headers["front-token"];
        if (frontToken !== undefined && frontToken !== null) {
            logDebugMessage("doRequest: Setting sFrontToken: " + frontToken);
            yield FrontToken.setItem(frontToken);
        }
        const antiCsrfToken = response.headers["anti-csrf"];
        if (antiCsrfToken !== undefined && antiCsrfToken !== null) {
            const tok = yield getLocalSessionState();
            if (tok.status === "EXISTS") {
                logDebugMessage("doRequest: Setting anti-csrf token");
                yield AntiCSRF.setItem(tok.lastAccessTokenUpdate, antiCsrfToken);
            }
        }
    });
}
function setAuthorizationHeaderIfRequired(requestConfig) {
    return __awaiter(this, void 0, void 0, function*() {
        if (requestConfig.headers === undefined) {
            // This is makes TS happy
            requestConfig.headers = {};
        }
        logDebugMessage("setAuthorizationHeaderIfRequired: adding existing tokens as header");
        // We set the Authorization header even if the tokenTransferMethod preference set in the config is cookies
        // since the active session may be using cookies. By default, we want to allow users to continue these sessions.
        // The new session preference should be applied at the start of the next session, if the backend allows it.
        const accessToken = yield getTokenForHeaderAuth("access");
        const refreshToken = yield getTokenForHeaderAuth("refresh");
        // We don't add the refresh token because that's only required by the refresh call which is done with fetch
        // Still, we only add the Authorization header if both are present, because we are planning to add an option to expose the
        // access token to the frontend while using cookie based auth - so that users can get the access token to use
        if (accessToken !== undefined && refreshToken !== undefined) {
            if (
                requestConfig.headers["Authorization"] !== undefined ||
                requestConfig.headers["authorization"] !== undefined
            ) {
                logDebugMessage(
                    "setAuthorizationHeaderIfRequired: Authorization header defined by the user, not adding"
                );
            } else {
                logDebugMessage("setAuthorizationHeaderIfRequired: added authorization header");
                requestConfig.headers = Object.assign(Object.assign({}, requestConfig.headers), {
                    Authorization: `Bearer ${accessToken}`
                });
                requestConfig.__supertokensAddedAuthHeader = true;
            }
        } else {
            logDebugMessage("setAuthorizationHeaderIfRequired: token for header based auth not found");
        }
    });
}
function removeAuthHeaderIfMatchesLocalToken(config) {
    return __awaiter(this, void 0, void 0, function*() {
        const accessToken = yield getTokenForHeaderAuth("access");
        const refreshToken = yield getTokenForHeaderAuth("refresh");
        const authHeader = config.headers.Authorization || config.headers.authorization;
        if (accessToken !== undefined && refreshToken !== undefined) {
            if (authHeader === `Bearer ${accessToken}` || "__supertokensAddedAuthHeader" in config) {
                // We are ignoring the Authorization header set by the user in this case, because it would cause issues
                // If we do not ignore this, then this header would be used even if the request is being retried after a refresh, even though it contains an outdated access token.
                // This causes an infinite refresh loop.
                logDebugMessage(
                    "removeAuthHeaderIfMatchesLocalToken: Removing Authorization from user provided headers because it contains our access token"
                );
                const res = Object.assign(Object.assign({}, config), { headers: Object.assign({}, config.headers) });
                delete res.headers.authorization;
                delete res.headers.Authorization;
                return res;
            }
        }
        return config;
    });
}

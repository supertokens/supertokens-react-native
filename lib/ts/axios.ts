/* Copyright (c) 2020, VRAI Labs and/or its affiliates. All rights reserved.
 *
 * This software is licensed under the Apache License, Version 2.0 (the
 * "License") as published by the Apache Software Foundation.
 *
 * You may not use this file except in compliance with the License. You may
 * obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 */
import { AxiosPromise, AxiosRequestConfig, AxiosResponse } from "axios";
import { createAxiosErrorFromAxiosResp, createAxiosErrorFromFetchResp } from "./axiosError";

import AuthHttpRequestFetch, { onUnauthorisedResponse } from "./fetch";

import FrontToken from "./frontToken";
import AntiCSRF from "./antiCsrf";
import { PROCESS_STATE, ProcessState } from "./processState";
import { fireSessionUpdateEventsIfNecessary, getLocalSessionState, getTokenForHeaderAuth, setToken } from "./utils";
import { logDebugMessage } from "./logger";

function getUrlFromConfig(config: AxiosRequestConfig) {
    let url: string = config.url === undefined ? "" : config.url;
    let baseURL: string | undefined = config.baseURL;
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

export async function interceptorFunctionRequestFulfilled(config: AxiosRequestConfig) {
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
    const preRequestLocalSessionState = await getLocalSessionState();
    let configWithAntiCsrf: AxiosRequestConfig = config;

    if (preRequestLocalSessionState.status === "EXISTS") {
        const antiCsrfToken = await AntiCSRF.getToken(preRequestLocalSessionState.lastAccessTokenUpdate);
        if (antiCsrfToken !== undefined) {
            logDebugMessage("interceptorFunctionRequestFulfilled: Adding anti-csrf token to request");
            configWithAntiCsrf = {
                ...configWithAntiCsrf,
                headers:
                    configWithAntiCsrf === undefined
                        ? {
                              "anti-csrf": antiCsrfToken
                          }
                        : {
                              ...configWithAntiCsrf.headers,
                              "anti-csrf": antiCsrfToken
                          }
            };
        }
    }

    if (AuthHttpRequestFetch.config.autoAddCredentials && configWithAntiCsrf.withCredentials === undefined) {
        logDebugMessage("interceptorFunctionRequestFulfilled: Adding credentials include");
        configWithAntiCsrf = {
            ...configWithAntiCsrf,
            withCredentials: true
        };
    }

    // adding rid for anti-csrf protection: Anti-csrf via custom header
    logDebugMessage(
        "interceptorFunctionRequestFulfilled: Adding rid header: anti-csrf (it may be overriden by the user's provided rid)"
    );
    configWithAntiCsrf = {
        ...configWithAntiCsrf,
        headers:
            configWithAntiCsrf === undefined
                ? {
                      rid: "anti-csrf"
                  }
                : {
                      rid: "anti-csrf",
                      ...configWithAntiCsrf.headers
                  }
    };

    const transferMethod = AuthHttpRequestFetch.config.tokenTransferMethod;
    logDebugMessage("interceptorFunctionRequestFulfilled: Adding st-auth-mode header: " + transferMethod);
    configWithAntiCsrf.headers!["st-auth-mode"] = transferMethod;

    configWithAntiCsrf = await removeAuthHeaderIfMatchesLocalToken(configWithAntiCsrf);

    await setAuthorizationHeaderIfRequired(configWithAntiCsrf);

    logDebugMessage("interceptorFunctionRequestFulfilled: returning modified config");
    return configWithAntiCsrf;
}

export function responseInterceptor(axiosInstance: any) {
    return async (response: AxiosResponse) => {
        let doNotDoInterception = false;

        try {
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

            const preRequestLocalSessionState = await getLocalSessionState();
            await saveTokensFromHeaders(response);

            fireSessionUpdateEventsIfNecessary(
                preRequestLocalSessionState.status === "EXISTS",
                response.status,
                response.headers["front-token"]
            );

            if (response.status === AuthHttpRequestFetch.config.sessionExpiredStatusCode) {
                logDebugMessage("responseInterceptor: Status code is: " + response.status);
                let config = response.config;
                return AuthHttpRequest.doRequest(
                    (config: AxiosRequestConfig) => {
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
        } finally {
            if (!doNotDoInterception && (await getLocalSessionState()).status !== "EXISTS") {
                logDebugMessage(
                    "responseInterceptor: local session doesn't exist, so removing anti-csrf and sFrontToken"
                );
                await AntiCSRF.removeToken();
                await FrontToken.removeToken();
            }
        }
    };
}

export function responseErrorInterceptor(axiosInstance: any) {
    return (error: any) => {
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
                (config: AxiosRequestConfig) => {
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
export default class AuthHttpRequest {
    /**
     * @description sends the actual http request and returns a response if successful/
     * If not successful due to session expiry reasons, it
     * attempts to call the refresh token API and if that is successful, calls this API again.
     * @throws Error
     */
    static doRequest = async (
        httpCall: (config: AxiosRequestConfig) => AxiosPromise<any>,
        config: AxiosRequestConfig,
        url?: string,
        prevResponse?: AxiosResponse,
        prevError?: any,
        viaInterceptor: boolean = false
    ): Promise<AxiosResponse<any>> => {
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
            return await httpCall(config);
        }
        logDebugMessage("doRequest: Interception started");

        config = await removeAuthHeaderIfMatchesLocalToken(config);
        try {
            let returnObj = undefined;
            while (true) {
                // we read this here so that if there is a session expiry error, then we can compare this value (that caused the error) with the value after the request is sent.
                // to avoid race conditions
                const preRequestLocalSessionState = await getLocalSessionState();
                let configWithAntiCsrf: AxiosRequestConfig = config;

                if (preRequestLocalSessionState.status === "EXISTS") {
                    const antiCsrfToken = await AntiCSRF.getToken(preRequestLocalSessionState.lastAccessTokenUpdate);
                    if (antiCsrfToken !== undefined) {
                        logDebugMessage("doRequest: Adding anti-csrf token to request");
                        configWithAntiCsrf = {
                            ...configWithAntiCsrf,
                            headers:
                                configWithAntiCsrf === undefined
                                    ? {
                                          "anti-csrf": antiCsrfToken
                                      }
                                    : {
                                          ...configWithAntiCsrf.headers,
                                          "anti-csrf": antiCsrfToken
                                      }
                        };
                    }
                }

                if (
                    AuthHttpRequestFetch.config.autoAddCredentials &&
                    configWithAntiCsrf.withCredentials === undefined
                ) {
                    logDebugMessage("doRequest: Adding credentials include");
                    configWithAntiCsrf = {
                        ...configWithAntiCsrf,
                        withCredentials: true
                    };
                }

                // adding rid for anti-csrf protection: Anti-csrf via custom header
                logDebugMessage("doRequest: Adding rid header: anti-csrf (May get overriden by user's rid)");
                configWithAntiCsrf = {
                    ...configWithAntiCsrf,
                    headers:
                        configWithAntiCsrf === undefined
                            ? {
                                  rid: "anti-csrf"
                              }
                            : {
                                  rid: "anti-csrf",
                                  ...configWithAntiCsrf.headers
                              }
                };

                const transferMethod = AuthHttpRequestFetch.config.tokenTransferMethod;
                logDebugMessage("doRequest: Adding st-auth-mode header: " + transferMethod);
                configWithAntiCsrf.headers!["st-auth-mode"] = transferMethod;

                await setAuthorizationHeaderIfRequired(configWithAntiCsrf);

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
                    let response =
                        localPrevResponse === undefined ? await httpCall(configWithAntiCsrf) : localPrevResponse;
                    logDebugMessage("doRequest: User's http call ended");

                    await saveTokensFromHeaders(response);

                    fireSessionUpdateEventsIfNecessary(
                        preRequestLocalSessionState.status === "EXISTS",
                        response.status,
                        response.headers["front-token"]
                    );

                    if (response.status === AuthHttpRequestFetch.config.sessionExpiredStatusCode) {
                        logDebugMessage("doRequest: Status code is: " + response.status);
                        const refreshResult = await onUnauthorisedResponse(preRequestLocalSessionState);

                        if (refreshResult.result !== "RETRY") {
                            logDebugMessage("doRequest: Not retrying original request");
                            returnObj = refreshResult.error
                                ? await createAxiosErrorFromFetchResp(refreshResult.error)
                                : await createAxiosErrorFromAxiosResp(response);
                            break;
                        }
                        logDebugMessage("doRequest: Retrying original request");
                    } else {
                        return response;
                    }
                } catch (err) {
                    const response = (err as any).response;
                    if (response !== undefined) {
                        await saveTokensFromHeaders(response);

                        fireSessionUpdateEventsIfNecessary(
                            preRequestLocalSessionState.status === "EXISTS",
                            response.status,
                            response.headers["front-token"]
                        );

                        if (err.response.status === AuthHttpRequestFetch.config.sessionExpiredStatusCode) {
                            logDebugMessage("doRequest: Status code is: " + response.status);
                            const refreshResult = await onUnauthorisedResponse(preRequestLocalSessionState);
                            if (refreshResult.result !== "RETRY") {
                                logDebugMessage("doRequest: Not retrying original request");
                                // Returning refreshResult.error as an Axios Error if we attempted a refresh
                                // Returning the original error if we did not attempt refreshing
                                returnObj =
                                    refreshResult.error !== undefined
                                        ? await createAxiosErrorFromFetchResp(refreshResult.error)
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
        } finally {
            // If we get here we already tried refreshing so we should have the already id refresh token either in EXISTS or NOT_EXISTS, so no need to call the backend
            // The backend should not be down if we get here, but even if it were we shouldn't need to call refresh
            const postRequestLocalSessionState = await getLocalSessionState();
            if (postRequestLocalSessionState.status === "NOT_EXISTS") {
                logDebugMessage("doRequest: local session doesn't exist, so removing anti-csrf and sFrontToken");
                await AntiCSRF.removeToken();
                await FrontToken.removeToken();
            }
        }
    };
}

async function saveTokensFromHeaders(response: AxiosResponse) {
    logDebugMessage("saveTokensFromHeaders: Saving updated tokens from the response");
    const refreshToken = response.headers["st-refresh-token"];
    if (refreshToken !== undefined && refreshToken !== null) {
        logDebugMessage("saveTokensFromHeaders: saving new refresh token");
        await setToken("refresh", refreshToken);
    }

    const accessToken = response.headers["st-access-token"];
    if (accessToken !== undefined && accessToken !== null) {
        logDebugMessage("saveTokensFromHeaders: saving new access token");
        await setToken("access", accessToken);
    }

    const frontToken = response.headers["front-token"];
    if (frontToken !== undefined && frontToken !== null) {
        logDebugMessage("doRequest: Setting sFrontToken: " + frontToken);
        await FrontToken.setItem(frontToken);
    }

    const antiCsrfToken = response.headers["anti-csrf"];
    if (antiCsrfToken !== undefined && antiCsrfToken !== null) {
        const tok = await getLocalSessionState();
        if (tok.status === "EXISTS") {
            logDebugMessage("doRequest: Setting anti-csrf token");
            await AntiCSRF.setItem(tok.lastAccessTokenUpdate, antiCsrfToken);
        }
    }
}

async function setAuthorizationHeaderIfRequired(requestConfig: AxiosRequestConfig) {
    if (requestConfig.headers === undefined) {
        // This is makes TS happy
        requestConfig.headers = {};
    }

    logDebugMessage("setAuthorizationHeaderIfRequired: adding existing tokens as header");

    // We set the Authorization header even if the tokenTransferMethod preference set in the config is cookies
    // since the active session may be using cookies. By default, we want to allow users to continue these sessions.
    // The new session preference should be applied at the start of the next session, if the backend allows it.

    const accessToken = await getTokenForHeaderAuth("access");
    const refreshToken = await getTokenForHeaderAuth("refresh");

    // We don't add the refresh token because that's only required by the refresh call which is done with fetch
    // Still, we only add the Authorization header if both are present, because we are planning to add an option to expose the
    // access token to the frontend while using cookie based auth - so that users can get the access token to use
    if (accessToken !== undefined && refreshToken !== undefined) {
        if (
            requestConfig.headers["Authorization"] !== undefined ||
            requestConfig.headers["authorization"] !== undefined
        ) {
            logDebugMessage("setAuthorizationHeaderIfRequired: Authorization header defined by the user, not adding");
        } else {
            logDebugMessage("setAuthorizationHeaderIfRequired: added authorization header");
            requestConfig.headers = {
                ...requestConfig.headers,
                Authorization: `Bearer ${accessToken}`
            };
        }
    } else {
        logDebugMessage("setAuthorizationHeaderIfRequired: token for header based auth not found");
    }
}

async function removeAuthHeaderIfMatchesLocalToken(config: AxiosRequestConfig) {
    const accessToken = await getTokenForHeaderAuth("access");
    const refreshToken = await getTokenForHeaderAuth("refresh");
    const authHeader = config.headers!.Authorization || config.headers!.authorization;

    if (accessToken !== undefined && refreshToken !== undefined) {
        if (authHeader === `Bearer ${accessToken}`) {
            // We are ignoring the Authorization header set by the user in this case, because it would cause issues
            // If we do not ignore this, then this header would be used even if the request is being retried after a refresh, even though it contains an outdated access token.
            // This causes an infinite refresh loop.
            logDebugMessage(
                "removeAuthHeaderIfMatchesLocalToken: Removing Authorization from user provided headers because it contains our access token"
            );
            const res = { ...config, headers: { ...config.headers } };
            delete res.headers.authorization;
            delete res.headers.Authorization;
            return res;
        }
    }
    return config;
}

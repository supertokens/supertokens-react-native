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

import { PROCESS_STATE, ProcessState } from "./processState";
import { supported_fdi } from "./version";
import AntiCSRF from "./antiCsrf";
import IdRefreshToken from "./idRefreshToken";
import getLock from "./locking";
import { IdRefreshTokenType, InputType, NormalisedInputType } from "./types";
import { shouldDoInterceptionBasedOnUrl, validateAndNormaliseInputOrThrowError } from "./utils";
import FrontToken from "./frontToken";
import RecipeImplementation from "./recipeImplementation";

declare let global: any;

/**
 * @description returns true if retry, else false is session has expired completely.
 */
export async function handleUnauthorised(
    preRequestIdToken: IdRefreshTokenType,
    httpCall?: (url: string, init?: RequestInit) => Promise<Response>
): Promise<boolean> {
    let result = await onUnauthorisedResponse(preRequestIdToken, httpCall);
    if (result.result === "SESSION_EXPIRED") {
        return false;
    } else if (result.result === "API_ERROR") {
        throw result.error;
    }
    return true;
}

export function getDomainFromUrl(url: string): string {
    // if (window.fetch === undefined) {
    //     // we are testing
    //     return "http://localhost:8888";
    // }
    if (url.startsWith("https://") || url.startsWith("http://")) {
        return url
            .split("/")
            .filter((_, i) => i <= 2)
            .join("/");
    } else {
        throw new Error("Please make sure that the provided URL starts with http:// or https://");
    }
}

/**
 * @class AuthHttpRequest
 * @description wrapper for common http methods.
 */
export default class AuthHttpRequest {
    static refreshTokenUrl: string;
    static signOutUrl: string;
    static initCalled = false;
    static rid: string;
    static env: any;
    static recipeImpl: RecipeImplementation;
    static config: NormalisedInputType;

    static init(options: InputType) {
        let config = validateAndNormaliseInputOrThrowError(options);
        AuthHttpRequest.env = global;

        AuthHttpRequest.refreshTokenUrl = config.apiDomain + config.apiBasePath + "/session/refresh";
        AuthHttpRequest.signOutUrl = config.apiDomain + config.apiBasePath + "/signout";
        AuthHttpRequest.rid = "session";
        AuthHttpRequest.config = config;

        if (AuthHttpRequest.env.__supertokensOriginalFetch === undefined) {
            // this block contains code that is run just once per page load..
            // all items in this block are attached to the global env so that
            // even if the init function is called more than once (maybe across JS scripts),
            // things will not get created multiple times.
            AuthHttpRequest.env.__supertokensOriginalFetch = AuthHttpRequest.env.fetch.bind(AuthHttpRequest.env);
            AuthHttpRequest.env.__supertokensSessionRecipe = config.override.functions(new RecipeImplementation());
            AuthHttpRequest.env.fetch = AuthHttpRequest.env.__supertokensSessionRecipe.addFetchInterceptorsAndReturnModifiedFetch(
                AuthHttpRequest.env.__supertokensOriginalFetch,
                config
            );
        }

        AuthHttpRequest.recipeImpl = AuthHttpRequest.env.__supertokensSessionRecipe;
        AuthHttpRequest.initCalled = true;
    }

    /**
     * @description sends the actual http request and returns a response if successful/
     * If not successful due to session expiry reasons, it
     * attempts to call the refresh token API and if that is successful, calls this API again.
     * @throws Error
     */
    static doRequest = async (
        httpCall: (config?: RequestInit) => Promise<Response>,
        config?: RequestInit,
        url?: any
    ): Promise<Response> => {
        if (!AuthHttpRequest.initCalled) {
            throw Error("init function not called");
        }

        let doNotDoInterception = false;

        try {
            doNotDoInterception =
                (typeof url === "string" &&
                    !shouldDoInterceptionBasedOnUrl(
                        url,
                        AuthHttpRequest.config.apiDomain,
                        AuthHttpRequest.config.cookieDomain
                    )) ||
                (url !== undefined &&
                typeof url.url === "string" && // this is because url can be an object like {method: ..., url: ...}
                    !shouldDoInterceptionBasedOnUrl(
                        url.url,
                        AuthHttpRequest.config.apiDomain,
                        AuthHttpRequest.config.cookieDomain
                    ));
        } catch (err) {
            if (err.message === "Please provide a valid domain name") {
                // .origin gives the port as well..
                doNotDoInterception = !shouldDoInterceptionBasedOnUrl(
                    window.location.origin,
                    AuthHttpRequest.config.apiDomain,
                    AuthHttpRequest.config.cookieDomain
                );
            } else {
                throw err;
            }
        }

        if (doNotDoInterception) {
            return await httpCall(config);
        }

        ProcessState.getInstance().addState(PROCESS_STATE.CALLING_INTERCEPTION_REQUEST);

        try {
            let throwError = false;
            let returnObj = undefined;
            while (true) {
                // we read this here so that if there is a session expiry error, then we can compare this value (that caused the error) with the value after the request is sent.
                // to avoid race conditions
                const preRequestIdToken = await IdRefreshToken.getIdRefreshToken(true);
                let configWithAntiCsrf: RequestInit | undefined = config;

                if (preRequestIdToken.status === "EXISTS") {
                    const antiCsrfToken = await AntiCSRF.getToken(preRequestIdToken.token);
                    if (antiCsrfToken !== undefined) {
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

                if (AuthHttpRequest.config.autoAddCredentials) {
                    if (configWithAntiCsrf === undefined) {
                        configWithAntiCsrf = {
                            credentials: "include"
                        };
                    } else if (configWithAntiCsrf.credentials === undefined) {
                        configWithAntiCsrf = {
                            ...configWithAntiCsrf,
                            credentials: "include"
                        };
                    }
                }

                // adding rid for anti-csrf protection: Anti-csrf via custom header
                configWithAntiCsrf = {
                    ...configWithAntiCsrf,
                    headers:
                        configWithAntiCsrf === undefined
                            ? {
                                  rid: AuthHttpRequest.rid
                              }
                            : {
                                  rid: AuthHttpRequest.rid,
                                  ...configWithAntiCsrf.headers
                              }
                };

                try {
                    let response = await httpCall(configWithAntiCsrf);
                    const idRefreshToken = response.headers.get("id-refresh-token");

                    if (idRefreshToken) {
                        await IdRefreshToken.setIdRefreshToken(idRefreshToken, response.status);
                    }

                    if (response.status === AuthHttpRequest.config.sessionExpiredStatusCode) {
                        let retry = await handleUnauthorised(preRequestIdToken);
                        if (!retry) {
                            returnObj = response;
                            break;
                        }
                    } else {
                        const antiCsrfToken = response.headers.get("anti-csrf");
                        if (antiCsrfToken) {
                            const tok = await IdRefreshToken.getIdRefreshToken(true);
                            if (tok.status === "EXISTS") {
                                await AntiCSRF.setItem(tok.token, antiCsrfToken);
                            }
                        }

                        const frontToken = response.headers.get("front-token");
                        if (frontToken) {
                            await FrontToken.setItem(frontToken);
                        }
                        return response;
                    }
                } catch (err) {
                    if (err.status === AuthHttpRequest.config.sessionExpiredStatusCode) {
                        let retry = await handleUnauthorised(preRequestIdToken);
                        if (!retry) {
                            throwError = true;
                            returnObj = err;
                            break;
                        }
                    } else {
                        throw err;
                    }
                }
            }
            // if it comes here, means we breaked. which happens only if we have logged out.
            if (throwError) {
                throw returnObj;
            } else {
                return returnObj;
            }
        } finally {
            if (!(await AuthHttpRequest.recipeImpl.doesSessionExist(AuthHttpRequest.config))) {
                await AntiCSRF.removeToken();
                await FrontToken.removeToken();
            }
        }
    };

    static attemptRefreshingSession = async (): Promise<boolean> => {
        const preRequestIdToken = await IdRefreshToken.getIdRefreshToken(false);
        return await handleUnauthorised(preRequestIdToken);
    };
}

const LOCK_NAME = "REFRESH_TOKEN_USE";

async function onUnauthorisedResponse(
    preRequestIdToken: IdRefreshTokenType,
    httpCall?: (url: string, init?: RequestInit) => Promise<Response>
): Promise<{ result: "SESSION_EXPIRED" } | { result: "API_ERROR"; error: any } | { result: "RETRY" }> {
    let lock = getLock();
    await lock.lock(LOCK_NAME);
    try {
        let postLockID = await IdRefreshToken.getIdRefreshToken(false);

        if (postLockID.status === "NOT_EXISTS") {
            // if it comes here, it means a request was made thinking
            // that the session exists, but it doesn't actually exist.
            AuthHttpRequest.config.onHandleEvent({
                action: "UNAUTHORISED",
                sessionExpiredOrRevoked: false
            });
            return { result: "SESSION_EXPIRED" };
        }

        if (
            postLockID.status !== preRequestIdToken.status ||
            (postLockID.status === "EXISTS" &&
                preRequestIdToken.status === "EXISTS" &&
                postLockID.token !== preRequestIdToken.token)
        ) {
            // means that some other process has already called this API and succeeded. so we need to call it again
            return { result: "RETRY" };
        }

        let headers: any = {};

        if (preRequestIdToken.status === "EXISTS") {
            const antiCsrfToken = await AntiCSRF.getToken(preRequestIdToken.token);
            if (antiCsrfToken !== undefined) {
                headers = {
                    ...headers,
                    "anti-csrf": antiCsrfToken
                };
            }
        }

        headers = {
            rid: AuthHttpRequest.rid, // adding for anti-csrf protection (via custom header)
            ...headers,
            "fdi-version": supported_fdi.join(",")
        };

        let preAPIResult = await AuthHttpRequest.config.preAPIHook({
            action: "REFRESH_SESSION",
            requestInit: {
                method: "post",
                credentials: "include",
                headers
            },
            url: AuthHttpRequest.refreshTokenUrl
        });

        const makeRequest = httpCall || AuthHttpRequest.env.__supertokensOriginalFetch;
        const response = await makeRequest(preAPIResult.url, preAPIResult.requestInit);

        let removeIdRefreshToken = true;
        const idRefreshToken = response.headers.get("id-refresh-token");
        if (idRefreshToken) {
            await IdRefreshToken.setIdRefreshToken(idRefreshToken, response.status);
            removeIdRefreshToken = false;
        }

        if (response.status === AuthHttpRequest.config.sessionExpiredStatusCode) {
            // there is a case where frontend still has id refresh token, but backend doesn't get it. In this event, session expired error will be thrown and the frontend should remove this token
            if (removeIdRefreshToken) {
                await IdRefreshToken.setIdRefreshToken("remove", response.status);
            }
        }

        if (response.status >= 300) {
            throw response;
        }

        if ((await IdRefreshToken.getIdRefreshToken(false)).status === "NOT_EXISTS") {
            // The execution should never come here.. but just in case.
            // removed by server. So we logout

            // we do not send "UNAUTHORISED" event here because
            // this is a result of the refresh API returning a session expiry, which
            // means that the frontend did not know for sure that the session existed
            // in the first place.
            return { result: "SESSION_EXPIRED" };
        }

        const antiCsrfToken = response.headers.get("anti-csrf");
        if (antiCsrfToken) {
            const tok = await IdRefreshToken.getIdRefreshToken(true);
            if (tok.status === "EXISTS") {
                await AntiCSRF.setItem(tok.token, antiCsrfToken);
            }
        }

        const frontToken = response.headers.get("front-token");
        if (frontToken) {
            await FrontToken.setItem(frontToken);
        }

        AuthHttpRequest.config.onHandleEvent({
            action: "REFRESH_SESSION"
        });
        return { result: "RETRY" };
    } catch (error) {
        if ((await IdRefreshToken.getIdRefreshToken(false)).status === "NOT_EXISTS") {
            // removed by server.

            // we do not send "UNAUTHORISED" event here because
            // this is a result of the refresh API returning a session expiry, which
            // means that the frontend did not know for sure that the session existed
            // in the first place.
            return { result: "SESSION_EXPIRED" };
        }

        return { result: "API_ERROR", error };
    } finally {
        lock.unlock(LOCK_NAME);

        if ((await IdRefreshToken.getIdRefreshToken(false)).status === "NOT_EXISTS") {
            await AntiCSRF.removeToken();
            await FrontToken.removeToken();
        }
    }
}
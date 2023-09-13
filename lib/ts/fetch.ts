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
import getLock from "./locking";
import { InputType, NormalisedInputType, RecipeInterface, TokenType } from "./types";
import {
    fireSessionUpdateEventsIfNecessary,
    getLocalSessionState,
    getTokenForHeaderAuth,
    LocalSessionState,
    setToken,
    validateAndNormaliseInputOrThrowError
} from "./utils";
import FrontToken from "./frontToken";
import RecipeImplementation from "./recipeImplementation";
import OverrideableBuilder from "supertokens-js-override";

declare let global: any;

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
    static recipeImpl: RecipeInterface;
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
            {
                const builder = new OverrideableBuilder(RecipeImplementation());
                AuthHttpRequest.env.__supertokensSessionRecipe = builder
                    .override(this.config.override.functions)
                    .build();
            }
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
                    !AuthHttpRequest.recipeImpl.shouldDoInterceptionBasedOnUrl(
                        url,
                        AuthHttpRequest.config.apiDomain,
                        AuthHttpRequest.config.sessionTokenBackendDomain
                    )) ||
                (url !== undefined &&
                typeof url.url === "string" && // this is because url can be an object like {method: ..., url: ...}
                    !AuthHttpRequest.recipeImpl.shouldDoInterceptionBasedOnUrl(
                        url.url,
                        AuthHttpRequest.config.apiDomain,
                        AuthHttpRequest.config.sessionTokenBackendDomain
                    ));
        } catch (err) {
            // This is because in react native it is not possible to call fetch with only a path (Example fetch("/login"))
            // so we dont need to check for that here
            throw err;
        }

        if (doNotDoInterception) {
            return await httpCall(config);
        }

        const originalHeaders = new Headers(
            config !== undefined && config.headers !== undefined ? config.headers : url.headers
        );

        if (originalHeaders.has("Authorization")) {
            const accessToken = await getTokenForHeaderAuth("access");
            const refreshToken = await getTokenForHeaderAuth("refresh");

            if (
                accessToken !== undefined &&
                refreshToken !== undefined &&
                originalHeaders.get("Authorization") === `Bearer ${accessToken}`
            ) {
                // We are ignoring the Authorization header set by the user in this case, because it would cause issues
                // If we do not ignore this, then this header would be used even if the request is being retried after a refresh, even though it contains an outdated access token.
                // This causes an infinite refresh loop.

                originalHeaders.delete("Authorization");
            }
        }

        ProcessState.getInstance().addState(PROCESS_STATE.CALLING_INTERCEPTION_REQUEST);

        try {
            let returnObj = undefined;
            while (true) {
                // we read this here so that if there is a session expiry error, then we can compare this value (that caused the error) with the value after the request is sent.
                // to avoid race conditions
                const preRequestLocalSessionState = await getLocalSessionState();
                const clonedHeaders = new Headers(originalHeaders);

                let configWithAntiCsrf: RequestInit | undefined = {
                    ...config,
                    headers: clonedHeaders
                };

                if (preRequestLocalSessionState.status === "EXISTS") {
                    const antiCsrfToken = await AntiCSRF.getToken(preRequestLocalSessionState.lastAccessTokenUpdate);
                    if (antiCsrfToken !== undefined) {
                        clonedHeaders.set("anti-csrf", antiCsrfToken);
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
                if (!clonedHeaders.has("rid")) {
                    clonedHeaders.set("rid", "anti-csrf");
                }

                const transferMethod = AuthHttpRequest.config.tokenTransferMethod;
                clonedHeaders.set("st-auth-mode", transferMethod);

                await setAuthorizationHeaderIfRequired(clonedHeaders);

                let response = await httpCall(configWithAntiCsrf);

                await saveTokensFromHeaders(response);

                fireSessionUpdateEventsIfNecessary(
                    preRequestLocalSessionState.status === "EXISTS",
                    response.status,
                    response.headers.get("front-token")
                );

                if (response.status === AuthHttpRequest.config.sessionExpiredStatusCode) {
                    let refreshResponse = await onUnauthorisedResponse(preRequestLocalSessionState);
                    if (refreshResponse.result !== "RETRY") {
                        returnObj = refreshResponse.error !== undefined ? refreshResponse.error : response;
                        break;
                    }
                } else {
                    return response;
                }
            }

            // if it comes here, means we breaked. which happens only if we have logged out.
            return returnObj;
        } finally {
            // If we get here we already tried refreshing so we should have the already id refresh token either in EXISTS or NOT_EXISTS, so no need to call the backend
            // or the backend is down and we don't need to call it.
            const postRequestLocalSessionState = await getLocalSessionState();
            if (postRequestLocalSessionState.status === "NOT_EXISTS") {
                await AntiCSRF.removeToken();
                await FrontToken.removeToken();
            }
        }
    };

    static attemptRefreshingSession = async (): Promise<boolean> => {
        if (!AuthHttpRequest.initCalled) {
            throw new Error("init function not called");
        }

        const preRequestLocalSessionState = await getLocalSessionState();
        const refreshResponse = await onUnauthorisedResponse(preRequestLocalSessionState);

        if (refreshResponse.result === "API_ERROR") {
            throw refreshResponse.error;
        }

        return refreshResponse.result === "RETRY";
    };
}

const LOCK_NAME = "REFRESH_TOKEN_USE";

export async function onUnauthorisedResponse(
    preRequestLocalSessionState: LocalSessionState
): Promise<{ result: "SESSION_EXPIRED"; error?: any } | { result: "API_ERROR"; error: any } | { result: "RETRY" }> {
    let lock = getLock();
    await lock.lock(LOCK_NAME);
    try {
        let postLockLocalSessionState = await getLocalSessionState();

        if (postLockLocalSessionState.status === "NOT_EXISTS") {
            // if it comes here, it means a request was made thinking
            // that the session exists, but it doesn't actually exist.
            AuthHttpRequest.config.onHandleEvent({
                action: "UNAUTHORISED",
                sessionExpiredOrRevoked: false
            });
            return { result: "SESSION_EXPIRED" };
        }

        if (
            postLockLocalSessionState.status !== preRequestLocalSessionState.status ||
            (postLockLocalSessionState.status === "EXISTS" &&
                preRequestLocalSessionState.status === "EXISTS" &&
                postLockLocalSessionState.lastAccessTokenUpdate !== preRequestLocalSessionState.lastAccessTokenUpdate)
        ) {
            // means that some other process has already called this API and succeeded. so we need to call it again
            return { result: "RETRY" };
        }

        let headers = new Headers();

        if (preRequestLocalSessionState.status === "EXISTS") {
            const antiCsrfToken = await AntiCSRF.getToken(preRequestLocalSessionState.lastAccessTokenUpdate);
            if (antiCsrfToken !== undefined) {
                headers.set("anti-csrf", antiCsrfToken);
            }
        }

        headers.set("rid", AuthHttpRequest.rid);
        headers.set("fdi-version", supported_fdi.join(","));

        const transferMethod = AuthHttpRequest.config.tokenTransferMethod;
        headers.set("st-auth-mode", transferMethod);

        await setAuthorizationHeaderIfRequired(headers, true);

        let preAPIResult = await AuthHttpRequest.config.preAPIHook({
            action: "REFRESH_SESSION",
            requestInit: {
                method: "post",
                credentials: "include",
                headers
            },
            url: AuthHttpRequest.refreshTokenUrl
        });

        const response = await AuthHttpRequest.env.__supertokensOriginalFetch(
            preAPIResult.url,
            preAPIResult.requestInit
        );

        await saveTokensFromHeaders(response);

        const isUnauthorised = response.status === AuthHttpRequest.config.sessionExpiredStatusCode;

        // There is a case where the FE thinks the session is valid, but backend doesn't get the tokens.
        // In this event, session expired error will be thrown and the frontend should remove this token
        if (isUnauthorised && response.headers.get("front-token") === null) {
            FrontToken.setItem("remove");
        }

        fireSessionUpdateEventsIfNecessary(
            preRequestLocalSessionState.status === "EXISTS",
            response.status,
            isUnauthorised && response.headers.get("front-token") === null
                ? "remove"
                : response.headers.get("front-token")
        );

        if (response.status >= 300) {
            throw response;
        }

        if ((await getLocalSessionState()).status === "NOT_EXISTS") {
            // The execution should never come here.. but just in case.
            // removed by server. So we logout

            // we do not send "UNAUTHORISED" event here because
            // this is a result of the refresh API returning a session expiry, which
            // means that the frontend did not know for sure that the session existed
            // in the first place.
            return { result: "SESSION_EXPIRED" };
        }

        AuthHttpRequest.config.onHandleEvent({
            action: "REFRESH_SESSION"
        });
        return { result: "RETRY" };
    } catch (error) {
        if ((await getLocalSessionState()).status === "NOT_EXISTS") {
            // removed by server.

            // we do not send "UNAUTHORISED" event here because
            // this is a result of the refresh API returning a session expiry, which
            // means that the frontend did not know for sure that the session existed
            // in the first place.
            return { result: "SESSION_EXPIRED", error };
        }

        return { result: "API_ERROR", error };
    } finally {
        lock.unlock(LOCK_NAME);

        if ((await getLocalSessionState()).status === "NOT_EXISTS") {
            await AntiCSRF.removeToken();
            await FrontToken.removeToken();
        }
    }
}

async function saveTokensFromHeaders(response: Response) {
    const refreshToken = response.headers.get("st-refresh-token");
    if (refreshToken !== undefined && refreshToken !== null) {
        await setToken("refresh", refreshToken);
    }

    const accessToken = response.headers.get("st-access-token");
    if (accessToken !== undefined && accessToken !== null) {
        await setToken("access", accessToken);
    }

    const frontToken = response.headers.get("front-token");
    if (frontToken !== undefined && frontToken !== null) {
        await FrontToken.setItem(frontToken);
    }
    const antiCsrfToken = response.headers.get("anti-csrf");
    if (antiCsrfToken !== undefined && antiCsrfToken !== null) {
        const tok = await getLocalSessionState();
        if (tok.status === "EXISTS") {
            await AntiCSRF.setItem(tok.lastAccessTokenUpdate, antiCsrfToken);
        }
    }
}

async function setAuthorizationHeaderIfRequired(clonedHeaders: Headers, addRefreshToken: boolean = false) {
    // We set the Authorization header even if the tokenTransferMethod preference set in the config is cookies
    // since the active session may be using cookies. By default, we want to allow users to continue these sessions.
    // The new session preference should be applied at the start of the next session, if the backend allows it.

    const accessToken = await getTokenForHeaderAuth("access");
    const refreshToken = await getTokenForHeaderAuth("refresh");

    // We don't always need the refresh token because that's only required by the refresh call
    // Still, we only add the Authorization header if both are present, because we are planning to add an option to expose the
    // access token to the frontend while using cookie based auth - so that users can get the access token to use
    if ((addRefreshToken || accessToken !== undefined) && refreshToken !== undefined) {
        // the Headers class normalizes header names so we don't have to worry about casing
        if (clonedHeaders.has("Authorization")) {
        } else {
            clonedHeaders.set("Authorization", `Bearer ${addRefreshToken ? refreshToken : accessToken}`);
        }
    }
}

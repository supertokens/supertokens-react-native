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
var __awaiter =
    (this && this.__awaiter) ||
    function(thisArg, _arguments, P, generator) {
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
                result.done
                    ? resolve(result.value)
                    : new P(function(resolve) {
                          resolve(result.value);
                      }).then(fulfilled, rejected);
            }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    };
import { PROCESS_STATE, ProcessState } from "./processState";
import { supported_fdi } from "./version";
import AntiCSRF from "./antiCsrf";
import IdRefreshToken from "./idRefreshToken";
import getLock from "./locking";
import { shouldDoInterceptionBasedOnUrl, validateAndNormaliseInputOrThrowError } from "./utils";
import FrontToken from "./frontToken";
import RecipeImplementation from "./recipeImplementation";
/**
 * @class AuthHttpRequest
 * @description wrapper for common http methods.
 */
export default class AuthHttpRequest {
    static init(options) {
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
}
AuthHttpRequest.initCalled = false;
/**
 * @description sends the actual http request and returns a response if successful/
 * If not successful due to session expiry reasons, it
 * attempts to call the refresh token API and if that is successful, calls this API again.
 * @throws Error
 */
AuthHttpRequest.doRequest = (httpCall, config, url) =>
    __awaiter(this, void 0, void 0, function*() {
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
            return yield httpCall(config);
        }
        ProcessState.getInstance().addState(PROCESS_STATE.CALLING_INTERCEPTION_REQUEST);
        try {
            let returnObj = undefined;
            while (true) {
                // we read this here so that if there is a session expiry error, then we can compare this value (that caused the error) with the value after the request is sent.
                // to avoid race conditions
                const preRequestIdToken = yield IdRefreshToken.getIdRefreshToken(true);
                let configWithAntiCsrf = config;
                if (preRequestIdToken.status === "EXISTS") {
                    const antiCsrfToken = yield AntiCSRF.getToken(preRequestIdToken.token);
                    if (antiCsrfToken !== undefined) {
                        configWithAntiCsrf = Object.assign({}, configWithAntiCsrf, {
                            headers:
                                configWithAntiCsrf === undefined
                                    ? {
                                          "anti-csrf": antiCsrfToken
                                      }
                                    : Object.assign({}, configWithAntiCsrf.headers, { "anti-csrf": antiCsrfToken })
                        });
                    }
                }
                if (AuthHttpRequest.config.autoAddCredentials) {
                    if (configWithAntiCsrf === undefined) {
                        configWithAntiCsrf = {
                            credentials: "include"
                        };
                    } else if (configWithAntiCsrf.credentials === undefined) {
                        configWithAntiCsrf = Object.assign({}, configWithAntiCsrf, { credentials: "include" });
                    }
                }
                // adding rid for anti-csrf protection: Anti-csrf via custom header
                configWithAntiCsrf = Object.assign({}, configWithAntiCsrf, {
                    headers:
                        configWithAntiCsrf === undefined
                            ? {
                                  rid: AuthHttpRequest.rid
                              }
                            : Object.assign({ rid: AuthHttpRequest.rid }, configWithAntiCsrf.headers)
                });
                let response = yield httpCall(configWithAntiCsrf);
                const idRefreshToken = response.headers.get("id-refresh-token");
                if (idRefreshToken) {
                    yield IdRefreshToken.setIdRefreshToken(idRefreshToken, response.status);
                }
                if (response.status === AuthHttpRequest.config.sessionExpiredStatusCode) {
                    let refreshResponse = yield onUnauthorisedResponse(preRequestIdToken);
                    if (refreshResponse.result !== "RETRY") {
                        returnObj = refreshResponse.error !== undefined ? refreshResponse.error : response;
                        break;
                    }
                } else {
                    const antiCsrfToken = response.headers.get("anti-csrf");
                    if (antiCsrfToken) {
                        const tok = yield IdRefreshToken.getIdRefreshToken(true);
                        if (tok.status === "EXISTS") {
                            yield AntiCSRF.setItem(tok.token, antiCsrfToken);
                        }
                    }
                    const frontToken = response.headers.get("front-token");
                    if (frontToken) {
                        yield FrontToken.setItem(frontToken);
                    }
                    return response;
                }
            }
            // if it comes here, means we breaked. which happens only if we have logged out.
            return returnObj;
        } finally {
            if (!(yield AuthHttpRequest.recipeImpl.doesSessionExist(AuthHttpRequest.config))) {
                yield AntiCSRF.removeToken();
                yield FrontToken.removeToken();
            }
        }
    });
AuthHttpRequest.attemptRefreshingSession = () =>
    __awaiter(this, void 0, void 0, function*() {
        const preRequestIdToken = yield IdRefreshToken.getIdRefreshToken(false);
        const refreshResponse = yield onUnauthorisedResponse(preRequestIdToken);
        if (refreshResponse.result === "API_ERROR") {
            throw refreshResponse.error;
        }
        return refreshResponse.result === "RETRY";
    });
const LOCK_NAME = "REFRESH_TOKEN_USE";
export function onUnauthorisedResponse(preRequestIdToken) {
    return __awaiter(this, void 0, void 0, function*() {
        let lock = getLock();
        yield lock.lock(LOCK_NAME);
        try {
            let postLockID = yield IdRefreshToken.getIdRefreshToken(false);
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
            let headers = {};
            if (preRequestIdToken.status === "EXISTS") {
                const antiCsrfToken = yield AntiCSRF.getToken(preRequestIdToken.token);
                if (antiCsrfToken !== undefined) {
                    headers = Object.assign({}, headers, { "anti-csrf": antiCsrfToken });
                }
            }
            headers = Object.assign({ rid: AuthHttpRequest.rid }, headers, { "fdi-version": supported_fdi.join(",") });
            let preAPIResult = yield AuthHttpRequest.config.preAPIHook({
                action: "REFRESH_SESSION",
                requestInit: {
                    method: "post",
                    credentials: "include",
                    headers
                },
                url: AuthHttpRequest.refreshTokenUrl
            });
            const response = yield AuthHttpRequest.env.__supertokensOriginalFetch(
                preAPIResult.url,
                preAPIResult.requestInit
            );
            let removeIdRefreshToken = true;
            const idRefreshToken = response.headers.get("id-refresh-token");
            if (idRefreshToken) {
                yield IdRefreshToken.setIdRefreshToken(idRefreshToken, response.status);
                removeIdRefreshToken = false;
            }
            if (response.status === AuthHttpRequest.config.sessionExpiredStatusCode) {
                // there is a case where frontend still has id refresh token, but backend doesn't get it. In this event, session expired error will be thrown and the frontend should remove this token
                if (removeIdRefreshToken) {
                    yield IdRefreshToken.setIdRefreshToken("remove", response.status);
                }
            }
            if (response.status >= 300) {
                throw response;
            }
            if ((yield IdRefreshToken.getIdRefreshToken(false)).status === "NOT_EXISTS") {
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
                const tok = yield IdRefreshToken.getIdRefreshToken(true);
                if (tok.status === "EXISTS") {
                    yield AntiCSRF.setItem(tok.token, antiCsrfToken);
                }
            }
            const frontToken = response.headers.get("front-token");
            if (frontToken) {
                yield FrontToken.setItem(frontToken);
            }
            AuthHttpRequest.config.onHandleEvent({
                action: "REFRESH_SESSION"
            });
            return { result: "RETRY" };
        } catch (error) {
            if ((yield IdRefreshToken.getIdRefreshToken(false)).status === "NOT_EXISTS") {
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
            if ((yield IdRefreshToken.getIdRefreshToken(false)).status === "NOT_EXISTS") {
                yield AntiCSRF.removeToken();
                yield FrontToken.removeToken();
            }
        }
    });
}

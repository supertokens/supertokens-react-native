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
import { package_version } from "./version";
import AntiCSRF from "./antiCsrf";
import IdRefreshToken from "./idRefreshToken";
import getLock from "./locking";
/**
 * @description returns true if retry, else false is session has expired completely.
 */
export function handleUnauthorised(refreshAPI, preRequestIdToken, refreshAPICustomHeaders, sessionExpiredStatusCode) {
    return __awaiter(this, void 0, void 0, function*() {
        if (refreshAPI === undefined) {
            throw Error("Please define refresh token API in the init function");
        }
        if (preRequestIdToken === undefined) {
            return (yield IdRefreshToken.getToken()) !== undefined;
        }
        let result = yield onUnauthorisedResponse(
            refreshAPI,
            preRequestIdToken,
            refreshAPICustomHeaders,
            sessionExpiredStatusCode
        );
        if (result.result === "SESSION_EXPIRED") {
            return false;
        } else if (result.result === "API_ERROR") {
            throw result.error;
        }
        return true;
    });
}
export function getDomainFromUrl(url) {
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
    static init(options) {
        let { refreshTokenUrl, viaInterceptor, refreshAPICustomHeaders, sessionExpiredStatusCode } = options;
        if (viaInterceptor === undefined || viaInterceptor === null) {
            if (AuthHttpRequest.viaInterceptor === undefined) {
                viaInterceptor = viaInterceptor === undefined;
                // if user uses this function, viaInterceptor will be undefined, in which case, they will by default have it on
                // if axios calls this function, then viaInterceptor will be null, in which case, no interception from fetch will happen
            } else {
                viaInterceptor = AuthHttpRequest.viaInterceptor;
            }
        }
        AuthHttpRequest.refreshTokenUrl = refreshTokenUrl;
        AuthHttpRequest.refreshAPICustomHeaders = refreshAPICustomHeaders === undefined ? {} : refreshAPICustomHeaders;
        if (sessionExpiredStatusCode !== undefined) {
            AuthHttpRequest.sessionExpiredStatusCode = sessionExpiredStatusCode;
        }
        let env = global;
        if (AuthHttpRequest.originalFetch === undefined) {
            AuthHttpRequest.originalFetch = env.fetch.bind(env);
        }
        if (viaInterceptor) {
            env.fetch = (url, config) => {
                return AuthHttpRequest.fetch(url, config);
            };
        }
        AuthHttpRequest.viaInterceptor = viaInterceptor;
        AuthHttpRequest.apiDomain = getDomainFromUrl(refreshTokenUrl);
        AuthHttpRequest.initCalled = true;
    }
}
AuthHttpRequest.sessionExpiredStatusCode = 401;
AuthHttpRequest.initCalled = false;
AuthHttpRequest.apiDomain = "";
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
        if (
            typeof url === "string" &&
            getDomainFromUrl(url) !== AuthHttpRequest.apiDomain &&
            AuthHttpRequest.viaInterceptor
        ) {
            // this check means that if you are using fetch via inteceptor, then we only do the refresh steps if you are calling your APIs.
            return yield httpCall(config);
        }
        if (AuthHttpRequest.viaInterceptor) {
            ProcessState.getInstance().addState(PROCESS_STATE.CALLING_INTERCEPTION_REQUEST);
        }
        try {
            let throwError = false;
            let returnObj = undefined;
            while (true) {
                // we read this here so that if there is a session expiry error, then we can compare this value (that caused the error) with the value after the request is sent.
                // to avoid race conditions
                const preRequestIdToken = yield IdRefreshToken.getToken();
                const antiCsrfToken = yield AntiCSRF.getToken(preRequestIdToken);
                let configWithAntiCsrf = config;
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
                // Add package info to headers
                configWithAntiCsrf = Object.assign({}, configWithAntiCsrf, {
                    headers:
                        configWithAntiCsrf === undefined
                            ? {
                                  "supertokens-sdk-name": "react-native",
                                  "supertokens-sdk-version": package_version
                              }
                            : Object.assign({}, configWithAntiCsrf.headers, {
                                  "supertokens-sdk-name": "react-native",
                                  "supertokens-sdk-version": package_version
                              })
                });
                try {
                    let response = yield httpCall(configWithAntiCsrf);
                    response.headers.forEach((value, key) =>
                        __awaiter(this, void 0, void 0, function*() {
                            if (key.toString() === "id-refresh-token") {
                                yield IdRefreshToken.setToken(value);
                            }
                        })
                    );
                    if (response.status === AuthHttpRequest.sessionExpiredStatusCode) {
                        let retry = yield handleUnauthorised(
                            AuthHttpRequest.refreshTokenUrl,
                            preRequestIdToken,
                            AuthHttpRequest.refreshAPICustomHeaders,
                            AuthHttpRequest.sessionExpiredStatusCode
                        );
                        if (!retry) {
                            returnObj = response;
                            break;
                        }
                    } else {
                        response.headers.forEach((value, key) =>
                            __awaiter(this, void 0, void 0, function*() {
                                if (key.toString() === "anti-csrf") {
                                    yield AntiCSRF.setToken(value, yield IdRefreshToken.getToken());
                                }
                            })
                        );
                        return response;
                    }
                } catch (err) {
                    if (err.status === AuthHttpRequest.sessionExpiredStatusCode) {
                        let retry = yield handleUnauthorised(
                            AuthHttpRequest.refreshTokenUrl,
                            preRequestIdToken,
                            AuthHttpRequest.refreshAPICustomHeaders,
                            AuthHttpRequest.sessionExpiredStatusCode
                        );
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
            if ((yield IdRefreshToken.getToken()) === undefined) {
                yield AntiCSRF.removeToken();
            }
        }
    });
AuthHttpRequest.get = (url, config) =>
    __awaiter(this, void 0, void 0, function*() {
        return yield AuthHttpRequest.fetch(url, Object.assign({ method: "GET" }, config));
    });
AuthHttpRequest.post = (url, config) =>
    __awaiter(this, void 0, void 0, function*() {
        return yield AuthHttpRequest.fetch(url, Object.assign({ method: "POST" }, config));
    });
AuthHttpRequest.delete = (url, config) =>
    __awaiter(this, void 0, void 0, function*() {
        return yield AuthHttpRequest.fetch(url, Object.assign({ method: "DELETE" }, config));
    });
AuthHttpRequest.put = (url, config) =>
    __awaiter(this, void 0, void 0, function*() {
        return yield AuthHttpRequest.fetch(url, Object.assign({ method: "PUT" }, config));
    });
AuthHttpRequest.fetch = (url, config) =>
    __awaiter(this, void 0, void 0, function*() {
        return yield AuthHttpRequest.doRequest(
            config => {
                return AuthHttpRequest.originalFetch(url, Object.assign({}, config));
            },
            config,
            url
        );
    });
AuthHttpRequest.doesSessionExist = () =>
    __awaiter(this, void 0, void 0, function*() {
        return (yield IdRefreshToken.getToken()) !== undefined;
    });
const LOCK_NAME = "REFRESH_TOKEN_USE";
function onUnauthorisedResponse(refreshTokenUrl, preRequestIdToken, refreshAPICustomHeaders, sessionExpiredStatusCode) {
    return __awaiter(this, void 0, void 0, function*() {
        let lock = getLock();
        // TODO: lock natively
        yield lock.lock(LOCK_NAME);
        try {
            let postLockID = yield IdRefreshToken.getToken();
            if (postLockID === undefined) {
                return { result: "SESSION_EXPIRED" };
            }
            if (postLockID !== preRequestIdToken) {
                // means that some other process has already called this API and succeeded. so we need to call it again
                return { result: "RETRY" };
            }
            const antiCsrfToken = AntiCSRF.getToken(preRequestIdToken);
            let headers = Object.assign({}, refreshAPICustomHeaders, {
                "supertokens-sdk-name": "website",
                "supertokens-sdk-version": package_version
            });
            if (antiCsrfToken !== undefined) {
                headers = Object.assign({}, headers, { "anti-csrf": antiCsrfToken });
            }
            let response = yield AuthHttpRequest.originalFetch(refreshTokenUrl, {
                method: "post",
                credentials: "include",
                headers
            });
            let removeIdRefreshToken = true;
            response.headers.forEach((value, key) =>
                __awaiter(this, void 0, void 0, function*() {
                    if (key.toString() === "id-refresh-token") {
                        yield IdRefreshToken.setToken(value);
                        removeIdRefreshToken = false;
                    }
                })
            );
            if (response.status === sessionExpiredStatusCode) {
                // there is a case where frontend still has id refresh token, but backend doesn't get it. In this event, session expired error will be thrown and the frontend should remove this token
                if (removeIdRefreshToken) {
                    yield IdRefreshToken.setToken("remove");
                }
            }
            if (response.status !== 200) {
                throw response;
            }
            if ((yield IdRefreshToken.getToken()) === undefined) {
                // removed by server. So we logout
                return { result: "SESSION_EXPIRED" };
            }
            response.headers.forEach((value, key) =>
                __awaiter(this, void 0, void 0, function*() {
                    if (key.toString() === "anti-csrf") {
                        yield AntiCSRF.setToken(value, yield IdRefreshToken.getToken());
                    }
                })
            );
            return { result: "RETRY" };
        } catch (error) {
            if ((yield IdRefreshToken.getToken()) === undefined) {
                // removed by server.
                return { result: "SESSION_EXPIRED" };
            }
            return { result: "API_ERROR", error };
        } finally {
            // TODO: unlock natively
            lock.unlock(LOCK_NAME);
        }
    });
}

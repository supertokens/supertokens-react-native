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
import axios from "axios";
import AuthHttpRequestFetch, { handleUnauthorised } from "./fetch";
import FrontToken from "./frontToken";
import AntiCSRF from "./antiCsrf";
import { PROCESS_STATE, ProcessState } from "./processState";
import IdRefreshToken from "./idRefreshToken";
import { shouldDoInterceptionBasedOnUrl } from "./utils";
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
        let url = getUrlFromConfig(config);
        let doNotDoInterception = false;
        try {
            doNotDoInterception =
                typeof url === "string" &&
                !shouldDoInterceptionBasedOnUrl(
                    url,
                    AuthHttpRequestFetch.config.apiDomain,
                    AuthHttpRequestFetch.config.cookieDomain
                );
        } catch (err) {
            if (err.message === "Please provide a valid domain name") {
                // .origin gives the port as well..
                doNotDoInterception = !shouldDoInterceptionBasedOnUrl(
                    window.location.origin,
                    AuthHttpRequestFetch.config.apiDomain,
                    AuthHttpRequestFetch.config.cookieDomain
                );
            } else {
                throw err;
            }
        }
        if (doNotDoInterception) {
            // this check means that if you are using axios via inteceptor, then we only do the refresh steps if you are calling your APIs.
            return config;
        }
        ProcessState.getInstance().addState(PROCESS_STATE.CALLING_INTERCEPTION_REQUEST);
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
        if (AuthHttpRequestFetch.config.autoAddCredentials && configWithAntiCsrf.withCredentials === undefined) {
            configWithAntiCsrf = Object.assign({}, configWithAntiCsrf, { withCredentials: true });
        }
        // adding rid for anti-csrf protection: Anti-csrf via custom header
        configWithAntiCsrf = Object.assign({}, configWithAntiCsrf, {
            headers:
                configWithAntiCsrf === undefined
                    ? {
                          rid: AuthHttpRequestFetch.rid
                      }
                    : Object.assign({ rid: AuthHttpRequestFetch.rid }, configWithAntiCsrf.headers)
        });
        return configWithAntiCsrf;
    });
}
export function responseInterceptor(axiosInstance) {
    return response =>
        __awaiter(this, void 0, void 0, function*() {
            let doNotDoInterception = false;
            try {
                if (!AuthHttpRequest.initCalled) {
                    throw new Error("init function not called");
                }
                let url = getUrlFromConfig(response.config);
                try {
                    doNotDoInterception =
                        typeof url === "string" &&
                        !shouldDoInterceptionBasedOnUrl(
                            url,
                            AuthHttpRequestFetch.config.apiDomain,
                            AuthHttpRequestFetch.config.cookieDomain
                        );
                } catch (err) {
                    if (err.message === "Please provide a valid domain name") {
                        // .origin gives the port as well..
                        doNotDoInterception = !shouldDoInterceptionBasedOnUrl(
                            window.location.origin,
                            AuthHttpRequestFetch.config.apiDomain,
                            AuthHttpRequestFetch.config.cookieDomain
                        );
                    } else {
                        throw err;
                    }
                }
                if (doNotDoInterception) {
                    // this check means that if you are using axios via inteceptor, then we only do the refresh steps if you are calling your APIs.
                    return response;
                }
                ProcessState.getInstance().addState(PROCESS_STATE.CALLING_INTERCEPTION_RESPONSE);
                let idRefreshToken = response.headers["id-refresh-token"];
                if (idRefreshToken !== undefined) {
                    yield IdRefreshToken.setIdRefreshToken(idRefreshToken, response.status);
                }
                if (response.status === AuthHttpRequestFetch.config.sessionExpiredStatusCode) {
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
                    let antiCsrfToken = response.headers["anti-csrf"];
                    if (antiCsrfToken !== undefined) {
                        let tok = yield IdRefreshToken.getIdRefreshToken(true);
                        if (tok.status === "EXISTS") {
                            yield AntiCSRF.setItem(tok.token, antiCsrfToken);
                        }
                    }
                    let frontToken = response.headers["front-token"];
                    if (frontToken !== undefined) {
                        yield FrontToken.setItem(frontToken);
                    }
                    return response;
                }
            } finally {
                if (
                    !doNotDoInterception &&
                    !(yield AuthHttpRequestFetch.recipeImpl.doesSessionExist(AuthHttpRequestFetch.config))
                ) {
                    yield AntiCSRF.removeToken();
                    yield FrontToken.removeToken();
                }
            }
        });
}
export function responseErrorInterceptor(axiosInstance) {
    return error => {
        if (
            error.response !== undefined &&
            error.response.status === AuthHttpRequestFetch.config.sessionExpiredStatusCode
        ) {
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
AuthHttpRequest.sessionExpiredStatusCode = 401;
AuthHttpRequest.initCalled = false;
AuthHttpRequest.apiDomain = "";
/**
 * @description sends the actual http request and returns a response if successful/
 * If not successful due to session expiry reasons, it
 * attempts to call the refresh token API and if that is successful, calls this API again.
 * @throws Error
 */
AuthHttpRequest.doRequest = (httpCall, config, url, prevResponse, prevError, viaInterceptor = false) =>
    __awaiter(this, void 0, void 0, function*() {
        if (!AuthHttpRequestFetch.initCalled) {
            throw Error("init function not called");
        }
        let doNotDoInterception = false;
        try {
            doNotDoInterception =
                typeof url === "string" &&
                !shouldDoInterceptionBasedOnUrl(
                    url,
                    AuthHttpRequestFetch.config.apiDomain,
                    AuthHttpRequestFetch.config.cookieDomain
                ) &&
                viaInterceptor;
        } catch (err) {
            if (err.message === "Please provide a valid domain name") {
                // .origin gives the port as well..
                doNotDoInterception =
                    !shouldDoInterceptionBasedOnUrl(
                        window.location.origin,
                        AuthHttpRequestFetch.config.apiDomain,
                        AuthHttpRequestFetch.config.cookieDomain
                    ) && viaInterceptor;
            } else {
                throw err;
            }
        }
        if (doNotDoInterception) {
            if (prevError !== undefined) {
                throw prevError;
            } else if (prevResponse !== undefined) {
                return prevResponse;
            }
            return yield httpCall(config);
        }
        // We make refresh calls through axios so that we have axios response object in case it makes it out of the API.
        // This happens if there is an unexpected error during refresh (not sessionExpiredStatusCode).
        const axiosFetch = (url, config) =>
            __awaiter(this, void 0, void 0, function*() {
                const res = yield axios(
                    Object.assign(
                        {
                            url,
                            validateStatus: null,
                            withCredentials: config && config.credentials === "include",
                            data: config ? config.body : undefined
                        },
                        config,
                        { method: config ? config.method : undefined }
                    )
                );
                return new Response(res.data, {
                    status: res.status,
                    statusText: res.statusText,
                    headers: new Headers(res.headers)
                });
            });
        try {
            let throwError = false;
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
                if (
                    AuthHttpRequestFetch.config.autoAddCredentials &&
                    configWithAntiCsrf.withCredentials === undefined
                ) {
                    configWithAntiCsrf = Object.assign({}, configWithAntiCsrf, { withCredentials: true });
                }
                // adding rid for anti-csrf protection: Anti-csrf via custom header
                configWithAntiCsrf = Object.assign({}, configWithAntiCsrf, {
                    headers:
                        configWithAntiCsrf === undefined
                            ? {
                                  rid: AuthHttpRequestFetch.rid
                              }
                            : Object.assign({ rid: AuthHttpRequestFetch.rid }, configWithAntiCsrf.headers)
                });
                try {
                    let localPrevError = prevError;
                    let localPrevResponse = prevResponse;
                    prevError = undefined;
                    prevResponse = undefined;
                    if (localPrevError !== undefined) {
                        throw localPrevError;
                    }
                    let response =
                        localPrevResponse === undefined ? yield httpCall(configWithAntiCsrf) : localPrevResponse;
                    let idRefreshToken = response.headers["id-refresh-token"];
                    if (idRefreshToken !== undefined) {
                        yield IdRefreshToken.setIdRefreshToken(idRefreshToken, response.status);
                    }
                    if (response.status === AuthHttpRequestFetch.config.sessionExpiredStatusCode) {
                        const retry = yield handleUnauthorised(preRequestIdToken, axiosFetch);
                        if (!retry) {
                            returnObj = response;
                            break;
                        }
                    } else {
                        let antiCsrfToken = response.headers["anti-csrf"];
                        if (antiCsrfToken !== undefined) {
                            let tok = yield IdRefreshToken.getIdRefreshToken(true);
                            if (tok.status === "EXISTS") {
                                yield AntiCSRF.setItem(tok.token, antiCsrfToken);
                            }
                        }
                        let frontToken = response.headers["front-token"];
                        if (frontToken !== undefined) {
                            yield FrontToken.setItem(frontToken);
                        }
                        return response;
                    }
                } catch (err) {
                    if (
                        err.response !== undefined &&
                        err.response.status === AuthHttpRequestFetch.config.sessionExpiredStatusCode
                    ) {
                        const retry = yield handleUnauthorised(preRequestIdToken, axiosFetch);
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
            // if it comes here, means we called break. which happens only if we have logged out.
            if (throwError) {
                throw returnObj;
            } else {
                return returnObj;
            }
        } finally {
            if (!(yield AuthHttpRequestFetch.recipeImpl.doesSessionExist(AuthHttpRequestFetch.config))) {
                yield AntiCSRF.removeToken();
                yield FrontToken.removeToken();
            }
        }
    });

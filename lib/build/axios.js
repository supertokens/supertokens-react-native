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
import FetchAuthRequest, { getDomainFromUrl, handleUnauthorised } from "./index";
import { PROCESS_STATE, ProcessState } from "./processState";
import { package_version } from "./version";
import IdRefreshToken from "./idRefreshToken";
import AntiCSRF from "./antiCsrf";
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
        if (typeof url === "string" && getDomainFromUrl(url) !== AuthHttpRequest.apiDomain) {
            // this check means that if you are using axios via inteceptor, then we only do the refresh steps if you are calling your APIs.
            return config;
        }
        ProcessState.getInstance().addState(PROCESS_STATE.CALLING_INTERCEPTION_REQUEST);
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
        return configWithAntiCsrf;
    });
}
export function responseInterceptor(axiosInstance) {
    return response =>
        __awaiter(this, void 0, void 0, function*() {
            try {
                if (!AuthHttpRequest.initCalled) {
                    throw new Error("init function not called");
                }
                let url = getUrlFromConfig(response.config);
                if (typeof url === "string" && getDomainFromUrl(url) !== AuthHttpRequest.apiDomain) {
                    // this check means that if you are using axios via inteceptor, then we only do the refresh steps if you are calling your APIs.
                    return response;
                }
                ProcessState.getInstance().addState(PROCESS_STATE.CALLING_INTERCEPTION_RESPONSE);
                let idRefreshToken = response.headers["id-refresh-token"];
                if (idRefreshToken !== undefined) {
                    yield IdRefreshToken.setToken(idRefreshToken);
                }
                if (response.status === AuthHttpRequest.sessionExpiredStatusCode) {
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
                        yield AntiCSRF.setToken(antiCsrfToken, yield IdRefreshToken.getToken());
                    }
                    return response;
                }
            } finally {
                if ((yield IdRefreshToken.getToken()) === undefined) {
                    yield AntiCSRF.removeToken();
                }
            }
        });
}
/**
 * @class AuthHttpRequest
 * @description wrapper for common http methods.
 */
export default class AuthHttpRequest {
    static init(options) {
        let { refreshTokenUrl, refreshAPICustomHeaders, sessionExpiredStatusCode } = options;
        FetchAuthRequest.init(Object.assign({}, options, { viaInterceptor: null }));
        AuthHttpRequest.refreshTokenUrl = refreshTokenUrl;
        AuthHttpRequest.refreshAPICustomHeaders = refreshAPICustomHeaders === undefined ? {} : refreshAPICustomHeaders;
        if (sessionExpiredStatusCode !== undefined) {
            AuthHttpRequest.sessionExpiredStatusCode = sessionExpiredStatusCode;
        }
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
AuthHttpRequest.doRequest = (httpCall, config, url, prevResponse, prevError, viaInterceptor = false) =>
    __awaiter(this, void 0, void 0, function*() {
        if (!AuthHttpRequest.initCalled) {
            throw Error("init function not called");
        }
        if (typeof url === "string" && getDomainFromUrl(url) !== AuthHttpRequest.apiDomain && viaInterceptor) {
            if (prevError !== undefined) {
                throw prevError;
            } else if (prevResponse !== undefined) {
                return prevResponse;
            }
            // this check means that if you are using fetch via inteceptor, then we only do the refresh steps if you are calling your APIs.
            return yield httpCall(config);
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
                        yield IdRefreshToken.setToken(idRefreshToken);
                    }
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
                        let antiCsrfToken = response.headers["anti-csrf"];
                        if (antiCsrfToken !== undefined) {
                            yield AntiCSRF.setToken(antiCsrfToken, yield IdRefreshToken.getToken());
                        }
                        return response;
                    }
                } catch (err) {
                    if (
                        err.response !== undefined &&
                        err.response.status === AuthHttpRequest.sessionExpiredStatusCode
                    ) {
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
            // if it comes here, means we called break. which happens only if we have logged out.
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
        return yield AuthHttpRequest.axios(Object.assign({ method: "get", url }, config));
    });
AuthHttpRequest.post = (url, data, config) =>
    __awaiter(this, void 0, void 0, function*() {
        return yield AuthHttpRequest.axios(Object.assign({ method: "post", url, data }, config));
    });
AuthHttpRequest.delete = (url, config) =>
    __awaiter(this, void 0, void 0, function*() {
        return yield AuthHttpRequest.axios(Object.assign({ method: "delete", url }, config));
    });
AuthHttpRequest.put = (url, data, config) =>
    __awaiter(this, void 0, void 0, function*() {
        return yield AuthHttpRequest.axios(Object.assign({ method: "put", url, data }, config));
    });
AuthHttpRequest.axios = (anything, maybeConfig) =>
    __awaiter(this, void 0, void 0, function*() {
        let config = {};
        if (typeof anything === "string") {
            if (maybeConfig === undefined) {
                config = {
                    url: anything,
                    method: "get"
                };
            } else {
                config = Object.assign({ url: anything }, maybeConfig);
            }
        } else {
            config = anything;
        }
        return yield AuthHttpRequest.doRequest(
            config => {
                // we create an instance since we don't want to intercept this.
                const instance = axios.create();
                return instance(config);
            },
            config,
            config.url
        );
    });
AuthHttpRequest.makeSuper = axiosInstance => {
    // we first check if this axiosInstance already has our interceptors.
    let requestInterceptors = axiosInstance.interceptors.request;
    for (let i = 0; i < requestInterceptors.handlers.length; i++) {
        if (requestInterceptors.handlers[i].fulfilled === interceptorFunctionRequestFulfilled) {
            return;
        }
    }
    // Add a request interceptor
    axiosInstance.interceptors.request.use(interceptorFunctionRequestFulfilled, function(error) {
        return __awaiter(this, void 0, void 0, function*() {
            throw error;
        });
    });
    // Add a response interceptor
    axiosInstance.interceptors.response.use(responseInterceptor(axiosInstance), function(error) {
        return __awaiter(this, void 0, void 0, function*() {
            if (!AuthHttpRequest.initCalled) {
                throw new Error("init function not called");
            }
            try {
                if (
                    error.response !== undefined &&
                    error.response.status === AuthHttpRequest.sessionExpiredStatusCode
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
            } finally {
                if ((yield IdRefreshToken.getToken()) === undefined) {
                    yield AntiCSRF.removeToken();
                }
            }
        });
    });
};
AuthHttpRequest.doesSessionExist = () =>
    __awaiter(this, void 0, void 0, function*() {
        return (yield IdRefreshToken.getToken()) !== undefined;
    });

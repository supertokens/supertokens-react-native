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

import { NativeModules } from "react-native";

const { RNSuperTokens } = NativeModules;

import { onUnauthorisedResponse } from "./handleSessionExp";
import { PROCESS_STATE, ProcessState } from "./processState";
import { package_version } from "./version";
import AntiCSRF from "./antiCsrf";
import IdRefreshToken from "./idRefreshToken";

declare let global: any;

/**
 * @description returns true if retry, else false is session has expired completely.
 */
export async function handleUnauthorised(
    refreshAPI: string | undefined,
    preRequestIdToken: string | undefined,
    refreshAPICustomHeaders: any,
    sessionExpiredStatusCode: number
): Promise<boolean> {
    if (refreshAPI === undefined) {
        throw Error("Please define refresh token API in the init function");
    }
    if (preRequestIdToken === undefined) {
        return (await IdRefreshToken.getToken()) !== undefined;
    }
    let result = await onUnauthorisedResponse(
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
        return window.location.origin;
    }
}

/**
 * @class AuthHttpRequest
 * @description wrapper for common http methods.
 */
export default class AuthHttpRequest {
    private static refreshTokenUrl: string | undefined;
    private static sessionExpiredStatusCode = 440;
    private static initCalled = false;
    static originalFetch: any;
    private static apiDomain = "";
    private static viaInterceptor: boolean | undefined;
    private static refreshAPICustomHeaders: any;

    static init(
        refreshTokenUrl: string,
        sessionExpiredStatusCode?: number,
        viaInterceptor?: boolean,
        refreshAPICustomHeaders?: any
    ) {
        if (viaInterceptor === undefined) {
            if (AuthHttpRequest.viaInterceptor === undefined) {
                viaInterceptor = false;
            } else {
                viaInterceptor = AuthHttpRequest.viaInterceptor;
            }
        }
        AuthHttpRequest.refreshTokenUrl = refreshTokenUrl;
        AuthHttpRequest.refreshAPICustomHeaders = refreshAPICustomHeaders === undefined ? {} : refreshAPICustomHeaders;
        if (sessionExpiredStatusCode !== undefined) {
            AuthHttpRequest.sessionExpiredStatusCode = sessionExpiredStatusCode;
        }
        let env: any = global;
        if (AuthHttpRequest.originalFetch === undefined) {
            AuthHttpRequest.originalFetch = env.fetch.bind(env);
        }
        if (viaInterceptor) {
            env.fetch = (url: RequestInfo, config?: RequestInit): Promise<Response> => {
                return AuthHttpRequest.fetch(url, config);
            };
        }
        AuthHttpRequest.viaInterceptor = viaInterceptor;
        AuthHttpRequest.apiDomain = getDomainFromUrl(refreshTokenUrl);
        AuthHttpRequest.initCalled = true;
    }

    /**
     * @description sends the actual http request and returns a response if successful/
     * If not successful due to session expiry reasons, it
     * attempts to call the refresh token API and if that is successful, calls this API again.
     * @throws Error
     */
    private static doRequest = async (
        httpCall: (config?: RequestInit) => Promise<Response>,
        config?: RequestInit,
        url?: any
    ): Promise<Response> => {
        if (!AuthHttpRequest.initCalled) {
            throw Error("init function not called");
        }
        if (
            typeof url === "string" &&
            getDomainFromUrl(url) !== AuthHttpRequest.apiDomain &&
            AuthHttpRequest.viaInterceptor
        ) {
            // this check means that if you are using fetch via inteceptor, then we only do the refresh steps if you are calling your APIs.
            return await httpCall(config);
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
                const preRequestIdToken = await IdRefreshToken.getToken();
                const antiCsrfToken = await AntiCSRF.getToken(preRequestIdToken);
                let configWithAntiCsrf: RequestInit | undefined = config;
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

                // Add package info to headers
                configWithAntiCsrf = {
                    ...configWithAntiCsrf,
                    headers:
                        configWithAntiCsrf === undefined
                            ? {
                                  "supertokens-sdk-name": "website",
                                  "supertokens-sdk-version": package_version
                              }
                            : {
                                  ...configWithAntiCsrf.headers,
                                  "supertokens-sdk-name": "website",
                                  "supertokens-sdk-version": package_version
                              }
                };
                try {
                    let response = await httpCall(configWithAntiCsrf);
                    response.headers.forEach(async (value: string, key: string) => {
                        if (key.toString() === "id-refresh-token") {
                            await IdRefreshToken.setToken(value);
                        }
                    });
                    if (response.status === AuthHttpRequest.sessionExpiredStatusCode) {
                        let retry = await handleUnauthorised(
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
                        response.headers.forEach(async (value: string, key: string) => {
                            if (key.toString() === "anti-csrf") {
                                await AntiCSRF.setToken(value, await IdRefreshToken.getToken());
                            }
                        });
                        return response;
                    }
                } catch (err) {
                    if (err.status === AuthHttpRequest.sessionExpiredStatusCode) {
                        let retry = await handleUnauthorised(
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
            if ((await IdRefreshToken.getToken()) === undefined) {
                await AntiCSRF.removeToken();
            }
        }
    };

    static get = async (url: RequestInfo, config?: RequestInit) => {
        return await AuthHttpRequest.fetch(url, {
            method: "GET",
            ...config
        });
    };

    static post = async (url: RequestInfo, config?: RequestInit) => {
        return await AuthHttpRequest.fetch(url, {
            method: "POST",
            ...config
        });
    };

    static delete = async (url: RequestInfo, config?: RequestInit) => {
        return await AuthHttpRequest.fetch(url, {
            method: "DELETE",
            ...config
        });
    };

    static put = async (url: RequestInfo, config?: RequestInit) => {
        return await AuthHttpRequest.fetch(url, {
            method: "PUT",
            ...config
        });
    };

    static fetch = async (url: RequestInfo, config?: RequestInit) => {
        return await AuthHttpRequest.doRequest(
            (config?: RequestInit) => {
                return AuthHttpRequest.originalFetch(url, {
                    ...config
                });
            },
            config,
            url
        );
    };

    static doesSessionExist = async () => {
        return (await IdRefreshToken.getToken()) !== undefined;
    };
}

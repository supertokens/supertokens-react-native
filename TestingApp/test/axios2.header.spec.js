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
let axios = require("axios");
const axiosCookieJarSupport = require("axios-cookiejar-support").default;

import AntiCsrfToken from "supertokens-react-native/lib/build/antiCsrf";
import FrontToken from "supertokens-react-native/lib/build/frontToken";
import AuthHttpRequestFetch from "supertokens-react-native/lib/build/fetch";
import AuthHttpRequest from "supertokens-react-native";

import { ProcessState } from "supertokens-react-native/lib/build/processState";
import assert from "assert";
import { getTokenForHeaderAuth, setToken } from "supertokens-react-native/lib/build/utils";

import {
    getNumberOfTimesRefreshCalled,
    startST,
    BASE_URL_FOR_ST,
    BASE_URL as UTILS_BASE_URL,
    getNumberOfTimesRefreshAttempted,
    coreTagEqualToOrAfter,
    startTestBackend,
    setupFetchWithCookieJar
} from "./utils";

// jest does not call setupFiles properly with the new react-native init, so doing it this way instead
import "./setup";

process.env.TEST_MODE = "testing";

const BASE_URL = "http://localhost:8080";

let axiosInstance;

describe("Axios AuthHttpRequest class tests", function() {
    async function delay(time) {
        return new Promise(resolve => setTimeout(resolve, time * 1000));
    }

    function assertEqual(a, b) {
        assert(a === b);
    }

    function assertNotEqual(a, b) {
        if (a === b) {
            throw new Error("assert failed");
        }
    }

    beforeAll(async function() {
        startTestBackend("header");

        await new Promise(r => setTimeout(r, 1000));
    });

    afterAll(async function() {
        let instance = axios.create();
        await instance.post(BASE_URL_FOR_ST + "/after");
        try {
            await instance.get(BASE_URL_FOR_ST + "/stop");
        } catch (err) {}
    });

    beforeEach(async function() {
        AuthHttpRequestFetch.initCalled = false;
        ProcessState.getInstance().reset();
        // reset all tokens
        await AntiCsrfToken.removeToken();
        await FrontToken.removeToken();

        const cookieJar = setupFetchWithCookieJar();

        let instance = axios.create();
        await instance.post(BASE_URL_FOR_ST + "/beforeeach");
        await instance.post(BASE_URL + "/beforeeach");

        axiosInstance = axios.create({
            withCredentials: true
        });
        axiosCookieJarSupport(axiosInstance);
        axiosInstance.defaults.jar = cookieJar;
    });

    it("refresh session, signing key interval change", async function(done) {
        try {
            jest.setTimeout(20000);
            await startST(100, true, "0.002");
            AuthHttpRequest.addAxiosInterceptors(axiosInstance);
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });

            let userId = "testing-supertokens-react-native";

            let loginResponse = await axiosInstance.post(`${BASE_URL}/login`, JSON.stringify({ userId }), {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                }
            });
            let userIdFromResponse = loginResponse.data;
            assertEqual(userId, userIdFromResponse);

            await axiosInstance({
                url: `${BASE_URL}/`,
                method: "GET",
                headers: { "Cache-Control": "no-cache, private" }
            });
            assertEqual(await getNumberOfTimesRefreshCalled(), 0);
            await delay(11);

            let promises = [];
            for (let i = 0; i < 250; i++) {
                promises.push(
                    axiosInstance({
                        url: `${BASE_URL}/`,
                        method: "GET",
                        headers: { "Cache-Control": "no-cache, private" }
                    })
                );
            }
            for (let i = 0; i < 250; i++) {
                await promises[i];
            }

            let coreSupportsMultipleSignigKeys = coreTagEqualToOrAfter("3.6.0");

            assertEqual(await getNumberOfTimesRefreshCalled(), coreSupportsMultipleSignigKeys ? 0 : 1);

            done();
        } catch (err) {
            done(err);
        }
    });

    it("API returning 401 will not call refresh after logout", async function() {
        await startST(100, true, "0.002");
        AuthHttpRequest.addAxiosInterceptors(axiosInstance);
        AuthHttpRequest.init({
            apiDomain: BASE_URL
        });

        let userId = "testing-supertokens-react-native";

        let loginResponse = await axiosInstance.post(`${BASE_URL}/login`, JSON.stringify({ userId }), {
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json"
            }
        });
        let userIdFromResponse = loginResponse.data;
        assertEqual(userId, userIdFromResponse);

        let logoutResponse = await axiosInstance.post(`${BASE_URL}/logout`, JSON.stringify({ userId }), {
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json"
            }
        });

        const refreshAttemptedBeforeApiCall = await getNumberOfTimesRefreshAttempted();

        let exception;
        try {
            await axiosInstance({
                url: `${BASE_URL}/`,
                method: "GET",
                headers: { "Cache-Control": "no-cache, private" }
            });
        } catch (ex) {
            exception = ex;
        }

        assertNotEqual(exception, undefined);
        assertNotEqual(exception.response, undefined);
        assertEqual(exception.config.url, `${BASE_URL}/`);
        assertEqual(exception.response.status, 401);

        assertEqual(await getNumberOfTimesRefreshAttempted(), refreshAttemptedBeforeApiCall);
    });

    /**
     * - getAccessToken before creating a session should return undefined
     * - getAccessToken after creating a session should return some value
     * - getAccessToken after signOut should return undefined
     */
    it("getAccessToken should behave as expected", async function(done) {
        try {
            jest.setTimeout(10000);
            await startST();
            AuthHttpRequest.addAxiosInterceptors(axiosInstance);
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });

            let accessToken = await AuthHttpRequest.getAccessToken();
            assertEqual(accessToken, undefined);

            let userId = "testing-supertokens-react-native";

            let loginResponse = await axiosInstance.post(`${BASE_URL}/login`, JSON.stringify({ userId }), {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                }
            });
            let userIdFromResponse = loginResponse.data;
            assertEqual(userId, userIdFromResponse);

            accessToken = await AuthHttpRequest.getAccessToken();
            assertNotEqual(accessToken, undefined);

            await AuthHttpRequest.signOut();
            accessToken = await AuthHttpRequest.getAccessToken();
            assertEqual(accessToken, undefined);

            done();
        } catch (err) {
            done(err);
        }
    });

    /**
     * Add authorization header with different casing and the API calls should still work normally
     */
    it("Different casing for custom authorization header should work fine", async function(done) {
        try {
            jest.setTimeout(10000);
            await startST();
            AuthHttpRequest.addAxiosInterceptors(axiosInstance);
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });

            let userId = "testing-supertokens-react-native";

            let loginResponse = await axiosInstance.post(`${BASE_URL}/login`, JSON.stringify({ userId }), {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                }
            });
            let userIdFromResponse = loginResponse.data;
            assertEqual(userId, userIdFromResponse);

            let accessToken = await AuthHttpRequest.getAccessToken();
            assertNotEqual(accessToken, undefined);

            let getSessionResponse = await axiosInstance({
                url: `${BASE_URL}/`,
                method: "GET",
                headers: { "Cache-Control": "no-cache, private" }
            });
            assertEqual(getSessionResponse.data, userId);

            getSessionResponse = await axiosInstance({
                url: `${BASE_URL}/`,
                method: "GET",
                headers: { "Cache-Control": "no-cache, private" }
            });
            assertEqual(getSessionResponse.data, userId);

            done();
        } catch (err) {
            done(err);
        }
    });

    /**
     * Add a authorization header whos token value does not match the access token.
     * The SDK should not remove the header and it should be recieved by the API
     */
    it("Custom authorization header is sent to API if it does not match current access token", async function(done) {
        try {
            jest.setTimeout(10000);
            await startST();
            AuthHttpRequest.addAxiosInterceptors(axiosInstance);
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });

            let userId = "testing-supertokens-react-native";

            let loginResponse = await axiosInstance.post(`${BASE_URL}/login`, JSON.stringify({ userId }), {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                }
            });
            let userIdFromResponse = loginResponse.data;
            assertEqual(userId, userIdFromResponse);

            let originalGet = axiosInstance.get;

            // We mock specific URLs here, for other URLs we make an actual network call
            axiosInstance.get = jest.fn((url, config) => {
                if (url === BASE_URL + "/") {
                    let headers = new Headers(config.headers);

                    if (headers.get("authorization") === "Bearer customAccess") {
                        let response = {
                            data: {
                                message: "test"
                            },
                            status: 500,
                            statusText: "Internal Server Error",
                            headers: {},
                            config: config,
                            request: undefined
                        };

                        return Promise.resolve(response);
                    }
                }

                return originalGet(url, config);
            });

            let getSessionResponse = await axiosInstance.get(`${BASE_URL}/`, {
                headers: {
                    Authorization: `Bearer customAccess`
                }
            });

            assertEqual(getSessionResponse.status, 500);

            getSessionResponse = await axiosInstance.get(`${BASE_URL}/`, {
                headers: {
                    authorization: `Bearer customAccess`
                }
            });
            assertEqual(getSessionResponse.status, 500);
            done();
        } catch (err) {
            done(err);
        }
    });

    /**
     * If the URL for the request should not be intercepted by the SDK then even if the token
     * matches the current access token it should not be removed
     */
    it("Custom authorization header is sent if API does not require interception", async function(done) {
        try {
            jest.setTimeout(10000);
            await startST();
            AuthHttpRequest.addAxiosInterceptors(axiosInstance);
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });

            let userId = "testing-supertokens-react-native";

            let loginResponse = await axiosInstance.post(`${BASE_URL}/login`, JSON.stringify({ userId }), {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                }
            });
            let userIdFromResponse = loginResponse.data;
            assertEqual(userId, userIdFromResponse);

            let accessToken = AuthHttpRequest.getAccessToken();
            assertNotEqual(accessToken, undefined);

            let originalGet = axiosInstance.get;

            // We mock specific URLs here, for other URLs we make an actual network call
            axiosInstance.get = jest.fn((url, config) => {
                if (url === "https://test.com/") {
                    let headers = new Headers(config.headers);

                    let status = 404;
                    if (headers.get("authorization") === `Bearer ${accessToken}`) {
                        status = 200;
                    }

                    let response = {
                        data: {
                            message: "test"
                        },
                        status,
                        statusText: "",
                        headers: {},
                        config: config,
                        request: undefined
                    };

                    return Promise.resolve(response);
                }

                return originalGet(url, config);
            });

            let getSessionResponse = await axiosInstance.get("https://test.com/", {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });

            assertEqual(getSessionResponse.status, 200);
            done();
        } catch (err) {
            done(err);
        }
    });

    /**
     * Manually adding an access token that is an expired one as an authorization header should trigger a call
     * to refresh and should work normally
     */
    it("Manually adding an expired access token should refresh and work normally", async function(done) {
        try {
            jest.setTimeout(15000);
            await startST(3);
            AuthHttpRequest.addAxiosInterceptors(axiosInstance);
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });

            let userId = "testing-supertokens-react-native";

            let loginResponse = await axiosInstance.post(`${BASE_URL}/login`, JSON.stringify({ userId }), {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                }
            });
            let userIdFromResponse = loginResponse.data;
            assertEqual(userId, userIdFromResponse);

            let accessToken = await AuthHttpRequest.getAccessToken();
            assertNotEqual(accessToken, undefined);

            // Wait for expiry
            await delay(5);

            let getSessionResponse = await axiosInstance({
                url: `${BASE_URL}/`,
                method: "GET",
                headers: { "Cache-Control": "no-cache, private" }
            });

            assertEqual(await getNumberOfTimesRefreshCalled(), 1);
            assertEqual(getSessionResponse.status, 200);
            assertEqual(getSessionResponse.data, userId);

            done();
        } catch (err) {
            done(err);
        }
    });

    /**
     * Create a session and call getAccessToken, the result should not be undefined
     * Wait for session expiry and call getAccessToken, a new token should be recieved and refresh should be called
     */
    it("getAccessToken calls refresh if session has expired", async function(done) {
        try {
            jest.setTimeout(15000);
            await startST(3);
            AuthHttpRequest.addAxiosInterceptors(axiosInstance);
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });

            let userId = "testing-supertokens-react-native";

            let loginResponse = await axiosInstance.post(`${BASE_URL}/login`, JSON.stringify({ userId }), {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                }
            });
            let userIdFromResponse = loginResponse.data;
            assertEqual(userId, userIdFromResponse);

            let accessToken = await AuthHttpRequest.getAccessToken();
            assertNotEqual(accessToken, undefined);

            await delay(5);

            let newAccessToken = await AuthHttpRequest.getAccessToken();
            assertNotEqual(newAccessToken, undefined);
            assertNotEqual(newAccessToken, accessToken);
            assertEqual(await getNumberOfTimesRefreshCalled(), 1);

            done();
        } catch (err) {
            done(err);
        }
    });

    /**
     * Create a session and store the access token. Call signOut to revoke the session and try calling
     * an API with a manually added header. The API should work normally
     */
    it("Test that using old access token after signOut works fine", async function(done) {
        try {
            jest.setTimeout(15000);
            await startST();
            AuthHttpRequest.addAxiosInterceptors(axiosInstance);
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });

            let userId = "testing-supertokens-react-native";

            let loginResponse = await axiosInstance.post(`${BASE_URL}/login`, JSON.stringify({ userId }), {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                }
            });
            let userIdFromResponse = loginResponse.data;
            assertEqual(userId, userIdFromResponse);

            let accessToken = await AuthHttpRequest.getAccessToken();
            assertNotEqual(accessToken, undefined);

            await AuthHttpRequest.signOut();

            let getSessionResponse = await axiosInstance.get(`${BASE_URL}/`, {
                headers: {
                    authorization: `Bearer ${accessToken}`
                }
            });

            assertEqual(getSessionResponse.status, 200);
            assertEqual(getSessionResponse.data, userId);

            done();
        } catch (err) {
            done(err);
        }
    });

    it("Test that access token and refresh token are cleared when front token is cleared", async function(done) {
        try {
            jest.setTimeout(15000);
            await startST();
            AuthHttpRequest.addAxiosInterceptors(axiosInstance);
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });

            let userId = "testing-supertokens-react-native";

            await axiosInstance.post(`${BASE_URL}/login`, JSON.stringify({ userId }), {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                }
            });

            let accessToken = await getTokenForHeaderAuth("access");
            let refreshToken = await getTokenForHeaderAuth("refresh");

            assertNotEqual(accessToken, undefined);
            assertNotEqual(refreshToken, undefined);

            await axiosInstance.post(`${BASE_URL}/logout-alt`, JSON.stringify({}), {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                }
            });

            let accessTokenAfter = await getTokenForHeaderAuth("access");
            let refreshTokenAfter = await getTokenForHeaderAuth("refresh");

            assertEqual(accessTokenAfter, undefined);
            assertEqual(refreshTokenAfter, undefined);

            done();
        } catch (err) {
            done(err);
        }
    });

    it("should not ignore the auth header even if it matches the stored access token", async function(done) {
        try {
            jest.setTimeout(15000);
            await startST();
            AuthHttpRequest.addAxiosInterceptors(axiosInstance);
            AuthHttpRequest.init({
                apiDomain: BASE_URL,
                tokenTransferMethod: "cookie"
            });

            let originalGet = axiosInstance.get;
            let calledWithCustomHeader = false;

            // We mock specific URLs here, for other URLs we make an actual network call
            axiosInstance.get = jest.fn((url, config) => {
                console.log(url);
                if (url === BASE_URL + "/") {
                    let headers = new Headers(config.headers);
                    if (headers.get("authorization") === "Bearer myOwnHeHe") {
                        calledWithCustomHeader = true;
                        let response = {
                            data: {
                                message: "OK"
                            },
                            status: 200,
                            headers: {},
                            config: config,
                            request: undefined
                        };

                        return Promise.resolve(response);
                    } else {
                        let response = {
                            data: {
                                message: "Bad auth header"
                            },
                            status: 500,
                            headers: {},
                            config: config,
                            request: undefined
                        };

                        return Promise.resolve(response);
                    }
                }

                return originalGet(url, config);
            });

            let userId = "testing-supertokens-react-native";

            let loginResponse = await axiosInstance.post(`${BASE_URL}/login`, JSON.stringify({ userId }), {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                }
            });
            let userIdFromResponse = loginResponse.data;
            assertEqual(userId, userIdFromResponse);

            await delay(5);
            await setToken("access", "myOwnHeHe");

            let response = await axiosInstance.get(`${BASE_URL}/`, {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    Authorization: "Bearer myOwnHeHe"
                }
            });

            assertEqual(response.status, 200);
            assertEqual(calledWithCustomHeader, true);
            done();
        } catch (e) {
            done(e);
        }
    });
});

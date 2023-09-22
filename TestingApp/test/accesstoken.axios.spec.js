/* Copyright (c) 2022, VRAI Labs and/or its affiliates. All rights reserved.
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
import axiosCookieJarSupport from "axios-cookiejar-support";
// const axiosCookieJarSupport = require("axios-cookiejar-support").default;
const tough = require("tough-cookie");
import AntiCsrfToken from "supertokens-react-native/lib/build/antiCsrf";
import FrontToken from "supertokens-react-native/lib/build/frontToken";
import AuthHttpRequestFetch from "supertokens-react-native/lib/build/fetch";
import AuthHttpRequestAxios from "supertokens-react-native/lib/build/axios";
import AuthHttpRequest from "supertokens-react-native";
import { interceptorFunctionRequestFulfilled, responseInterceptor } from "supertokens-react-native/lib/build/axios";
import assert from "assert";
import {
    getNumberOfTimesRefreshCalled,
    startST,
    getNumberOfTimesGetSessionCalled,
    BASE_URL_FOR_ST,
    BASE_URL as UTILS_BASE_URL,
    getNumberOfTimesRefreshAttempted,
    checkIfV3AccessTokenIsSupported
} from "./utils";
import { spawn } from "child_process";
import { ProcessState, PROCESS_STATE } from "supertokens-react-native/lib/build/processState";
import { getLocalSessionState } from "supertokens-react-native/lib/build/utils";
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
        let child = spawn("./test/startServer", [
            process.env.INSTALL_PATH,
            process.env.NODE_PORT === undefined ? 8080 : process.env.NODE_PORT,
            "header"
        ]);

        // Uncomment this to print server logs
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", data => console.log(data));
        child.stderr.on("data", data => console.log(data));
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

        let instance = axios.create();
        await instance.post(BASE_URL_FOR_ST + "/beforeeach");
        await instance.post(BASE_URL + "/beforeeach");

        let cookieJar = new tough.CookieJar();
        axiosInstance = axios.create({
            withCredentials: true
        });
        axiosCookieJarSupport(axiosInstance);
        axiosInstance.defaults.jar = cookieJar;

        let nodeFetch = require("node-fetch").default;
        const fetch = require("fetch-cookie")(nodeFetch, cookieJar);
        global.fetch = fetch;
        global.Headers = nodeFetch.Headers;
        global.__supertokensOriginalFetch = undefined;
        global.__supertokensSessionRecipe = undefined;
    });

    it("should return the appropriate access token payload", async function(done) {
        try {
            jest.setTimeout(10000);
            await startST();
            AuthHttpRequest.addAxiosInterceptors(axiosInstance);
            AuthHttpRequest.init({
                apiDomain: UTILS_BASE_URL
            });

            let userId = "testing-supertokens-react-native";
            let loginResponse = await axiosInstance.post(`${UTILS_BASE_URL}/login`, JSON.stringify({ userId }), {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                }
            });
            let userIdFromResponse = loginResponse.data;
            assertEqual(userId, userIdFromResponse);

            const payload = await AuthHttpRequest.getAccessTokenPayloadSecurely();

            if (await checkIfV3AccessTokenIsSupported()) {
                assertNotEqual(payload, undefined);
                const expectedKeys = [
                    "sub",
                    "exp",
                    "iat",
                    "sessionHandle",
                    "refreshTokenHash1",
                    "parentRefreshTokenHash1",
                    "antiCsrfToken",
                    "iss"
                ];

                if (payload["tId"]) {
                    expectedKeys.push("tId");
                }

                if (payload["rsub"]) {
                    expectedKeys.push("rsub");
                }

                assertEqual(Object.keys(payload).length, expectedKeys.length);
                for (const key of Object.keys(payload)) {
                    assert(expectedKeys.includes(key));
                }
            } else {
                assertEqual(payload, {});
            }

            done();
        } catch (e) {
            done(e);
        }
    });

    it("should be able to refresh a session started w/ CDI 2.18", async function(done) {
        try {
            jest.setTimeout(10000);
            await startST();
            AuthHttpRequest.addAxiosInterceptors(axiosInstance);
            AuthHttpRequest.init({
                apiDomain: UTILS_BASE_URL
            });

            let userId = "testing-supertokens-react-native";

            await axiosInstance.post(`${UTILS_BASE_URL}/login-2.18`, JSON.stringify({ userId, payload: { asdf: 1 } }), {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                }
            });

            assertNotEqual(await AuthHttpRequest.getAccessTokenPayloadSecurely(), undefined);

            const payload = await AuthHttpRequest.getAccessTokenPayloadSecurely();
            assert.deepStrictEqual(payload, { asdf: 1 });

            await AuthHttpRequest.attemptRefreshingSession();

            if (await checkIfV3AccessTokenIsSupported()) {
                assertNotEqual(await AuthHttpRequest.getAccessTokenPayloadSecurely(), undefined);

                const v3Payload = await AuthHttpRequest.getAccessTokenPayloadSecurely();

                const expectedKeys = [
                    "sub",
                    "exp",
                    "iat",
                    "sessionHandle",
                    "refreshTokenHash1",
                    "parentRefreshTokenHash1",
                    "antiCsrfToken",
                    "asdf"
                ];

                if (v3Payload["tId"]) {
                    expectedKeys.push("tId");
                }

                if (v3Payload["rsub"]) {
                    expectedKeys.push("rsub");
                }

                assert.strictEqual(Object.keys(v3Payload).length, expectedKeys.length);
                for (const key of Object.keys(v3Payload)) {
                    assert(expectedKeys.includes(key));
                }
                assert.strictEqual(v3Payload.asdf, 1);
            } else {
                const v2Payload = await AuthHttpRequest.getAccessTokenPayloadSecurely();

                assert.deepStrictEqual(v2Payload, { asdf: 1 });
            }

            done();
        } catch (e) {
            done(e);
        }
    });
});

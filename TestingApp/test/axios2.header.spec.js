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
const tough = require("tough-cookie");

import AntiCsrfToken from "supertokens-react-native/lib/build/antiCsrf";
import FrontToken from "supertokens-react-native/lib/build/frontToken";
import AuthHttpRequestFetch from "supertokens-react-native/lib/build/fetch";
import AuthHttpRequest from "supertokens-react-native";

import { ProcessState } from "supertokens-react-native/lib/build/processState";
import assert from "assert";

import {
    getNumberOfTimesRefreshCalled,
    startST,
    BASE_URL_FOR_ST,
    BASE_URL as UTILS_BASE_URL,
    getNumberOfTimesRefreshAttempted,
    coreTagEqualToOrAfter
} from "./utils";

import { spawn } from "child_process";
// jest does not call setupFiles properly with the new react-native init, so doing it this way instead
import "./setup";

process.env.TEST_MODE = "testing";

// TODO NEMI: This should use base url from utils
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
});

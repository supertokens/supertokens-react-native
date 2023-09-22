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
const tough = require("tough-cookie");
import AntiCsrfToken from "supertokens-react-native/lib/build/antiCsrf";
import FrontToken from "supertokens-react-native/lib/build/frontToken";
import AuthHttpRequestFetch from "supertokens-react-native/lib/build/fetch";
import AuthHttpRequest from "supertokens-react-native";
import assert from "assert";
import {
    getNumberOfTimesRefreshCalled,
    startST,
    getNumberOfTimesGetSessionCalled,
    BASE_URL_FOR_ST,
    coreTagEqualToOrAfter,
    getNumberOfTimesRefreshAttempted,
    checkIfV3AccessTokenIsSupported
} from "./utils";
import { spawn } from "child_process";
import { ProcessState, PROCESS_STATE } from "supertokens-react-native/lib/build/processState";
import "isomorphic-fetch";
// jest does not call setupFiles properly with the new react-native init, so doing it this way instead
import "./setup";
import { getLocalSessionState } from "supertokens-react-native/lib/build/utils";

const BASE_URL = "http://localhost:8080";

/* TODO: 
    - User passed config should be sent as well
    - session should not exist when user's session fully expires - use doesSessionExist & check localstorage is empty
    - while logged in, test that APIs that there is proper change in id refresh cookie
    - tests APIs that don't require authentication work after logout - with-credentials don't get sent.
    - if not logged in, test that API that requires auth throws session expired
    - Test everything without and without interception
    - If user provides withCredentials as false or whatever, then app should not add it
    - Cross origin API requests to API that requires Auth
    - Cross origin API request to APi that doesn't require auth
    - Proper change in anti-csrf token once access token resets
    - Refresh API custom headers are working
    - allow-credentials should not be sent by our SDK by default.
    - User passed config should be sent as well
*/

process.env.TEST_MODE = "testing";

describe("Fetch AuthHttpRequest class tests", function() {
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
        // child.stdout.setEncoding('utf8');
        // child.stderr.setEncoding('utf8');
        // child.stdout.on("data", data => console.log(data))
        // child.stderr.on("data", data => console.log(data))
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

        let nodeFetch = require("node-fetch").default;
        const fetch = require("fetch-cookie")(nodeFetch, new tough.CookieJar());
        global.fetch = fetch;
        global.__supertokensOriginalFetch = undefined;
        global.__supertokensSessionRecipe = undefined;
    });

    it("should return the appropriate access token payload", async function(done) {
        try {
            jest.setTimeout(10000);
            await startST();
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });

            let userId = "testing-supertokens-react-native";
            let loginResponse = await global.fetch(`${BASE_URL}/login`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId })
            });
            let userIdFromResponse = await loginResponse.text();
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
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });

            let userId = "testing-supertokens-react-native";

            await global.fetch(`${BASE_URL}/login-2.18`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId, payload: { asdf: 1 } })
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

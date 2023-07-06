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
import { startST, BASE_URL_FOR_ST } from "./utils";
import {
    getNumberOfTimesRefreshCalled,
    startST,
    getNumberOfTimesGetSessionCalled,
    BASE_URL_FOR_ST,
    coreTagEqualToOrAfter,
    getNumberOfTimesRefreshAttempted
} from "./utils";
import { spawn } from "child_process";
import { ProcessState, PROCESS_STATE } from "supertokens-react-native/lib/build/processState";
import "isomorphic-fetch";
// jest does not call setupFiles properly with the new react-native init, so doing it this way instead
import "./setup";
import { getLocalSessionState } from "supertokens-react-native/lib/build/utils";
import { getTokenForHeaderAuth } from "supertokens-react-native/lib/build/utils";
import { setToken } from "supertokens-react-native/lib/build/utils";

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

    it("checking in fetch that methods exists", function() {
        assert.strictEqual(typeof AuthHttpRequestFetch.doRequest, "function");
        assert.strictEqual(typeof AuthHttpRequestFetch.attemptRefreshingSession, "function");
    });

    it("testing with fetch for init check in doRequest", async function() {
        let failed = false;
        try {
            await AuthHttpRequestFetch.doRequest(async () => {});
            failed = true;
        } catch (err) {}

        if (failed) {
            throw Error("test failed");
        }
    });

    it("testing with fetch for init check in attemptRefreshingSession", async function() {
        let failed = false;
        try {
            await AuthHttpRequestFetch.attemptRefreshingSession();
            failed = true;
        } catch (err) {}

        if (failed) {
            throw Error("test failed");
        }
    });

    it("testing with fetch api methods without config", async function() {
        AuthHttpRequest.init({
            apiDomain: BASE_URL
        });

        let getResponse = await global.fetch(`${BASE_URL}/testing`, {
            method: "GET"
        });
        let postResponse = await global.fetch(`${BASE_URL}/testing`, {
            method: "POST"
        });
        let deleteResponse = await global.fetch(`${BASE_URL}/testing`, {
            method: "DELETE"
        });
        let putResponse = await global.fetch(`${BASE_URL}/testing`, {
            method: "PUT"
        });

        getResponse = await getResponse.text();
        putResponse = await putResponse.text();
        postResponse = await postResponse.text();
        deleteResponse = await deleteResponse.text();
        let expectedResponse = "success";

        assert.strictEqual(getResponse, expectedResponse);
        assert.strictEqual(putResponse, expectedResponse);
        assert.strictEqual(postResponse, expectedResponse);
        assert.strictEqual(deleteResponse, expectedResponse);
    });

    it("testing with fetch api methods with config", async function() {
        AuthHttpRequest.init({
            apiDomain: BASE_URL
        });

        let testing = "testing";
        let getResponse = await global.fetch(`${BASE_URL}/${testing}`, { method: "GET", headers: { testing } });
        let postResponse = await global.fetch(`${BASE_URL}/${testing}`, { method: "post", headers: { testing } });
        let deleteResponse = await global.fetch(`${BASE_URL}/${testing}`, { method: "delete", headers: { testing } });
        let putResponse = await global.fetch(`${BASE_URL}/${testing}`, { method: "put", headers: { testing } });
        let doRequestResponse1 = await global.fetch(`${BASE_URL}/${testing}`, {
            method: "GET",
            headers: { testing }
        });
        let doRequestResponse2 = await global.fetch(`${BASE_URL}/${testing}`, {
            method: "GET",
            headers: { testing }
        });

        let getResponseHeader = getResponse.headers.get(testing);
        getResponse = await getResponse.text();
        let putResponseHeader = putResponse.headers.get(testing);
        putResponse = await putResponse.text();
        let postResponseHeader = postResponse.headers.get(testing);
        postResponse = await postResponse.text();
        let deleteResponseHeader = deleteResponse.headers.get(testing);
        deleteResponse = await deleteResponse.text();
        let doRequestResponseHeader1 = doRequestResponse1.headers.get(testing);
        doRequestResponse1 = await doRequestResponse1.text();
        let doRequestResponseHeader2 = doRequestResponse2.headers.get(testing);
        doRequestResponse2 = await doRequestResponse2.text();
        let expectedResponse = "success";

        assert.strictEqual(getResponse, expectedResponse);
        assert.strictEqual(getResponseHeader, testing);
        assert.strictEqual(putResponse, expectedResponse);
        assert.strictEqual(putResponseHeader, testing);
        assert.strictEqual(postResponse, expectedResponse);
        assert.strictEqual(postResponseHeader, testing);
        assert.strictEqual(deleteResponse, expectedResponse);
        assert.strictEqual(deleteResponseHeader, testing);
        assert.strictEqual(doRequestResponse1, expectedResponse);
        assert.strictEqual(doRequestResponseHeader1, testing);
        assert.strictEqual(doRequestResponse2, expectedResponse);
        assert.strictEqual(doRequestResponseHeader2, testing);
    });

    it("testing with fetch api methods that doesn't exists", async function() {
        AuthHttpRequest.init({
            apiDomain: BASE_URL
        });

        let getResponse = await global.fetch(`${BASE_URL}/fail`, {
            method: "GET"
        });
        let postResponse = await global.fetch(`${BASE_URL}/fail`, {
            method: "POST"
        });
        let deleteResponse = await global.fetch(`${BASE_URL}/fail`, {
            method: "DELETE"
        });
        let putResponse = await global.fetch(`${BASE_URL}/fail`, {
            method: "PUT"
        });
        let doRequestResponse1 = await global.fetch(`${BASE_URL}/fail`, { method: "GET" });
        let doRequestResponse2 = await global.fetch(`${BASE_URL}/fail`, { method: "GET" });

        let getResponseCode = getResponse.status;
        let putResponseCode = putResponse.status;
        let postResponseCode = postResponse.status;
        let deleteResponseCode = deleteResponse.status;
        let doRequestResponseCode1 = doRequestResponse1.status;
        let doRequestResponseCode2 = doRequestResponse2.status;
        let expectedStatusCode = 404;

        assert.strictEqual(getResponseCode, expectedStatusCode);
        assert.strictEqual(putResponseCode, expectedStatusCode);
        assert.strictEqual(postResponseCode, expectedStatusCode);
        assert.strictEqual(deleteResponseCode, expectedStatusCode);
        assert.strictEqual(doRequestResponseCode1, expectedStatusCode);
        assert.strictEqual(doRequestResponseCode2, expectedStatusCode);
    });

    it("test refresh session with fetch", async function(done) {
        try {
            jest.setTimeout(10000);
            await startST(3);

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

            assert((await loginResponse.text()) === userId);

            //delay for 3 seconds for access token validity expiry
            await delay(5);

            //check that the number of times the refreshAPI was called is 0
            assert((await getNumberOfTimesRefreshCalled()) === 0);

            let getResponse = await global.fetch(`${BASE_URL}/`);

            //check that the response to getSession was success
            assert((await getResponse.text()) === userId);

            //check that the number of time the refreshAPI was called is 1
            assert((await getNumberOfTimesRefreshCalled()) === 1);

            done();
        } catch (err) {
            done(err);
        }
    });

    it("test session after signing key change", async function(done) {
        try {
            jest.setTimeout(20000);
            // We can have access tokens valid for longer than the signing key update interval
            await startST(100, true, "0.002");

            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });

            let userId = "testing-supertokens-react-native";

            //send loing request
            let loginResponse = await global.fetch(`${BASE_URL}/login`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId })
            });
            assertEqual(await loginResponse.text(), userId);

            //delay for 11 seconds for access token signing key to change
            assertEqual(await getNumberOfTimesRefreshCalled(), 0);
            await delay(11);

            //check that the number of times the refreshAPI was called is 0
            assertEqual(await getNumberOfTimesRefreshCalled(), 0);

            const promises = [];
            for (let i = 0; i < 250; i++) {
                promises.push(global.fetch(`${BASE_URL}/`).catch(() => {}));
            }
            await Promise.all(promises);

            let coreSupportsMultipleSignigKeys = coreTagEqualToOrAfter("3.6.0");

            assertEqual(await getNumberOfTimesRefreshCalled(), coreSupportsMultipleSignigKeys ? 0 : 1);
            done();
        } catch (err) {
            done(err);
        }
    });

    it("test rid is there", async function(done) {
        try {
            jest.setTimeout(10000);
            await startST(3);

            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });

            let userId = "testing-supertokens-react-native";

            //send loing request
            let loginResponse = await global.fetch(`${BASE_URL}/login`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId })
            });
            assertEqual(await loginResponse.text(), userId);

            let getResponse = await global.fetch(`${BASE_URL}/check-rid`);

            assertEqual(await getResponse.text(), "success");
            done();
        } catch (err) {
            done(err);
        }
    });

    it("signout with expired access token", async function(done) {
        try {
            jest.setTimeout(10000);
            await startST();

            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });

            let userId = "testing-supertokens-react-native";

            //send loing request
            let loginResponse = await global.fetch(`${BASE_URL}/login`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId })
            });
            assertEqual(await loginResponse.text(), userId);
            await delay(5);

            assertEqual(await getNumberOfTimesRefreshCalled(), 0);
            await AuthHttpRequest.signOut();
            assertEqual(await getNumberOfTimesRefreshCalled(), 1);
            assertEqual(await AuthHttpRequest.doesSessionExist(), false);

            done();
        } catch (err) {
            done(err);
        }
    });

    // test custom headers are being sent when logged in and when not*****
    it("test with fetch that custom headers are being sent", async function(done) {
        try {
            await startST();

            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });
            let userId = "testing-supertokens-react-native";

            //send loing request
            let loginResponse = await global.fetch(`${BASE_URL}/login`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId })
            });
            assertEqual(await loginResponse.text(), userId);

            //send api request with custom headers and check that they are set
            let testResponse = await global.fetch(`${BASE_URL}/testing`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    testing: "testValue"
                }
            });

            // check that output is success
            assertEqual(await testResponse.text(), "success");
            //check that the custom headers are present
            assertEqual(await testResponse.headers.get("testing"), "testValue");

            //send logout request
            let logoutResponse = await global.fetch(`${BASE_URL}/logout`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId })
            });
            assertEqual(await logoutResponse.text(), "success");

            let testResponse2 = await global.fetch(`${BASE_URL}/testing`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    testing: "testValue"
                }
            });
            // check that output is success
            assertEqual(await testResponse2.text(), "success");
            //check that the custom headers are present
            assertEqual(await testResponse2.headers.get("testing"), "testValue");

            done();
        } catch (err) {
            done(err);
        }
    });

    //testing doesSessionExist works fine when user is logged in******
    it("test with fetch that doesSessionExist works fine when the user is logged in", async function(done) {
        try {
            jest.setTimeout(15000);
            await startST(5);

            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });
            let userId = "testing-supertokens-react-native";

            //send loing request
            let loginResponse = await global.fetch(`${BASE_URL}/login`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId })
            });
            assertEqual(await loginResponse.text(), userId);

            assertEqual(await AuthHttpRequest.doesSessionExist(), true);
            done();
        } catch (err) {
            done(err);
        }
    });

    //session should not exist when user calls log out - use doesSessionExist & check localstorage is empty
    it("test with fetch session should not exist when user calls log out", async function(done) {
        try {
            jest.setTimeout(15000);
            await startST(5);

            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });
            let userId = "testing-supertokens-react-native";

            // send api request to login
            let loginResponse = await global.fetch(`${BASE_URL}/login`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId })
            });
            assertEqual(await loginResponse.text(), userId);

            assertEqual(await AuthHttpRequest.doesSessionExist(), true);

            // send api request to logout
            let logoutResponse = await global.fetch(`${BASE_URL}/logout`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId })
            });

            let responseText = await logoutResponse.text();
            assertEqual(responseText, "success");
            assertEqual(await AuthHttpRequest.doesSessionExist(), false);
            done();
        } catch (err) {
            done(err);
        }
    });

    it("test with fetch that attemptRefreshingSession is working correctly", async function(done) {
        try {
            jest.setTimeout(15000);
            await startST(5);

            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });
            let userId = "testing-supertokens-react-native";

            // send api request to login
            let loginResponse = await global.fetch(`${BASE_URL}/login`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId })
            });

            assertEqual(await loginResponse.text(), userId);

            await delay(5);
            let attemptRefresh = await AuthHttpRequest.attemptRefreshingSession();
            assertEqual(attemptRefresh, true);

            //check that the number of times the refresh API was called is 1
            assertEqual(await getNumberOfTimesRefreshCalled(), 1);

            let getSessionResponse = await fetch(`${BASE_URL}/`);
            assertEqual(await getSessionResponse.text(), userId);

            //check that the number of times the refresh API was called is still 1
            assertEqual(await getNumberOfTimesRefreshCalled(), 1);

            done();
        } catch (err) {
            done(err);
        }
    });

    // multiple API calls in parallel when access token is expired (100 of them) and only 1 refresh should be called*****
    it("test with fetch that multiple API calls in parallel when access token is expired, only 1 refresh should be called", async function(done) {
        try {
            jest.setTimeout(15000);
            await startST(5);

            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });
            let userId = "testing-supertokens-react-native";

            // send api request to login
            let loginResponse = await global.fetch(`${BASE_URL}/login`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId })
            });

            assertEqual(await loginResponse.text(), userId);
            assertEqual(await getNumberOfTimesRefreshCalled(), 0);

            // wait for 7 seconds so that the accesstoken expires
            await delay(7);

            let promises = [];
            let n = 100;

            // create an array of 100 get session promises
            for (let i = 0; i < n; i++) {
                promises.push(global.fetch(`${BASE_URL}/`));
            }

            // send 100 get session requests
            let multipleGetSessionResponse = await Promise.all(promises);

            //check that reponse of all requests are success
            let noOfResponeSuccesses = 0;
            for (let i = 0; i < multipleGetSessionResponse.length; i++) {
                let responseText = await multipleGetSessionResponse[i].text();
                assertEqual(responseText, userId);
                noOfResponeSuccesses += 1;
            }

            //check that the number of times refresh is called is 1

            assertEqual(await getNumberOfTimesRefreshCalled(), 1);
            assertEqual(noOfResponeSuccesses, n);
            done();
        } catch (err) {
            done(err);
        }
    });

    // - Things should work if anti-csrf is disabled.******
    it("test with fetch that things should work correctly if anti-csrf is disabled", async function(done) {
        try {
            jest.setTimeout(15000);
            await startST(3, false);
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });
            let userId = "testing-supertokens-react-native";

            // send api request to login
            let loginResponse = await global.fetch(`${BASE_URL}/login`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId })
            });
            assertEqual(await loginResponse.text(), userId);
            assertEqual(await AuthHttpRequest.doesSessionExist(), true);
            assertEqual(await getNumberOfTimesRefreshCalled(), 0);

            await delay(5);

            let getSessionResponse = await global.fetch(`${BASE_URL}/`);

            assertEqual(await getSessionResponse.text(), userId);
            assertEqual(await getNumberOfTimesRefreshCalled(), 1);

            let logoutResponse = await global.fetch(`${BASE_URL}/logout`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId })
            });

            assertEqual(await AuthHttpRequest.doesSessionExist(), false);
            assertEqual(await logoutResponse.text(), "success");
            done();
        } catch (err) {
            done(err);
        }
    });

    // if any API throws error, it gets propogated to the user properly (with and without interception)******
    it("test with fetch that if an api throws an error it gets propagated to the user with interception", async done => {
        try {
            jest.setTimeout(15000);
            await startST();
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });

            let val = await global.fetch(`${BASE_URL}/testError`);
            assertEqual(await val.text(), "test error message");
            assertEqual(val.status, 500);

            done();
        } catch (err) {
            done(err);
        }
    });

    // if any API throws error, it gets propogated to the user properly (with and without interception)******
    it("test with fetch that if an api throws an error it gets propagated to the user without interception", async done => {
        try {
            jest.setTimeout(15000);
            await startST();
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });

            let val = await global.fetch(`${BASE_URL}/testError`);
            assertEqual(await val.text(), "test error message");
            assertEqual(val.status, 500);

            done();
        } catch (err) {
            done(err);
        }
    });

    //    - Calling SuperTokens.init more than once works!*******
    it("test with fetch that calling SuperTokens.init more than once works", async done => {
        try {
            jest.setTimeout(15000);
            await startST();
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });
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

            assertEqual(await loginResponse.text(), userId);
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });

            let logoutResponse = await global.fetch(`${BASE_URL}/logout`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId })
            });

            assertEqual(await logoutResponse.text(), "success");

            //check that session does not exist
            assertEqual(await AuthHttpRequest.doesSessionExist(), false);

            //check that login still works correctly
            loginResponse = await global.fetch(`${BASE_URL}/login`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId })
            });

            assertEqual(await loginResponse.text(), userId);
            done();
        } catch (err) {
            done(err);
        }
    });

    //If via interception, make sure that initially, just an endpoint is just hit twice in case of access token expiry*****
    it("test with fetch that if via interception, initially an endpoint is hit just once in case of access token expiry", async done => {
        try {
            jest.setTimeout(15000);
            await startST(3);
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });
            let userId = "testing-supertokens-react-native";

            // send api request to login
            let loginResponse = await global.fetch(`${BASE_URL}/login`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId })
            });

            assertEqual(await loginResponse.text(), userId);

            //wait for 3 seconds such that the session expires
            await delay(5);

            let getSessionResponse = await global.fetch(`${BASE_URL}/`);
            assertEqual(await getSessionResponse.text(), userId);

            //check that the number of times getSession was called is 1
            assertEqual(await getNumberOfTimesGetSessionCalled(), 1);

            //check that the number of times refesh session was called is 1
            assertEqual(await getNumberOfTimesRefreshCalled(), 1);
            done();
        } catch (err) {
            done(err);
        }
    });

    //- If you make an api call without cookies(logged out) api throws session expired , then make sure that refresh token api is not getting called , get 401 as the output****
    it("test with fetch that an api call without cookies throws session expire, refresh api is not called and 401 is the output", async function(done) {
        try {
            jest.setTimeout(15000);
            await startST(5);
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

            assertEqual(await loginResponse.text(), userId);

            let logoutResponse = await global.fetch(`${BASE_URL}/logout`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId })
            });

            assertEqual(await logoutResponse.text(), "success");

            let getSessionResponse = await global.fetch(`${BASE_URL}/`);

            //check that the response to getSession without cookies is 401
            assertEqual(getSessionResponse.status, 401);

            assertEqual(await getNumberOfTimesRefreshCalled(), 0);
            done();
        } catch (err) {
            done(err);
        }
    });

    //    - If via interception, make sure that initially, just an endpoint is just hit once in case of access token NOT expiry*****
    it("test that via interception initially an endpoint is just hit once in case of valid access token", async function(done) {
        try {
            jest.setTimeout(15000);
            await startST(5);
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });
            let userId = "testing-supertokens-react-native";

            // send api request to login
            let loginResponse = await global.fetch(`${BASE_URL}/login`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId })
            });

            assertEqual(await loginResponse.text(), userId);

            let getSessionResponse = await global.fetch(`${BASE_URL}/`);
            assertEqual(await getSessionResponse.text(), userId);

            //check that the number of times getSession was called is 1
            assertEqual(await getNumberOfTimesGetSessionCalled(), 1);

            //check that the number of times refresh session was called is 0
            assertEqual(await getNumberOfTimesRefreshCalled(), 0);

            done();
        } catch (err) {
            done(err);
        }
    });

    //    - Interception should not happen when domain is not the one that they gave*******
    it("test with fetch interception should not happen when domain is not the one that they gave", async function(done) {
        try {
            jest.setTimeout(15000);
            await startST(5);
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });
            let userId = "testing-supertokens-react-native";

            // this is technically not doing interception, but it is equavalent to doing it since the inteceptor just calls the function below.
            await fetch(`https://www.google.com`);

            let verifyRequestState = await ProcessState.getInstance().waitForEvent(
                PROCESS_STATE.CALLING_INTERCEPTION_REQUEST,
                100
            );

            assertEqual(verifyRequestState, undefined);

            let loginResponse = await global.fetch(`${BASE_URL}/login`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId })
            });

            assertEqual(await loginResponse.text(), userId);

            verifyRequestState = await ProcessState.getInstance().waitForEvent(
                PROCESS_STATE.CALLING_INTERCEPTION_REQUEST,
                5000
            );
            assert(verifyRequestState !== undefined);
            done();
        } catch (err) {
            done(err);
        }
    });

    it("test with fetch that if multiple interceptors are there, they should all work", async function(done) {
        try {
            jest.setTimeout(15000);
            await startST(5);
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });
            let userId = "testing-supertokens-react-native";

            let myFetch = async (url, config) => {
                let testConfig = config;
                testConfig = {
                    ...testConfig,
                    headers: {
                        ...testConfig.headers,
                        interceptorHeader1: "value1",
                        interceptorHeader2: "value2"
                    }
                };
                let response = await global.fetch(url, testConfig);
                let requestValue = await response.text();
                response = {
                    ...response,
                    headers: {
                        ...response.headers,
                        doInterception3: "value3",
                        doInterception4: "value4"
                    },
                    body: {
                        key: requestValue
                    }
                };
                return response;
            };

            let multipleInterceptorResponse = await myFetch(`${BASE_URL}/multipleInterceptors`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    doMultipleInterceptors: "true"
                },
                body: JSON.stringify({ userId })
            });
            assert.deepEqual(multipleInterceptorResponse.body.key, "success");
            assert.notDeepEqual(multipleInterceptorResponse.headers.doInterception3, undefined);
            assert.notDeepEqual(multipleInterceptorResponse.headers.doInterception4, undefined);
            done();
        } catch (err) {
            done(err);
        }
    });

    it("fetch check sessionDoes exist calls refresh API just once", async function(done) {
        try {
            jest.setTimeout(10000);
            await startST(3);
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });

            let userId = "testing-supertokens-website";

            // call sessionDoesExist
            assertEqual(await AuthHttpRequest.doesSessionExist(), false);

            // check refresh API was called once
            assertEqual(await getNumberOfTimesRefreshCalled(), 0);
            assertEqual((await getLocalSessionState()).status, "NOT_EXISTS");

            // call sessionDoesExist
            assertEqual(await AuthHttpRequest.doesSessionExist(), false);

            // check refresh API not called
            assertEqual(await getNumberOfTimesRefreshCalled(), 0);
            assertEqual((await getLocalSessionState()).status, "NOT_EXISTS");

            await global.fetch(`${BASE_URL}/login`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId })
            });

            // call sessionDoesExist
            assertEqual(await AuthHttpRequest.doesSessionExist(), true);
            // check refresh API not called
            assertEqual(await getNumberOfTimesRefreshCalled(), 0);
            assertEqual((await getLocalSessionState()).status, "EXISTS");

            done();
        } catch (err) {
            done(err);
        }
    });

    it("test that unauthorised event is not fired on app launch", async function() {
        await startST();

        let events = [];

        AuthHttpRequest.init({
            apiDomain: BASE_URL,
            onHandleEvent: event => {
                events.push("ST_" + event.action);
            }
        });

        let userId = "testing-supertokens-react-native";

        // send api request to login
        let loginResponse = await global.fetch(`${BASE_URL}/login`, {
            method: "post",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ userId })
        });

        assertEqual(await loginResponse.text(), userId);
        assert(events.length === 1);
        assert(events[0] === "ST_SESSION_CREATED");
    });

    it("test that unauthorised event is fired when calling protected route without a session", async function() {
        await startST();

        let events = [];

        AuthHttpRequest.init({
            apiDomain: BASE_URL,
            onHandleEvent: event => {
                events.push(`ST_${event.action}:${JSON.stringify(event)}`);
            }
        });

        let response = await global.fetch(`${BASE_URL}/`);
        assertEqual(response.status, 401);

        assert(events.length === 1);
        const eventName = "ST_UNAUTHORISED";

        assert(events[0].startsWith(eventName));
        const parsedEvent = JSON.parse(events[0].substr(eventName.length + 1));
        assert(parsedEvent.sessionExpiredOrRevoked === false);
    });

    it("Testing jest mocking", async function(done) {
        try {
            jest.setTimeout(10000);
            let originalFetch = global.fetch;

            // We mock specific URLs here, for other URLs we make an actual network call
            let firstGet = true;
            let firstPost = true;

            global.fetch = jest.fn((url, config) => {
                if (url === BASE_URL + "/") {
                    if (firstGet) {
                        firstGet = false;

                        let responseInit = {
                            status: 401
                        };

                        let response = new Response(
                            JSON.stringify({
                                message: "try refresh token"
                            }),
                            responseInit
                        );
                        Object.defineProperty(response, "url", { value: BASE_URL + "/" });
                        return Promise.resolve(response);
                    } else {
                        let responseInit = {
                            status: 200
                        };

                        let response = new Response(
                            JSON.stringify({
                                success: true
                            }),
                            responseInit
                        );
                        Object.defineProperty(response, "url", { value: BASE_URL + "/" });
                        return Promise.resolve(response);
                    }
                } else if (url === BASE_URL + "/auth/session/refresh") {
                    let responseInit = {
                        status: 500
                    };

                    let response = new Response(
                        JSON.stringify({
                            message: "test"
                        }),
                        responseInit
                    );
                    Object.defineProperty(response, "url", { value: BASE_URL + "/auth/session/refresh" });
                    return Promise.resolve(response);
                }

                return originalFetch(url, config);
            });

            await startST();
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });

            let userId = "testing-supertokens-react-native";

            // send api request to login
            let loginResponse = await global.fetch(`${BASE_URL}/login`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId })
            });

            let response = await fetch(`${BASE_URL}/`, { method: "GET" });
            assertEqual(response.url, `${BASE_URL}/auth/session/refresh`);
            assertEqual(response.status, 500);
            const data = await response.json();
            assertEqual(data.message, "test");
            done();
        } catch (err) {
            done(err);
        }
    });

    it("no refresh call after 401 response that removes session", async function(done) {
        try {
            jest.setTimeout(10000);
            let originalFetch = global.fetch;

            // We mock specific URLs here, for other URLs we make an actual network call
            let refreshCalled = 0;

            global.fetch = jest.fn((url, config) => {
                if (url === BASE_URL + "/") {
                    let responseInit = {
                        status: 401,
                        headers: {
                            "id-refresh-token": "remove",
                            "Set-Cookie": [
                                "sAccessToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax",
                                "sRefreshToken=; Path=/auth/session/refresh; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax"
                            ],
                            "front-token": "remove"
                        }
                    };

                    let response = new Response(
                        JSON.stringify({
                            message: "test"
                        }),
                        responseInit
                    );
                    Object.defineProperty(response, "url", { value: BASE_URL + "/" });
                    return Promise.resolve(response);
                } else if (url === BASE_URL + "/auth/session/refresh") {
                    let responseInit = {
                        status: 401
                    };

                    let response = new Response(
                        JSON.stringify({
                            message: "nope"
                        }),
                        responseInit
                    );
                    Object.defineProperty(response, "url", { value: BASE_URL + "/auth/session/refresh" });
                    return Promise.resolve(response);
                }

                return originalFetch(url, config);
            });

            await startST(100, true, "0.002");
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });

            let userId = "testing-supertokens-react-native";

            // send api request to login
            let loginResponse = await global.fetch(`${BASE_URL}/login`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId })
            });

            const resp = await global.fetch(`${BASE_URL}/`, {
                method: "GET",
                headers: { "Cache-Control": "no-cache, private" }
            });

            assertNotEqual(resp, undefined);
            assertEqual(resp.status, 401);
            assertEqual(resp.url, `${BASE_URL}/`);
            const data = await resp.json();
            assertNotEqual(data, undefined);
            assertEqual(data.message, "test");

            done();
        } catch (err) {
            done(err);
        }
    });

    it("original endpoint responding with 500 should not call refresh without cookies", async function(done) {
        try {
            jest.setTimeout(10000);
            let originalFetch = global.fetch;

            // We mock specific URLs here, for other URLs we make an actual network call
            let refreshCalled = 0;

            global.fetch = jest.fn((url, config) => {
                if (url === BASE_URL + "/") {
                    let responseInit = {
                        status: 500
                    };

                    let response = new Response(
                        JSON.stringify({
                            message: "test"
                        }),
                        responseInit
                    );
                    Object.defineProperty(response, "url", { value: BASE_URL + "/" });
                    return Promise.resolve(response);
                } else if (url === BASE_URL + "/auth/session/refresh") {
                    ++refreshCalled;
                    let responseInit = {
                        status: 500
                    };

                    let response = new Response(
                        JSON.stringify({
                            message: "nope"
                        }),
                        responseInit
                    );
                    Object.defineProperty(response, "url", { value: BASE_URL + "/auth/session/refresh" });
                    return Promise.resolve(response);
                }

                return originalFetch(url, config);
            });

            await startST(100, true, "0.002");
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });

            let response = await global.fetch(`${BASE_URL}/`, { method: "GET" });
            assertEqual(response.url, `${BASE_URL}/`);
            assertEqual(response.status, 500);
            const data = await response.json();
            assertEqual(data.message, "test");

            assert.equal(refreshCalled, 0);

            done();
        } catch (err) {
            done(err);
        }
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
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });

            let accessToken = await AuthHttpRequest.getAccessToken();
            assertEqual(accessToken, undefined);

            let userId = "testing-supertokens-react-native";

            // send api request to login
            let loginResponse = await global.fetch(`${BASE_URL}/login`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId })
            });

            assertEqual(await loginResponse.text(), userId);

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
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });

            let userId = "testing-supertokens-react-native";

            // send api request to login
            let loginResponse = await global.fetch(`${BASE_URL}/login`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId })
            });

            assertEqual(await loginResponse.text(), userId);

            let accessToken = await AuthHttpRequest.getAccessToken();
            assertNotEqual(accessToken, undefined);

            let getSessionResponse = await global.fetch(`${BASE_URL}/`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });
            assertEqual(await getSessionResponse.text(), userId);

            getSessionResponse = await global.fetch(`${BASE_URL}/`, {
                headers: {
                    authorization: `Bearer ${accessToken}`
                }
            });
            assertEqual(await getSessionResponse.text(), userId);

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
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });

            let userId = "testing-supertokens-react-native";

            // send api request to login
            let loginResponse = await global.fetch(`${BASE_URL}/login`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId })
            });

            assertEqual(await loginResponse.text(), userId);

            let originalFetch = global.fetch;

            // We mock specific URLs here, for other URLs we make an actual network call
            global.fetch = jest.fn((url, config) => {
                if (url === BASE_URL + "/") {
                    let headers = new Headers(config.headers);

                    if (headers.get("authorization") === "Bearer customAccess") {
                        let responseInit = {
                            status: 500
                        };

                        let response = new Response(
                            JSON.stringify({
                                message: "test"
                            }),
                            responseInit
                        );
                        Object.defineProperty(response, "url", { value: BASE_URL + "/" });
                        return Promise.resolve(response);
                    }
                }

                return originalFetch(url, config);
            });

            let getSessionResponse = await global.fetch(`${BASE_URL}/`, {
                headers: {
                    Authorization: `Bearer customAccess`
                }
            });

            assertEqual(getSessionResponse.status, 500);

            getSessionResponse = await global.fetch(`${BASE_URL}/`, {
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
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });

            let userId = "testing-supertokens-react-native";

            // send api request to login
            let loginResponse = await global.fetch(`${BASE_URL}/login`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId })
            });

            assertEqual(await loginResponse.text(), userId);

            let accessToken = AuthHttpRequest.getAccessToken();
            assertNotEqual(accessToken, undefined);

            let originalFetch = global.fetch;

            // We mock specific URLs here, for other URLs we make an actual network call
            global.fetch = jest.fn((url, config) => {
                if (url === "https://test.com/") {
                    let headers = new Headers(config.headers);

                    let responseInit = {
                        status: 404
                    };

                    if (headers.get("authorization") === `Bearer ${accessToken}`) {
                        responseInit = {
                            status: 200
                        };
                    }

                    let response = new Response(
                        JSON.stringify({
                            message: "test"
                        }),
                        responseInit
                    );
                    return Promise.resolve(response);
                }

                return originalFetch(url, config);
            });

            let getSessionResponse = await global.fetch("https://test.com/", {
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
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });

            let userId = "testing-supertokens-react-native";

            // send api request to login
            let loginResponse = await global.fetch(`${BASE_URL}/login`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId })
            });

            assertEqual(await loginResponse.text(), userId);

            let accessToken = await AuthHttpRequest.getAccessToken();
            assertNotEqual(accessToken, undefined);

            // Wait for expiry
            await delay(5);

            let getSessionResponse = await global.fetch(`${BASE_URL}/`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });

            assertEqual(await getNumberOfTimesRefreshCalled(), 1);
            assertEqual(getSessionResponse.status, 200);
            assertEqual(await getSessionResponse.text(), userId);

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
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });

            let userId = "testing-supertokens-react-native";

            // send api request to login
            let loginResponse = await global.fetch(`${BASE_URL}/login`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId })
            });

            assertEqual(await loginResponse.text(), userId);

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
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });

            let userId = "testing-supertokens-react-native";

            // send api request to login
            let loginResponse = await global.fetch(`${BASE_URL}/login`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId })
            });

            assertEqual(await loginResponse.text(), userId);

            let accessToken = await AuthHttpRequest.getAccessToken();
            assertNotEqual(accessToken, undefined);

            await AuthHttpRequest.signOut();

            let getSessionResponse = await global.fetch(`${BASE_URL}/`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });

            assertEqual(getSessionResponse.status, 200);
            assertEqual(await getSessionResponse.text(), userId);

            done();
        } catch (err) {
            done(err);
        }
    });

    it("Test that access token and refresh token are cleared when front token is cleared", async function(done) {
        try {
            jest.setTimeout(15000);
            await startST();
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });

            let userId = "testing-supertokens-react-native";

            // send api request to login
            await global.fetch(`${BASE_URL}/login`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId })
            });

            let accessToken = await getTokenForHeaderAuth("access");
            let refreshToken = await getTokenForHeaderAuth("refresh");

            assertNotEqual(accessToken, undefined);
            assertNotEqual(refreshToken, undefined);

            await global.fetch(`${BASE_URL}/logout-alt`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({})
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
            jest.setTimeout(10000);
            let originalFetch = global.fetch;

            // We mock specific URLs here, for other URLs we make an actual network call
            let calledWithCustomHeader = false;

            global.fetch = jest.fn((url, config) => {
                if (url === BASE_URL + "/") {
                    let headers = new Headers(config.headers);
                    if (headers.get("authorization") === "Bearer myOwnHeHe") {
                        calledWithCustomHeader = true;
                        let responseInit = {
                            status: 200
                        };

                        let response = new Response(
                            JSON.stringify({
                                message: "OK"
                            }),
                            responseInit
                        );
                        Object.defineProperty(response, "url", { value: BASE_URL + "/" });

                        return Promise.resolve(response);
                    } else {
                        let responseInit = {
                            status: 500
                        };

                        let response = new Response(
                            JSON.stringify({
                                message: "Bad auth header"
                            }),
                            responseInit
                        );
                        Object.defineProperty(response, "url", { value: BASE_URL + "/" });

                        return Promise.resolve(response);
                    }
                }

                return originalFetch(url, config);
            });

            await startST();
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });

            let userId = "testing-supertokens-react-native";

            // send api request to login
            await global.fetch(`${BASE_URL}/login`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId })
            });

            await delay(5);
            await setToken("access", "myOwnHeHe");

            const resp = await global.fetch(`${BASE_URL}/`, {
                method: "GET",
                headers: { "Cache-Control": "no-cache, private", Authorization: "Bearer myOwnHeHe" }
            });

            assertEqual(resp.status, 200);
            assertEqual(calledWithCustomHeader, true);

            done();
        } catch (err) {
            done(err);
        }
    });
});

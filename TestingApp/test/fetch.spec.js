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
    getNumberOfTimesRefreshAttempted
} from "./utils";
import { spawn } from "child_process";
import { ProcessState, PROCESS_STATE } from "supertokens-react-native/lib/build/processState";
import "isomorphic-fetch";
// jest does not call setupFiles properly with the new react-native init, so doing it this way instead
import "./setup";
import { getLocalSessionState } from "supertokens-react-native/lib/build/utils";

const BASE_URL = "http://localhost:8080";
let cookieJar = new tough.CookieJar();

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
            process.env.NODE_PORT === undefined ? 8080 : process.env.NODE_PORT
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
        cookieJar = new tough.CookieJar();
        const fetch = require("fetch-cookie")(nodeFetch, cookieJar);
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
            apiDomain: BASE_URL,
            tokenTransferMethod: "cookie"
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
            apiDomain: BASE_URL,
            tokenTransferMethod: "cookie"
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
            apiDomain: BASE_URL,
            tokenTransferMethod: "cookie"
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
                apiDomain: BASE_URL,
                tokenTransferMethod: "cookie"
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
                apiDomain: BASE_URL,
                tokenTransferMethod: "cookie"
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
                apiDomain: BASE_URL,
                tokenTransferMethod: "cookie"
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
                apiDomain: BASE_URL,
                tokenTransferMethod: "cookie"
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

    it("test update jwt data with fetch", async function(done) {
        try {
            jest.setTimeout(10000);
            await startST(3);

            AuthHttpRequest.init({
                apiDomain: BASE_URL,
                tokenTransferMethod: "cookie"
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

            let data = await AuthHttpRequest.getAccessTokenPayloadSecurely();
            assertEqual(Object.keys(data).length, 0);

            // update jwt data
            let testResponse1 = await global.fetch(`${BASE_URL}/update-jwt`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ key: "łukasz 馬 / 马" })
            });
            let data1 = await testResponse1.json();
            assertEqual(data1.key, "łukasz 馬 / 马");

            data = await AuthHttpRequest.getAccessTokenPayloadSecurely();
            assertEqual(data.key, "łukasz 馬 / 马");

            //delay for 5 seconds for access token validity expiry
            await delay(5);

            //check that the number of times the refreshAPI was called is 0
            assertEqual(await getNumberOfTimesRefreshCalled(), 0);

            // get jwt data
            let testResponse2 = await global.fetch(`${BASE_URL}/update-jwt`, { method: "get" });
            let data2 = await testResponse2.json();
            assertEqual(data2.key, "łukasz 馬 / 马");
            assertEqual(await getNumberOfTimesRefreshCalled(), 1);

            // update jwt data
            let testResponse3 = await global.fetch(`${BASE_URL}/update-jwt`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ key1: " łukasz data1" })
            });
            let data3 = await testResponse3.json();
            assertEqual(data3.key1, " łukasz data1");
            assertEqual(data3.key, undefined);

            data = await AuthHttpRequest.getAccessTokenPayloadSecurely();
            assertEqual(data.key1, " łukasz data1");
            assertEqual(data.key, undefined);

            // get jwt data
            let testResponse4 = await global.fetch(`${BASE_URL}/update-jwt`, { method: "get" });
            let data4 = await testResponse4.json();
            assertEqual(data4.key1, " łukasz data1");
            assertEqual(data4.key, undefined);

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
                apiDomain: BASE_URL,
                tokenTransferMethod: "cookie"
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
                apiDomain: BASE_URL,
                tokenTransferMethod: "cookie"
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
                apiDomain: BASE_URL,
                tokenTransferMethod: "cookie"
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
                apiDomain: BASE_URL,
                tokenTransferMethod: "cookie"
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
                apiDomain: BASE_URL,
                tokenTransferMethod: "cookie"
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
                apiDomain: BASE_URL,
                tokenTransferMethod: "cookie"
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
                apiDomain: BASE_URL,
                tokenTransferMethod: "cookie"
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
                apiDomain: BASE_URL,
                tokenTransferMethod: "cookie"
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
                apiDomain: BASE_URL,
                tokenTransferMethod: "cookie"
            });
            AuthHttpRequest.init({
                apiDomain: BASE_URL,
                tokenTransferMethod: "cookie"
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
                apiDomain: BASE_URL,
                tokenTransferMethod: "cookie"
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
                apiDomain: BASE_URL,
                tokenTransferMethod: "cookie"
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
                apiDomain: BASE_URL,
                tokenTransferMethod: "cookie"
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
                apiDomain: BASE_URL,
                tokenTransferMethod: "cookie"
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
                apiDomain: BASE_URL,
                tokenTransferMethod: "cookie"
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
                apiDomain: BASE_URL,
                tokenTransferMethod: "cookie"
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
            await startST();
            AuthHttpRequest.init({
                apiDomain: BASE_URL,
                tokenTransferMethod: "cookie"
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
            tokenTransferMethod: "cookie",
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
            tokenTransferMethod: "cookie",
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
                apiDomain: BASE_URL,
                tokenTransferMethod: "cookie"
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
                apiDomain: BASE_URL,
                tokenTransferMethod: "cookie"
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
                apiDomain: BASE_URL,
                tokenTransferMethod: "cookie"
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

    it("should work after refresh migrating old cookie based sessions", async function(done) {
        try {
            jest.setTimeout(10000);
            await startST();

            AuthHttpRequest.init({
                apiDomain: BASE_URL,
                tokenTransferMethod: "cookie"
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

            cookieJar.setCookieSync("sIdRefreshToken=asdf", `${BASE_URL}/`);

            // This is to verify that the cookie is correctly set
            let currentCookies = cookieJar.getCookiesSync(`${BASE_URL}/`);
            let idRefreshInCookies = currentCookies.filter(i => i.key === "sIdRefreshToken");

            assert(idRefreshInCookies.length !== 0);

            //check that the number of times the refreshAPI was called is 0
            assert((await getNumberOfTimesRefreshCalled()) === 0);

            let getResponse = await global.fetch(`${BASE_URL}/`);

            //check that the response to getSession was success
            assert((await getResponse.text()) === userId);

            //check that the number of time the refreshAPI was called is 1
            assert((await getNumberOfTimesRefreshCalled()) === 1);

            currentCookies = cookieJar.getCookiesSync(`${BASE_URL}/`);
            idRefreshInCookies = currentCookies.filter(i => i.key === "sIdRefreshToken");

            assert(idRefreshInCookies.length === 0);

            done();
        } catch (err) {
            done(err);
        }
    });

    it("should work after refresh migrating old cookie based sessions with expired access tokens", async function(done) {
        try {
            jest.setTimeout(10000);
            await startST();

            AuthHttpRequest.init({
                apiDomain: BASE_URL,
                tokenTransferMethod: "cookie"
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

            // This would work even without sIdRefreshToken since we don't actually check the body of the response, just call refresh on all 401s
            cookieJar.setCookieSync("sIdRefreshToken=asdf", `${BASE_URL}/`);
            cookieJar.setCookieSync(`sAccessToken=${""};Expires=0`, `${BASE_URL}/`);

            // This is to verify that the cookie is correctly set
            let currentCookies = cookieJar.getCookiesSync(`${BASE_URL}/`);
            let idRefreshInCookies = currentCookies.filter(i => i.key === "sIdRefreshToken");
            let accessTokenInCookies = currentCookies.filter(i => i.key === "sAccessToken");

            assert(idRefreshInCookies.length !== 0);
            assert(accessTokenInCookies.length !== 0);

            //check that the number of times the refreshAPI was called is 0
            assert((await getNumberOfTimesRefreshCalled()) === 0);

            let getResponse = await global.fetch(`${BASE_URL}/`);

            //check that the response to getSession was success
            assert((await getResponse.text()) === userId);

            //check that the number of time the refreshAPI was called is 1
            assert((await getNumberOfTimesRefreshCalled()) === 1);

            currentCookies = cookieJar.getCookiesSync(`${BASE_URL}/`);
            idRefreshInCookies = currentCookies.filter(i => i.key === "sIdRefreshToken");

            assert(idRefreshInCookies.length === 0);

            done();
        } catch (err) {
            done(err);
        }
    });
});

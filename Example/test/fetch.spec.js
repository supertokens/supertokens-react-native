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
import AuthHttpRequestFetch from "supertokens-react-native/lib/build/fetch";
import AuthHttpRequest from "supertokens-react-native/axios";
import assert from "assert";
import {
    checkIfIdRefreshIsCleared,
    getNumberOfTimesRefreshCalled,
    startST,
    getNumberOfTimesGetSessionCalled
} from "./utils";
import { spawn } from "child_process";
import { ProcessState, PROCESS_STATE } from "supertokens-react-native/lib/build/processState";

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

    beforeAll(async function() {
        spawn("./test/startServer", [
            process.env.INSTALL_PATH === undefined ? "../../com-root" : process.env.INSTALL_PATH
        ]);
        await new Promise(r => setTimeout(r, 1000));
    });

    afterAll(async function() {
        let instance = axios.create();
        await instance.post(BASE_URL + "/after");
        try {
            await instance.get(BASE_URL + "/stop");
        } catch (err) {}
    });

    beforeEach(async function() {
        AuthHttpRequestFetch.initCalled = false;
        AuthHttpRequest.initCalled = false;
        AuthHttpRequestFetch.originalFetch = undefined;
        AuthHttpRequestFetch.viaInterceptor = undefined;
        ProcessState.getInstance().reset();
        let instance = axios.create();
        await instance.post(BASE_URL + "/beforeeach");

        let nodeFetch = require("node-fetch").default;
        const fetch = require("fetch-cookie")(nodeFetch, new tough.CookieJar());
        global.fetch = fetch;
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

    it("testing with fetch api methods without config", async function() {
        AuthHttpRequestFetch.init({
            apiDomain: BASE_URL
        });

        let getResponse = await fetch(`${BASE_URL}/testing`, {
            method: "GET"
        });
        let postResponse = await fetch(`${BASE_URL}/testing`, {
            method: "POST"
        });
        let deleteResponse = await fetch(`${BASE_URL}/testing`, {
            method: "DELETE"
        });
        let putResponse = await fetch(`${BASE_URL}/testing`, {
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
        AuthHttpRequestFetch.init({
            apiDomain: BASE_URL
        });

        let testing = "testing";
        let getResponse = await fetch(`${BASE_URL}/${testing}`, { method: "GET", headers: { testing } });
        let postResponse = await fetch(`${BASE_URL}/${testing}`, { method: "post", headers: { testing } });
        let deleteResponse = await fetch(`${BASE_URL}/${testing}`, { method: "delete", headers: { testing } });
        let putResponse = await fetch(`${BASE_URL}/${testing}`, { method: "put", headers: { testing } });
        let doRequestResponse1 = await fetch(`${BASE_URL}/${testing}`, {
            method: "GET",
            headers: { testing }
        });
        let doRequestResponse2 = await fetch(`${BASE_URL}/${testing}`, {
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
        AuthHttpRequestFetch.init({
            apiDomain: BASE_URL
        });

        let getResponse = await fetch(`${BASE_URL}/fail`, {
            method: "GET"
        });
        let postResponse = await fetch(`${BASE_URL}/fail`, {
            method: "POST"
        });
        let deleteResponse = await fetch(`${BASE_URL}/fail`, {
            method: "DELETE"
        });
        let putResponse = await fetch(`${BASE_URL}/fail`, {
            method: "PUT"
        });
        let doRequestResponse1 = await fetch(`${BASE_URL}/fail`, { method: "GET" });
        let doRequestResponse2 = await fetch(`${BASE_URL}/fail`, { method: "GET" });

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

            AuthHttpRequestFetch.init({
                apiDomain: BASE_URL
            });
            let userId = "testing-supertokens-react-native";

            let loginResponse = await fetch(`${BASE_URL}/login`, {
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

            let getResponse = await fetch(`${BASE_URL}/`);

            let responseText = await getResponse.text();
            console.log("Response: ", responseText);
            //check that the response to getSession was success
            assert(responseText === "success");

            //check that the number of time the refreshAPI was called is 1
            assert((await getNumberOfTimesRefreshCalled()) === 1);

            done();
        } catch (err) {
            done(err);
        }
    });

    //test custom headers are being sent when logged in and when not*****
    it("test with fetch that custom headers are being sent", async function(done) {
        try {
            jest.setTimeout(10000);
            await startST();

            AuthHttpRequestFetch.init({
                refreshTokenUrl: `${BASE_URL}/refresh`
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

            AuthHttpRequestFetch.init({
                refreshTokenUrl: `${BASE_URL}/refresh`
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

            assertEqual(await AuthHttpRequestFetch.doesSessionExist(), true);
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

            AuthHttpRequestFetch.init({
                refreshTokenUrl: `${BASE_URL}/refresh`
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

            assertEqual(await AuthHttpRequestFetch.doesSessionExist(), true);

            // send api request to logout
            let logoutResponse = await global.fetch(`${BASE_URL}/logout`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId })
            });

            assertEqual(await logoutResponse.text(), "success");
            assertEqual(await AuthHttpRequestFetch.doesSessionExist(), false);
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

            AuthHttpRequestFetch.init({
                refreshTokenUrl: `${BASE_URL}/refresh`
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
                assertEqual(await multipleGetSessionResponse[i].text(), "success");
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
            AuthHttpRequestFetch.init({
                refreshTokenUrl: `${BASE_URL}/refresh`
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
            assertEqual(await AuthHttpRequestFetch.doesSessionExist(), true);
            assertEqual(await getNumberOfTimesRefreshCalled(), 0);

            await delay(5);

            let getSessionResponse = await global.fetch(`${BASE_URL}/`);

            assertEqual(await getSessionResponse.text(), "success");
            assertEqual(await getNumberOfTimesRefreshCalled(), 1);

            let logoutResponse = await global.fetch(`${BASE_URL}/logout`, {
                method: "post",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId })
            });

            assertEqual(await AuthHttpRequestFetch.doesSessionExist(), false);
            assertEqual(await logoutResponse.text(), "success");
            done();
        } catch (err) {
            done(err);
        }
    });

    // device info tests******
    it("test with fetch that device info is sent", async function(done) {
        try {
            jest.setTimeout(15000);
            await startST();
            AuthHttpRequestFetch.init({
                refreshTokenUrl: `${BASE_URL}/refresh`,
                viaInterceptor: true
            });
            let userId = "testing-supertokens-react-native";

            // send request to check if deviceInfo is beinf added to headers
            let deviceInfoIsAdded = await fetch(`${BASE_URL}/checkDeviceInfo`);
            assertEqual(await deviceInfoIsAdded.text(), "true");
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
            AuthHttpRequestFetch.init({
                refreshTokenUrl: `${BASE_URL}/refresh`
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
            AuthHttpRequestFetch.init({
                refreshTokenUrl: `${BASE_URL}/refresh`,
                viaInterceptor: false
            });

            let val = await AuthHttpRequestFetch.get(`${BASE_URL}/testError`);
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
            AuthHttpRequestFetch.init({
                refreshTokenUrl: `${BASE_URL}/refresh`
            });
            AuthHttpRequestFetch.init({
                refreshTokenUrl: `${BASE_URL}/refresh`
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
            AuthHttpRequestFetch.init({
                refreshTokenUrl: `${BASE_URL}/refresh`
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
            assertEqual(await AuthHttpRequestFetch.doesSessionExist(), false);

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
    it("test with fetch that if via interception, initially an endpoint is hit just twice in case of access token expiry", async done => {
        try {
            jest.setTimeout(15000);
            await startST(3);
            AuthHttpRequestFetch.init({
                refreshTokenUrl: `${BASE_URL}/refresh`
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
            assertEqual(await getSessionResponse.text(), "success");

            //check that the number of times getSession was called is 2
            assertEqual(await getNumberOfTimesGetSessionCalled(), 2);

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
            AuthHttpRequestFetch.init({
                refreshTokenUrl: `${BASE_URL}/refresh`
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
            AuthHttpRequestFetch.init({
                refreshTokenUrl: `${BASE_URL}/refresh`
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
            assertEqual(await getSessionResponse.text(), "success");

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
            AuthHttpRequestFetch.init({
                refreshTokenUrl: `${BASE_URL}/refresh`
            });
            let userId = "testing-supertokens-react-native";

            // this is technically not doing interception, but it is equavalent to doing it since the inteceptor just calls the function below.
            await AuthHttpRequestFetch.fetch(`https://www.google.com`);

            let verifyRequestState = await ProcessState.getInstance().waitForEvent(
                PROCESS_STATE.CALLING_INTERCEPTION_REQUEST,
                100
            );

            assertEqual(verifyRequestState, undefined);

            let loginResponse = await AuthHttpRequestFetch.fetch(`${BASE_URL}/login`, {
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
            AuthHttpRequestFetch.init({
                refreshTokenUrl: `${BASE_URL}/refresh`
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
                let response = await AuthHttpRequestFetch.fetch(url, testConfig);
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
});

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
import IdRefreshToken from "supertokens-react-native/lib/build/idRefreshToken";
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
    getNumberOfTimesRefreshAttempted
} from "./utils";
import { spawn } from "child_process";
import { ProcessState, PROCESS_STATE } from "supertokens-react-native/lib/build/processState";
// jest does not call setupFiles properly with the new react-native init, so doing it this way instead
import "./setup";

process.env.TEST_MODE = "testing";

// TODO NEMI: This should probably just use the base url from utils
const BASE_URL = "http://localhost:8080";
let axiosInstance;
/* TODO: 
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
*/
describe("Axios AuthHttpRequest class tests", function() {
    async function delay(time) {
        return new Promise(resolve => setTimeout(resolve, time * 1000));
    }

    function assertEqual(a, b) {
        assert(a === b);
    }

    beforeAll(async function() {
        spawn("./test/startServer", [
            process.env.INSTALL_PATH,
            process.env.NODE_PORT === undefined ? 8080 : process.env.NODE_PORT
        ]);
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
        await IdRefreshToken.removeToken();
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
        global.__supertokensOriginalFetch = undefined;
        global.__supertokensSessionRecipe = undefined;
    });

    it("testing for init check in doRequest", async function() {
        let failed = false;
        try {
            await AuthHttpRequestAxios.doRequest(async () => {});
            failed = true;
        } catch (err) {
            if (err.message !== "init function not called") {
                failed = true;
            }
        }

        if (failed) {
            throw Error("test failed");
        }
    });

    it("testing for init check in attemptRefreshingSession", async function(done) {
        let failed = false;
        try {
            await AuthHttpRequest.attemptRefreshingSession();
            failed = true;
        } catch (err) {}

        if (failed) {
            throw Error("test failed");
        }
        done();
    });

    it("testing getDomain", async function() {
        AuthHttpRequest.init({
            apiDomain: BASE_URL
        });

        let getResponse = await axios.get(`${BASE_URL}/testing`);
        let postResponse = await axios.post(`${BASE_URL}/testing`);
        let deleteResponse = await axios.delete(`${BASE_URL}/testing`);
        let putResponse = await axios.put(`${BASE_URL}/testing`);
        let doRequestResponse = await axios({ method: "GET", url: `${BASE_URL}/testing` });
        getResponse = await getResponse.data;
        putResponse = await putResponse.data;
        postResponse = await postResponse.data;
        deleteResponse = await deleteResponse.data;
        doRequestResponse = await doRequestResponse.data;
        let expectedResponse = "success";

        assert.strictEqual(getResponse, expectedResponse);
        assert.strictEqual(putResponse, expectedResponse);
        assert.strictEqual(postResponse, expectedResponse);
        assert.strictEqual(deleteResponse, expectedResponse);
        assert.strictEqual(doRequestResponse, expectedResponse);
    });

    it("testing api methods without config", async function() {
        AuthHttpRequest.init({
            apiDomain: BASE_URL
        });

        let getResponse = await axiosInstance.get(`${BASE_URL}/testing`);
        let postResponse = await axiosInstance.post(`${BASE_URL}/testing`);
        let deleteResponse = await axiosInstance.delete(`${BASE_URL}/testing`);
        let putResponse = await axiosInstance.put(`${BASE_URL}/testing`);
        let doRequestResponse = await axiosInstance({ method: "GET", url: `${BASE_URL}/testing` });

        getResponse = await getResponse.data;
        putResponse = await putResponse.data;
        postResponse = await postResponse.data;
        deleteResponse = await deleteResponse.data;
        doRequestResponse = await doRequestResponse.data;
        let expectedResponse = "success";

        assert.strictEqual(getResponse, expectedResponse);
        assert.strictEqual(putResponse, expectedResponse);
        assert.strictEqual(postResponse, expectedResponse);
        assert.strictEqual(deleteResponse, expectedResponse);
        assert.strictEqual(doRequestResponse, expectedResponse);
    });

    it("testing api methods with config", async function() {
        AuthHttpRequest.init({
            apiDomain: BASE_URL
        });

        let testing = "testing";
        let getResponse = await axiosInstance.get(`${BASE_URL}/${testing}`, { headers: { testing } });
        let postResponse = await axiosInstance.post(`${BASE_URL}/${testing}`, undefined, {
            headers: { testing }
        });
        let deleteResponse = await axiosInstance.delete(`${BASE_URL}/${testing}`, { headers: { testing } });
        let putResponse = await axiosInstance.put(`${BASE_URL}/${testing}`, undefined, { headers: { testing } });
        let doRequestResponse1 = await axiosInstance({
            url: `${BASE_URL}/${testing}`,
            method: "GET",
            headers: { testing }
        });
        let doRequestResponse2 = await axiosInstance({
            url: `${BASE_URL}/${testing}`,
            method: "GET",
            headers: { testing }
        });

        let getResponseHeader = getResponse.headers[testing];
        getResponse = await getResponse.data;
        let putResponseHeader = putResponse.headers[testing];
        putResponse = await putResponse.data;
        let postResponseHeader = postResponse.headers[testing];
        postResponse = await postResponse.data;
        let deleteResponseHeader = deleteResponse.headers[testing];
        deleteResponse = await deleteResponse.data;
        let doRequestResponseHeader1 = doRequestResponse1.headers[testing];
        doRequestResponse1 = await doRequestResponse1.data;
        let doRequestResponseHeader2 = doRequestResponse2.headers[testing];
        doRequestResponse2 = await doRequestResponse2.data;
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

    it("testing api methods that doesn't exists", async function() {
        AuthHttpRequest.init({
            apiDomain: BASE_URL
        });
        let expectedStatusCode = 404;
        try {
            await axiosInstance.get(`${BASE_URL}/fail`);
            throw Error();
        } catch (err) {
            if (err.response !== undefined) {
                assert.strictEqual(err.response.status, expectedStatusCode);
            } else {
                throw Error("test failed!!!");
            }
        }
        try {
            await axiosInstance.post(`${BASE_URL}/fail`);
            throw Error();
        } catch (err) {
            if (err.response !== undefined) {
                assert.strictEqual(err.response.status, expectedStatusCode);
            } else {
                throw Error("test failed!!!");
            }
        }
        try {
            await axiosInstance.delete(`${BASE_URL}/fail`);
            throw Error();
        } catch (err) {
            if (err.response !== undefined) {
                assert.strictEqual(err.response.status, expectedStatusCode);
            } else {
                throw Error("test failed!!!");
            }
        }
        try {
            await axiosInstance.put(`${BASE_URL}/fail`);
            throw Error();
        } catch (err) {
            if (err.response !== undefined) {
                assert.strictEqual(err.response.status, expectedStatusCode);
            } else {
                throw Error("test failed!!!");
            }
        }
        try {
            await axiosInstance({ url: `${BASE_URL}/fail`, method: "GET" });
            throw Error();
        } catch (err) {
            if (err.response !== undefined) {
                assert.strictEqual(err.response.status, expectedStatusCode);
            } else {
                throw Error("test failed!!!");
            }
        }
        try {
            await axiosInstance({ url: `${BASE_URL}/fail`, method: "GET" });
            throw Error();
        } catch (err) {
            if (err.response !== undefined) {
                assert.strictEqual(err.response.status, expectedStatusCode);
            } else {
                throw Error("test failed!!!");
            }
        }
    });

    it("refresh session", async function(done) {
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
            await delay(3);

            assertEqual(await getNumberOfTimesRefreshCalled(), 0);
            let getResponse = await axiosInstance({ url: `${UTILS_BASE_URL}/`, method: "GET" });
            assertEqual(await getNumberOfTimesRefreshCalled(), 1);
            getResponse = await getResponse.data;
            assertEqual(getResponse, userId);
            done();
        } catch (err) {
            done(err);
        }
    });

    it("test that unauthorised event is not fired on app launch", async function() {
        await startST();

        AuthHttpRequest.addAxiosInterceptors(axiosInstance);
        let events = [];

        AuthHttpRequest.init({
            apiDomain: BASE_URL,
            onHandleEvent: event => {
                events.push("ST_" + event.action);
            }
        });

        let userId = "testing-supertokens-react-native";

        // send api request to login
        let loginResponse = await axiosInstance.post(`${BASE_URL}/login`, JSON.stringify({ userId }), {
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json"
            }
        });
        assertEqual(userId, loginResponse.data);
        assert(events.length === 1);
        assert(events[0] === "ST_SESSION_CREATED");
    });

    it("test that unauthorised event is fired when calling protected route without a session", async function() {
        await startST();

        AuthHttpRequest.addAxiosInterceptors(axiosInstance);
        let events = [];

        AuthHttpRequest.init({
            apiDomain: BASE_URL,
            onHandleEvent: event => {
                events.push(`ST_${event.action}:${JSON.stringify(event)}`);
            }
        });

        try {
            await axiosInstance({ url: `${BASE_URL}/`, method: "GET" });
        } catch (err) {
            assertEqual(err.response.status, 401);
        }

        assert(events.length === 1);

        const eventName = "ST_UNAUTHORISED";

        assert(events[0].startsWith(eventName));
        const parsedEvent = JSON.parse(events[0].substr(eventName.length + 1));
        assert(parsedEvent.sessionExpiredOrRevoked === false);
    });

    it("test that after login, and clearing all tokens, if we query a protected route, it fires unauthorised event", async function() {
        await startST();

        AuthHttpRequest.addAxiosInterceptors(axiosInstance);
        let events = [];

        AuthHttpRequest.init({
            apiDomain: BASE_URL,
            onHandleEvent: event => {
                events.push(`ST_${event.action}:${JSON.stringify(event)}`);
            }
        });

        let userId = "testing-supertokens-react-native";

        // send api request to login
        let loginResponse = await axiosInstance.post(`${BASE_URL}/login`, JSON.stringify({ userId }), {
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json"
            }
        });
        assertEqual(userId, loginResponse.data);

        // delete all tokens
        await IdRefreshToken.removeToken();
        await AntiCsrfToken.removeToken();
        await FrontToken.removeToken();

        try {
            await axiosInstance({ url: `${BASE_URL}/`, method: "GET" });
        } catch (err) {
            assertEqual(err.response.status, 401);
        }

        assert(events.length === 2);
        assert(events[0].startsWith("ST_SESSION_CREATED"));

        const eventName = "ST_UNAUTHORISED";
        assert(events[1].startsWith(eventName));
        const parsedEvent = JSON.parse(events[1].substr(eventName.length + 1));
        assert(parsedEvent.sessionExpiredOrRevoked === false);
    });

    it("test rid is there", async function() {
        await startST(3);
        AuthHttpRequest.addAxiosInterceptors(axiosInstance);

        AuthHttpRequest.init({
            apiDomain: BASE_URL
        });

        let userId = "testing-supertokens-react-native";

        // send api request to login
        let loginResponse = await axiosInstance.post(`${BASE_URL}/login`, JSON.stringify({ userId }), {
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json"
            }
        });
        assertEqual(userId, loginResponse.data);

        let getResponse = await axiosInstance({ url: `${BASE_URL}/check-rid`, method: "GET" });

        assertEqual(await getResponse.data, "success");
    });

    it("signout with expired access token", async function(done) {
        try {
            jest.setTimeout(10000);
            await startST();
            AuthHttpRequest.addAxiosInterceptors(axiosInstance);

            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });

            let userId = "testing-supertokens-react-native";

            // send api request to login
            let loginResponse = await axiosInstance.post(`${BASE_URL}/login`, JSON.stringify({ userId }), {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                }
            });
            assertEqual(userId, loginResponse.data);
            await delay(3);

            assertEqual(await getNumberOfTimesRefreshCalled(), 0);
            await AuthHttpRequest.signOut();
            assertEqual(await getNumberOfTimesRefreshCalled(), 1);
            assertEqual(await AuthHttpRequest.doesSessionExist(), false);
            done();
        } catch (err) {
            done(err);
        }
    });

    it("signout with not expired access token", async function() {
        await startST();
        AuthHttpRequest.addAxiosInterceptors(axiosInstance);

        AuthHttpRequest.init({
            apiDomain: BASE_URL
        });

        let userId = "testing-supertokens-react-native";

        // send api request to login
        let loginResponse = await axiosInstance.post(`${BASE_URL}/login`, JSON.stringify({ userId }), {
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json"
            }
        });
        assertEqual(userId, loginResponse.data);

        assertEqual(await getNumberOfTimesRefreshCalled(), 0);
        await AuthHttpRequest.signOut();
        assertEqual(await getNumberOfTimesRefreshCalled(), 0);
        assertEqual(await AuthHttpRequest.doesSessionExist(), false);
    });

    it("update jwt data", async function() {
        await startST();
        AuthHttpRequest.addAxiosInterceptors(axiosInstance);

        AuthHttpRequest.init({
            apiDomain: BASE_URL
        });

        let userId = "testing-supertokens-react-native";

        // send api request to login
        let loginResponse = await axiosInstance.post(`${BASE_URL}/login`, JSON.stringify({ userId }), {
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json"
            }
        });
        assertEqual(userId, loginResponse.data);

        let data = await AuthHttpRequest.getAccessTokenPayloadSecurely();
        assertEqual(Object.keys(data).length, 0);

        // update jwt data
        let testResponse1 = await axiosInstance.post(`${BASE_URL}/update-jwt`, { key: "data" });
        assertEqual(testResponse1.data.key, "data");

        data = await AuthHttpRequest.getAccessTokenPayloadSecurely();
        assertEqual(data.key, "data");

        // get jwt data
        let testResponse2 = await axiosInstance.get(`${BASE_URL}/update-jwt`);
        assertEqual(testResponse2.data.key, "data");

        // update jwt data
        let testResponse3 = await axiosInstance.post(`${BASE_URL}/update-jwt`, { key1: "data1" });
        assertEqual(testResponse3.data.key1, "data1");
        assertEqual(testResponse3.data.key, undefined);

        data = await AuthHttpRequest.getAccessTokenPayloadSecurely();
        assertEqual(data.key1, "data1");
        assertEqual(data.key, undefined);

        // get jwt data
        let testResponse4 = await axiosInstance.get(`${BASE_URL}/update-jwt`);
        assertEqual(testResponse4.data.key1, "data1");
        assertEqual(testResponse4.data.key, undefined);
    });

    //test custom headers are being sent when logged in and when not*****
    it("test that custom headers are being sent when logged in", async function(done) {
        try {
            jest.setTimeout(15000);
            await startST();
            AuthHttpRequest.addAxiosInterceptors(axiosInstance);
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });
            let userId = "testing-supertokens-react-native";

            // send api request to login
            let loginResponse = await axiosInstance.post(`${BASE_URL}/login`, JSON.stringify({ userId }), {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                }
            });
            assertEqual(userId, loginResponse.data);

            // send api request with custom headers and check that they are sent.
            let testResponse = await axiosInstance.post(`${BASE_URL}/testing`, JSON.stringify({ userId }), {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    testing: "testValue"
                }
            });
            assertEqual(testResponse.data, "success");
            //check that custom header values are sent
            assertEqual(testResponse.headers["testing"], "testValue");

            //send logout api request
            let logoutResponse = await axiosInstance.post(`${BASE_URL}/logout`, JSON.stringify({ userId }), {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                }
            });
            assertEqual(logoutResponse.data, "success");

            //send api request with custom headers
            let testResponse2 = await axiosInstance.post(`${BASE_URL}/testing`, JSON.stringify({ userId }), {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    testing: "testValue"
                }
            });
            assertEqual(testResponse2.data, "success");
            //check that custom headers are present
            assertEqual(testResponse2.headers["testing"], "testValue");
            done();
        } catch (err) {
            done(err);
        }
    });

    //testing doesSessionExist works fine when user is logged in******
    it("test doesSessionExist works fine when user is logged in", async function(done) {
        try {
            jest.setTimeout(15000);
            await startST(5);
            AuthHttpRequest.addAxiosInterceptors(axiosInstance);
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });
            let userId = "testing-supertokens-react-native";

            // send api request to login
            let loginResponse = await axiosInstance.post(`${BASE_URL}/login`, JSON.stringify({ userId }), {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                }
            });
            assertEqual(userId, loginResponse.data);
            assertEqual(await AuthHttpRequest.doesSessionExist(), true);
            done();
        } catch (err) {
            done(err);
        }
    });

    //session should not exist when user calls log out - use doesSessionExist & check localstorage is empty
    it("test session should not exist when user calls log out", async function(done) {
        try {
            await startST();
            AuthHttpRequest.addAxiosInterceptors(axiosInstance);
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });
            let userId = "testing-supertokens-react-native";

            // send api request to login
            let loginResponse = await axiosInstance.post(`${BASE_URL}/login`, JSON.stringify({ userId }), {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                }
            });
            assertEqual(userId, loginResponse.data);
            assertEqual(await AuthHttpRequest.doesSessionExist(), true);

            // send api request to logout
            let logoutResponse = await axiosInstance.post(`${BASE_URL}/logout`, JSON.stringify({ userId }), {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                }
            });
            let sessionExists = await AuthHttpRequest.doesSessionExist();

            assertEqual(logoutResponse.data, "success");
            assertEqual(sessionExists, false);
            done();
        } catch (err) {
            done(err);
        }
    });

    it("test that attemptRefreshingSession is working correctly", async function(done) {
        try {
            jest.setTimeout(15000);
            await startST(5);
            AuthHttpRequest.addAxiosInterceptors(axiosInstance);
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });

            let userId = "testing-supertokens-react-native";

            // send api request to login
            let loginResponse = await axiosInstance.post(`${BASE_URL}/login`, JSON.stringify({ userId }), {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                }
            });
            assertEqual(userId, loginResponse.data);

            await delay(7);
            let attemptRefresh = await AuthHttpRequest.attemptRefreshingSession();
            assertEqual(attemptRefresh, true);

            //check that the number of times the refresh API called is 1
            assertEqual(await getNumberOfTimesRefreshCalled(), 1);

            let getSessionResponse = await axiosInstance.get(`${BASE_URL}/`);
            assertEqual(getSessionResponse.data, userId);

            //check that the number of times the refresh API called is still 1
            assertEqual(await getNumberOfTimesRefreshCalled(), 1);
            done();
        } catch (err) {
            done(err);
        }
    });

    // multiple API calls in parallel when access token is expired (100 of them) and only 1 refresh should be called*****
    it("test that multiple API calls in parallel when access token is expired, only 1 refresh should be called", async function(done) {
        try {
            jest.setTimeout(15000);
            await startST(5, true);
            AuthHttpRequest.addAxiosInterceptors(axiosInstance);
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });
            let userId = "testing-supertokens-react-native";

            // send api request to login
            let loginResponse = await axiosInstance.post(`${BASE_URL}/login`, JSON.stringify({ userId }), {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                }
            });
            assertEqual(loginResponse.data, userId);
            assertEqual(await getNumberOfTimesRefreshCalled(), 0);

            // wait for 7 seconds so that the accesstoken expires
            await delay(7);

            let promises = [];
            let n = 100;

            // create an array of 100 get session promises
            for (let i = 0; i < n; i++) {
                promises.push(axiosInstance({ url: `${BASE_URL}/`, method: "GET" }));
            }

            // send 100 get session requests
            let multipleGetSessionResponse = await axios.all(promises);

            //check that reponse of all requests are success
            let noOfResponeSuccesses = 0;
            multipleGetSessionResponse.forEach(element => {
                assertEqual(element.data, userId);
                noOfResponeSuccesses += 1;
            });

            //check that the number of times refresh is called is 1
            assertEqual(await getNumberOfTimesRefreshCalled(), 1);
            assertEqual(noOfResponeSuccesses, n);
            done();
        } catch (err) {
            done(err);
        }
    });

    // - Things should work if anti-csrf is disabled.******
    it("test that things should work correctly if anti-csrf is disabled", async function(done) {
        try {
            jest.setTimeout(15000);
            await startST(3, false);
            AuthHttpRequest.addAxiosInterceptors(axiosInstance);
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });
            let userId = "testing-supertokens-react-native";
            // test out anti-csrf
            //check that login works correctly
            let loginResponse = await axiosInstance.post(`${BASE_URL}/login`, JSON.stringify({ userId }), {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                }
            });

            assertEqual(loginResponse.data, userId);
            assertEqual(await AuthHttpRequest.doesSessionExist(), true);

            assertEqual(await getNumberOfTimesRefreshCalled(), 0);

            await delay(5);

            let getSessionResponse = await axiosInstance({ url: `${BASE_URL}/`, method: "GET" });
            assertEqual(getSessionResponse.data, userId);
            assertEqual(await getNumberOfTimesRefreshCalled(), 1);

            let logoutResponse = await axiosInstance.post(`${BASE_URL}/logout`, JSON.stringify({ userId }), {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                }
            });

            assertEqual(await AuthHttpRequest.doesSessionExist(), false);
            assertEqual(logoutResponse.data, "success");
            done();
        } catch (err) {
            done(err);
        }
    });

    //test that calling makeSuper many times is not a problem******
    it("test that calling addAxiosInterceptors multiple times is not a problem", async done => {
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

            //check that the userId which is returned in the response is the same as the one we sent
            assertEqual(loginResponse.data, userId);

            // check that the session exists
            assertEqual(await AuthHttpRequest.doesSessionExist(), true);

            AuthHttpRequest.addAxiosInterceptors(axiosInstance);
            // check that the number of times session refresh is called is zero
            assertEqual(await getNumberOfTimesRefreshCalled(), 0);

            //delay for 5 seconds so that we know accessToken expires

            await delay(5);
            // send a get session request , which should do a refresh session request

            let getSessionResponse = await axiosInstance({ url: `${BASE_URL}/`, method: "GET" });

            // check that the getSession was successfull
            assertEqual(getSessionResponse.data, userId);

            // check that the refresh session was called only once
            assertEqual(await getNumberOfTimesRefreshCalled(), 1);

            // do logout
            let logoutResponse = await axiosInstance.post(`${BASE_URL}/logout`, JSON.stringify({ userId }), {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                }
            });

            AuthHttpRequest.addAxiosInterceptors(axiosInstance);
            assertEqual(logoutResponse.data, "success");

            //check that session does not exist
            assertEqual(await AuthHttpRequest.doesSessionExist(), false);
            done();
        } catch (err) {
            done(err);
        }
    });

    //    - User passed config should be sent as well******
    it("test that user passed config should be sent", async done => {
        try {
            jest.setTimeout(15000);
            await startST();
            AuthHttpRequest.addAxiosInterceptors(axiosInstance);
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });
            let userId = "testing-supertokens-react-native";

            let userConfigResponse = await axiosInstance.post(
                `${BASE_URL}/testUserConfig`,
                JSON.stringify({ userId }),
                {
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json"
                    },
                    timeout: 1000
                }
            );
            assertEqual(userConfigResponse.config.timeout, 1000);

            done();
        } catch (err) {
            done(err);
        }
    });

    // if any API throws error, it gets propogated to the user properly (with and without interception)******
    it("test that if an api throws an error it gets propagated to the user with interception", async done => {
        try {
            jest.setTimeout(15000);
            await startST();
            AuthHttpRequest.addAxiosInterceptors(axiosInstance);
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });
            try {
                await axiosInstance.get(`${BASE_URL}/testError`);
                assertEqual(false, "should not have come here");
            } catch (error) {
                assertEqual(error.response.data, "test error message");
                assertEqual(error.response.status, 500);
            }
            done();
        } catch (err) {
            done(err);
        }
    });

    // if any API throws error, it gets propogated to the user properly (with and without interception)******
    it("test that if an api throws an error, it gets propergated to the user without interception", async done => {
        try {
            jest.setTimeout(15000);
            await startST();
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });
            try {
                await axiosInstance.get(`${BASE_URL}/testError`);
                assert(false, "should not have come here");
            } catch (error) {
                assertEqual(error.response.data, "test error message");
                assertEqual(error.response.status, 500);
            }

            done();
        } catch (err) {
            done(err);
        }
    });

    //    - Calling SuperTokens.init more than once works!*******
    it("test that calling SuperTokens.init more than once works", async done => {
        try {
            jest.setTimeout(15000);
            await startST();
            AuthHttpRequest.addAxiosInterceptors(axiosInstance);
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });
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
            assertEqual(userId, loginResponse.data);

            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });

            let logoutResponse = await axiosInstance.post(`${BASE_URL}/logout`, JSON.stringify({ userId }), {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                }
            });

            assertEqual(logoutResponse.data, "success");

            //check that session does not exist
            assertEqual(await AuthHttpRequest.doesSessionExist(), false);

            //check that login still works correctly
            loginResponse = await axiosInstance.post(`${BASE_URL}/login`, JSON.stringify({ userId }), {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                }
            });
            assertEqual(userId, loginResponse.data);

            done();
        } catch (err) {
            done(err);
        }
    });

    //    - Interception should not happen when domain is not the one that they gave*******
    it("test interception should not happen when domain is not the one that they gave", async function(done) {
        try {
            jest.setTimeout(15000);
            await startST(5);
            AuthHttpRequest.addAxiosInterceptors(axiosInstance);
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });

            await axiosInstance.get(`https://www.google.com`);
            let verifyRequestState = await ProcessState.getInstance().waitForEvent(
                PROCESS_STATE.CALLING_INTERCEPTION_REQUEST,
                100
            );
            let verifyResponseState = await ProcessState.getInstance().waitForEvent(
                PROCESS_STATE.CALLING_INTERCEPTION_RESPONSE,
                100
            );

            assert.strictEqual(verifyRequestState, undefined);
            assert.strictEqual(verifyResponseState, undefined);

            let userId = "testing-supertokens-react-native";
            let loginResponse = await axiosInstance.post(`${BASE_URL}/login`, JSON.stringify({ userId }), {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                }
            });

            assert.strictEqual(await loginResponse.data, userId);

            verifyRequestState = await ProcessState.getInstance().waitForEvent(
                PROCESS_STATE.CALLING_INTERCEPTION_REQUEST,
                5000
            );
            verifyResponseState = await ProcessState.getInstance().waitForEvent(
                PROCESS_STATE.CALLING_INTERCEPTION_RESPONSE,
                5000
            );

            assert.notStrictEqual(verifyRequestState, undefined);
            assert.notStrictEqual(verifyResponseState, undefined);
            done();
        } catch (err) {
            done(err);
        }
    });

    //- If you make an api call without cookies(logged out) api throws session expired , then make sure that refresh token api is not getting called , get 401 as the output****
    it("test that an api call without cookies throws session expire, refresh api is not called and 401 is the output", async function(done) {
        try {
            jest.setTimeout(15000);
            await startST(5);
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
            assertEqual(loginResponse.data, userId);

            let logoutResponse = await axiosInstance.post(`${BASE_URL}/logout`, JSON.stringify({ userId }), {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                }
            });

            assertEqual(logoutResponse.data, "success");

            try {
                await axiosInstance.get(`${BASE_URL}/`);
                throw new Error("Should not have come here");
            } catch (error) {
                assertEqual(error.message, "Request failed with status code 401");
            }

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
            AuthHttpRequest.addAxiosInterceptors(axiosInstance);
            AuthHttpRequest.init({
                apiDomain: BASE_URL
            });
            let userId = "testing-supertokens-react-native";

            // send api request to login
            let loginResponse = await axiosInstance.post(`${BASE_URL}/login`, JSON.stringify({ userId }), {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                }
            });
            assertEqual(userId, loginResponse.data);

            let getSessionResponse = await axiosInstance({ url: `${BASE_URL}/`, method: "GET" });
            assertEqual(getSessionResponse.data, userId);

            //check that the number of times getSession was called is 1
            assertEqual(await getNumberOfTimesGetSessionCalled(), 1);

            //check that the number of times refresh session was called is 0
            assertEqual(await getNumberOfTimesRefreshCalled(), 0);

            done();
        } catch (err) {
            done(err);
        }
    });

    // TODO NEMI: Does this test actually have multiple interceptors?
    //- if multiple interceptors are there, they should all work*****
    it("test that if multiple interceptors are there, they should all work", async function(done) {
        try {
            jest.setTimeout(15000);
            await startST();
            addAxiosInterceptorsTest(axiosInstance);
            AuthHttpRequest.init({
                apiDomain: UTILS_BASE_URL
            });
            let userId = "testing-supertokens-react-native";
            let multipleInterceptorResponse = await axiosInstance.post(
                `${UTILS_BASE_URL}/multipleInterceptors`,
                JSON.stringify({ userId }),
                {
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json"
                    }
                }
            );
            assert.deepEqual(multipleInterceptorResponse.data, "success");
            assert.notDeepEqual(multipleInterceptorResponse.headers.doInterception3, undefined);
            assert.notDeepEqual(multipleInterceptorResponse.headers.doInterception4, undefined);
            done();
        } catch (err) {
            done(err);
        }
    });

    it("check sessionDoes exist calls refresh API just once", async function() {
        await startST();
        AuthHttpRequest.addAxiosInterceptors(axiosInstance);
        AuthHttpRequest.init({
            apiDomain: BASE_URL
        });

        let userId = "testing-supertokens-react-native";

        // call sessionDoesExist
        assertEqual(await AuthHttpRequest.doesSessionExist(), false);

        // check refresh API was called once + document.cookie has removed
        assertEqual(await getNumberOfTimesRefreshAttempted(), 1);
        assertEqual(await getNumberOfTimesRefreshCalled(), 0);
        assertEqual((await IdRefreshToken.getIdRefreshToken(false)).status, "NOT_EXISTS");

        // call sessionDoesExist
        assertEqual(await AuthHttpRequest.doesSessionExist(), false);
        // check refresh API not called
        assertEqual(await getNumberOfTimesRefreshAttempted(), 1);
        assertEqual(await getNumberOfTimesRefreshCalled(), 0);
        assertEqual((await IdRefreshToken.getIdRefreshToken(false)).status, "NOT_EXISTS");

        let loginResponse = await axiosInstance.post(`${BASE_URL}/login`, JSON.stringify({ userId }), {
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json"
            }
        });
        let userIdFromResponse = loginResponse.data;
        assertEqual(userId, userIdFromResponse);

        // call sessionDoesExist
        assertEqual(await AuthHttpRequest.doesSessionExist(), true);
        // check refresh API not called
        assertEqual(await getNumberOfTimesRefreshAttempted(), 1);
        assertEqual(await getNumberOfTimesRefreshCalled(), 0);
        assertEqual((await IdRefreshToken.getIdRefreshToken(false)).status, "EXISTS");
    });

    it("check clearing all frontend set cookies still works (without anti-csrf)", async function() {
        await startST(3, false);
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

        // call sessionDoesExist
        assertEqual(await AuthHttpRequest.doesSessionExist(), true);
        // check refresh API not called
        assertEqual(await getNumberOfTimesRefreshAttempted(), 1); // it's one here since it gets called during login..
        assertEqual(await getNumberOfTimesRefreshCalled(), 0);
        assertEqual((await IdRefreshToken.getIdRefreshToken(false)).status, "EXISTS");

        await IdRefreshToken.removeToken();
        await AntiCsrfToken.removeToken();
        await FrontToken.removeToken();

        // call sessionDoesExist (returns true) + call to refresh
        assertEqual(await AuthHttpRequest.doesSessionExist(), true);
        assertEqual(await getNumberOfTimesRefreshAttempted(), 2);
        assertEqual(await getNumberOfTimesRefreshCalled(), 1);

        // call sessionDoesExist (returns true) + no call to refresh
        assertEqual(await AuthHttpRequest.doesSessionExist(), true);
        assertEqual(await getNumberOfTimesRefreshAttempted(), 2);
        assertEqual(await getNumberOfTimesRefreshCalled(), 1);
    });

    it("check clearing all frontend set cookies logs our user (with anti-csrf)", async function() {
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

        // call sessionDoesExist
        assertEqual(await AuthHttpRequest.doesSessionExist(), true);
        // check refresh API not called
        assertEqual(await getNumberOfTimesRefreshAttempted(), 1); // it's one here since it gets called during login..
        assertEqual(await getNumberOfTimesRefreshCalled(), 0);
        assertEqual((await IdRefreshToken.getIdRefreshToken(false)).status, "EXISTS");

        // clear all cookies
        await IdRefreshToken.removeToken();
        await AntiCsrfToken.removeToken();
        await FrontToken.removeToken();

        // call sessionDoesExist (returns false) + call to refresh
        assertEqual(await AuthHttpRequest.doesSessionExist(), false);
        assertEqual(await getNumberOfTimesRefreshAttempted(), 2);
        assertEqual(await getNumberOfTimesRefreshCalled(), 0);

        // call sessionDoesExist (returns false) + no call to refresh
        assertEqual(await AuthHttpRequest.doesSessionExist(), false);
        assertEqual(await getNumberOfTimesRefreshAttempted(), 2);
        assertEqual(await getNumberOfTimesRefreshCalled(), 0);
    });
});

function addAxiosInterceptorsTest(axiosInstance) {
    // test request interceptor1
    axiosInstance.interceptors.request.use(testRequestInterceptor, async function(error) {
        throw error;
    });

    // Add a request interceptor
    axiosInstance.interceptors.request.use(interceptorFunctionRequestFulfilled, async function(error) {
        throw error;
    });

    // test request interceptor2
    axiosInstance.interceptors.request.use(testRequestInterceptor, async function(error) {
        throw error;
    });

    // test response interceptor3
    axiosInstance.interceptors.response.use(
        async function(response) {
            response = {
                ...response,
                headers: {
                    ...response.headers,
                    doInterception3: "value 3"
                }
            };
            return response;
        },
        async function(error) {
            throw error;
        }
    );

    // Add a response interceptor
    axiosInstance.interceptors.response.use(responseInterceptor(axiosInstance));
    // test response interceptor4
    axiosInstance.interceptors.response.use(
        async function(response) {
            response = {
                ...response,
                headers: {
                    ...response.headers,
                    doInterception4: "value 4"
                }
            };
            return response;
        },
        async function(error) {
            throw error;
        }
    );
}

async function testRequestInterceptor(config) {
    let testConfig = config;
    if (testConfig.headers["interceptorHeader1"] === undefined) {
        testConfig = {
            ...testConfig,
            headers: {
                ...testConfig.headers,
                interceptorHeader1: "value1"
            }
        };
    } else {
        testConfig = {
            ...testConfig,
            headers: {
                ...testConfig.headers,
                interceptorHeader2: "value2"
            }
        };
    }
    return testConfig;
}

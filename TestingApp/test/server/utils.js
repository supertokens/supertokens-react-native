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
let fetch = require("node-fetch");
const { randomUUID } = require("node:crypto");
const assert = require("assert");

module.exports.maxVersion = function(version1, version2) {
    let splittedv1 = version1.split(".");
    let splittedv2 = version2.split(".");
    let minLength = Math.min(splittedv1.length, splittedv2.length);
    for (let i = 0; i < minLength; i++) {
        let v1 = Number(splittedv1[i]);
        let v2 = Number(splittedv2[i]);
        if (v1 > v2) {
            return version1;
        } else if (v2 > v1) {
            return version2;
        }
    }
    if (splittedv1.length >= splittedv2.length) {
        return version1;
    }
    return version2;
};

module.exports.isProtectedPropName = function(name) {
    return [
        "sub",
        "iat",
        "exp",
        "sessionHandle",
        "parentRefreshTokenHash1",
        "refreshTokenHash1",
        "antiCsrfToken"
    ].includes(name);
};


module.exports.getCoreUrl = () => {
    const host = process.env?.SUPERTOKENS_CORE_HOST ?? "localhost";
    const port = process.env?.SUPERTOKENS_CORE_PORT ?? "3567";

    const coreUrl = `http://${host}:${port}`;

    return coreUrl;
};


module.exports.addLicense = async function () {
    const coreUrl = module.exports.getCoreUrl();

    const OPAQUE_KEY_WITH_ALL_FEATURES_ENABLED =
        "N2yITHflaFS4BPm7n0bnfFCjP4sJoTERmP0J=kXQ5YONtALeGnfOOe2rf2QZ0mfOh0aO3pBqfF-S0jb0ABpat6pySluTpJO6jieD6tzUOR1HrGjJO=50Ob3mHi21tQHJ";

    // TODO: This should be done on the core directly, not in apps
    await fetch(`${coreUrl}/ee/license`, {
        method: "PUT",
        headers: {
            "content-type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
            licenseKey: OPAQUE_KEY_WITH_ALL_FEATURES_ENABLED,
        }),
    });
};

module.exports.getCoreUrlFromConnectionURI = (connectionURI) => {
    let coreUrl = connectionURI;

    if (coreUrl.includes("appid-")) {
        coreUrl = connectionURI.split("appid-")[0];
    }

    if (coreUrl.endsWith("/")) {
        coreUrl = coreUrl.slice(0, -1);
    }

    return coreUrl;
};

module.exports.getAppIdFromConnectionURI = function (connectionURI) {
    return connectionURI.split("/").pop().split("-").pop();
};

module.exports.createCoreApplication = async function ({ appId, coreConfig } = {}) {
    const coreUrl = module.exports.getCoreUrl();

    if (!appId) {
        appId = randomUUID();
    }

    if (!coreConfig) {
        coreConfig = {};
    }

    const createAppResp = await fetch(`${coreUrl}/recipe/multitenancy/app/v2`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            appId,
            coreConfig,
        }),
    });

    const respBody = await createAppResp.json();
    assert.strictEqual(respBody.status, "OK");
    assert.strictEqual(respBody.createdNew, true);

    return `${coreUrl}/appid-${appId}`;
};

module.exports.removeCoreApplication = async function ({ connectionURI } = {}) {
    const coreUrl = module.exports.getCoreUrlFromConnectionURI(connectionURI);
    const appId = module.exports.getAppIdFromConnectionURI(connectionURI);

    const removeAppResp = await fetch(`${coreUrl}/recipe/multitenancy/app/remove`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            appId,
        }),
    });

    const respBody = await removeAppResp.json();
    assert.strictEqual(respBody.status, "OK");

    return true;
};
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

export const BASE_URL = "http://localhost.org:8080";
export const BASE_URL_FOR_ST =
    process.env.NODE_PORT === undefined ? "http://localhost.org:8080" : "http://localhost.org:" + process.env.NODE_PORT;

export function checkIfIdRefreshIsCleared() {
    const ID_COOKIE_NAME = "sIdRefreshToken";
    let value = "; " + document.cookie;
    let parts = value.split("; " + ID_COOKIE_NAME + "=");
    if (parts.length === 2) {
        let last = parts.pop();
        if (last !== undefined) {
            let properties = last.split(";");
            for (let i = 0; i < properties.length; i++) {
                let current = properties[i].replace("'", "");
                if (current.indexOf("Expires=") != -1) {
                    let expiryDateString = current.split("Expires=")[1];
                    let expiryDate = new Date(expiryDateString);
                    let currentDate = new Date();
                    return expiryDate < currentDate;
                }
            }
        }
    }
}

export async function getNumberOfTimesRefreshCalled() {
    let instance = axios.create();
    let response = await instance.get(BASE_URL + "/refreshCalledTime");
    return response.data;
}

export async function getNumberOfTimesRefreshAttempted(BASE = BASE_URL) {
    let instance = axios.create();
    let response = await instance.get(BASE + "/refreshAttemptedTime");
    return response.data;
}

export async function startST(
    accessTokenValidity = 1,
    enableAntiCsrf = true,
    accessTokenSigningKeyUpdateInterval = undefined
) {
    {
        if (BASE_URL !== BASE_URL_FOR_ST) {
            let instance = axios.create();
            await instance.post(BASE_URL + "/setAntiCsrf", {
                enableAntiCsrf
            });
        }
    }
    {
        let instance = axios.create();
        let response = await instance.post(BASE_URL_FOR_ST + "/startST", {
            accessTokenValidity,
            enableAntiCsrf,
            accessTokenSigningKeyUpdateInterval
        });
        return response.data;
    }
}

export async function getNumberOfTimesGetSessionCalled() {
    let instance = axios.create();
    let response = await instance.get(BASE_URL + "/getSessionCalledTime");
    return response.data;
}

export function coreTagEqualToOrAfter(targetTag) {
    const currTag = process.env.SUPERTOKENS_CORE_TAG;
    if (currTag === undefined || currTag === targetTag) return true;

    const lparts = currTag.replace(/^(dev-)?v/, "").split(".");
    while (lparts.length < 3) lparts.push("0");
    const rparts = targetTag.split(".");
    while (rparts.length < 3) rparts.push("0");

    for (let i = 0; i < 3; i++) {
        const l = parseInt(lparts[i], 10);
        const r = parseInt(rparts[i], 10);
        if (l !== r) {
            return l > r;
        }
    }
    return true;
}

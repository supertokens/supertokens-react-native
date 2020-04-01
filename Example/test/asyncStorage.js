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

export default class MockStorage {
    constructor(cache = {}) {
        this.storageCache = cache;
    }

    setItem = jest.fn((key, value) => {
        return new Promise((resolve, reject) => {
            return typeof key !== "string" || typeof value !== "string"
                ? reject(new Error("key and value must be string"))
                : resolve((this.storageCache[key] = value));
        });
    });

    getItem = jest.fn(key => {
        return new Promise(resolve => {
            return this.storageCache.hasOwnProperty(key) ? resolve(this.storageCache[key]) : resolve(null);
        });
    });

    removeItem = jest.fn(key => {
        return new Promise((resolve, reject) => {
            return this.storageCache.hasOwnProperty(key) ? resolve(delete this.storageCache[key]) : resolve(null);
        });
    });

    clear = jest.fn(key => {
        return new Promise((resolve, reject) => resolve((this.storageCache = {})));
    });

    getAllKeys = jest.fn(key => {
        return new Promise((resolve, reject) => resolve(Object.keys(this.storageCache)));
    });
}

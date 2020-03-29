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

// TODO: if native is linked, do not use in memory values - always make a call to native.
// This is because there is a chance that native side has changed the id refresh token, and here, we are still using the older one.
// Or is this OK?
export default class IdRefreshToken {
    private static idRefreshInMemory: string | undefined;

    static async getToken(): Promise<string | undefined> {
        if (IdRefreshToken.idRefreshInMemory === undefined) {
            IdRefreshToken.idRefreshInMemory = ""; // TODO: get from native IdRefreshToken.getUserDefaults().string(forKey: IdRefreshToken.idRefreshUserDefaultsKey)
        }
        if (IdRefreshToken.idRefreshInMemory !== undefined) {
            let splitted = IdRefreshToken.idRefreshInMemory.split(";");
            let expiry = Number(splitted[1]);
            let currentTime = Date.now();
            if (expiry < currentTime) {
                await IdRefreshToken.removeToken();
            }
        }
        return IdRefreshToken.idRefreshInMemory;
    }

    static async setToken(newIdRefreshToken: string) {
        if (newIdRefreshToken === "remove") {
            await IdRefreshToken.removeToken();
            return;
        }
        let splitted = newIdRefreshToken.split(";");
        let expiry = Number(splitted[1]);
        let currentTime = Date.now();
        if (expiry < currentTime) {
            await IdRefreshToken.removeToken();
        } else {
            // TODO: set in native side
            // userDefaults.set(newIdRefreshToken, forKey: IdRefreshToken.idRefreshUserDefaultsKey)
            // userDefaults.synchronize()
            IdRefreshToken.idRefreshInMemory = newIdRefreshToken;
        }
    }

    static async removeToken() {
        // TODO: set in native
        // userDefaults.removeObject(forKey: IdRefreshToken.idRefreshUserDefaultsKey)
        // userDefaults.synchronize()
        IdRefreshToken.idRefreshInMemory = undefined;
    }
}

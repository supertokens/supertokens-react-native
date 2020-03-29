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

// TODO: if native is linked, do not use in memory values - always make a call to native
// This is because there is a chance that native side has changed the anti-csrf token, and here, we are still using the older one.
// Or is this OK?
export default class AntiCSRF {
    private static antiCSRF: string | undefined;
    private static idRefreshToken: string | undefined;

    static async getToken(associatedIdRefreshToken: string | undefined): Promise<string | undefined> {
        if (associatedIdRefreshToken === undefined) {
            AntiCSRF.antiCSRF = undefined;
            AntiCSRF.idRefreshToken = undefined;
            return undefined;
        }

        if (AntiCSRF.antiCSRF === undefined || AntiCSRF.idRefreshToken === undefined) {
            let antiCSRFToken = ""; // TODO: read from storage in native.
            if (antiCSRFToken === undefined) {
                return undefined;
            }
            AntiCSRF.antiCSRF = antiCSRFToken;
            AntiCSRF.idRefreshToken = associatedIdRefreshToken;
        } else if (AntiCSRF.idRefreshToken !== undefined && AntiCSRF.idRefreshToken !== associatedIdRefreshToken) {
            AntiCSRF.idRefreshToken = undefined;
            AntiCSRF.antiCSRF = undefined;
            return AntiCSRF.getToken(associatedIdRefreshToken);
        }
        return AntiCSRF.antiCSRF;
    }

    static async setToken(antiCSRFToken: string, associatedIdRefreshToken: string | undefined = undefined) {
        if (associatedIdRefreshToken === undefined) {
            AntiCSRF.antiCSRF = undefined;
            AntiCSRF.idRefreshToken = undefined;
            return;
        }
        // TODO: set anti-csrf in native side.
        // userDefaults.set(antiCSRFToken, forKey: AntiCSRF.antiCSRFUserDefaultsKey)
        // userDefaults.synchronize()

        AntiCSRF.antiCSRF = antiCSRFToken;
        AntiCSRF.idRefreshToken = associatedIdRefreshToken;
    }

    static async removeToken() {
        // TODO: remove from native side.
        // userDefaults.removeObject(forKey: AntiCSRF.antiCSRFUserDefaultsKey)
        // userDefaults.synchronize()
        AntiCSRF.idRefreshToken = undefined;
        AntiCSRF.antiCSRF = undefined;
    }
}

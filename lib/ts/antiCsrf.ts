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

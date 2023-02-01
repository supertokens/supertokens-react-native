export default class AntiCSRF {
    private static tokenInfo;
    private constructor();
    private static getAntiCSRFToken;
    static getToken(associatedAccessTokenUpdate: string | undefined): Promise<string | undefined>;
    private static setAntiCSRF;
    static setItem(associatedAccessTokenUpdate: string | undefined, antiCsrf: string): Promise<void>;
    static removeToken(): Promise<void>;
}

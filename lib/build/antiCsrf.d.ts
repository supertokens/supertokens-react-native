export default class AntiCSRF {
    private static tokenInfo;
    private constructor();
    private static getAntiCSRFToken;
    static getToken(associatedIdRefreshToken: string | undefined): Promise<string | undefined>;
    private static setAntiCSRF;
    static setItem(associatedIdRefreshToken: string | undefined, antiCsrf: string): Promise<void>;
    static removeToken(): Promise<void>;
}

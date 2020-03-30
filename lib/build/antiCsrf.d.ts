export default class AntiCSRF {
    private static antiCSRF;
    private static idRefreshToken;
    static getToken(associatedIdRefreshToken: string | undefined): Promise<string | undefined>;
    static setToken(antiCSRFToken: string, associatedIdRefreshToken?: string | undefined): Promise<void>;
    static removeToken(): Promise<void>;
}

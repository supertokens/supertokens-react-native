export default class IdRefreshToken {
    private static idRefreshInMemory;
    static getToken(): Promise<string | undefined>;
    static setToken(newIdRefreshToken: string): Promise<void>;
    static removeToken(): Promise<void>;
}

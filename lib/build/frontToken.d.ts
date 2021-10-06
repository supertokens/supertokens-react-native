export default class FrontToken {
    private static waiters;
    private constructor();
    static getFrontToken(): Promise<string | null>;
    static getTokenInfo(): Promise<{
        uid: string;
        ate: number;
        up: any;
    } | undefined>;
    static setFrontToken(frontToken: string | undefined): Promise<void>;
    static removeToken(): Promise<void>;
    static setItem(frontToken: string): Promise<void>;
}

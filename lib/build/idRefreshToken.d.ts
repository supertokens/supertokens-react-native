import { IdRefreshTokenType } from "./types";
export default class IdRefreshToken {
    private static idRefreshInMemory;
    static getIdRefreshToken(tryRefresh: boolean): Promise<IdRefreshTokenType>;
    static setIdRefreshToken(newIdRefreshToken: string | "remove", statusCode: number): Promise<void>;
    static removeToken(): Promise<void>;
}

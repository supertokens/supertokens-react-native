import { InputType, NormalisedInputType } from "./types";
export declare function isAnIpAddress(ipaddress: string): boolean;
export declare function normaliseURLDomainOrThrowError(input: string): string;
export declare function normaliseURLPathOrThrowError(input: string): string;
export declare function normalisCookieDomainOrThrowError(cookieDomain: string): string;
export declare function validateAndNormaliseInputOrThrowError(options: InputType): NormalisedInputType;
export declare function shouldDoInterceptionBasedOnUrl(toCheckUrl: string, apiDomain: string, cookieDomain: string | undefined): boolean;
export declare function getURLDataFromString(urlString: string): {
    hostname: string;
    host: string;
    port: string;
    protocol: string;
    pathname: string;
};

import NormalisedURLDomain from "./normalisedURLDomain";
import NormalisedURLPath from "./normalisedURLPath";
import { InputType, NormalisedInputType, EventHandler, RecipeInterface } from "./types";

export function isAnIpAddress(ipaddress: string) {
    return /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
        ipaddress
    );
}

export function normaliseURLDomainOrThrowError(input: string): string {
    let str = new NormalisedURLDomain(input).getAsStringDangerous();
    return str;
}

export function normaliseURLPathOrThrowError(input: string): string {
    return new NormalisedURLPath(input).getAsStringDangerous();
}

export function normalisCookieDomainOrThrowError(cookieDomain: string): string {
    function helper(cookieDomain: string): string {
        cookieDomain = cookieDomain.trim().toLowerCase();

        // first we convert it to a URL so that we can use the URL class
        if (cookieDomain.startsWith(".")) {
            cookieDomain = cookieDomain.substr(1);
        }

        if (!cookieDomain.startsWith("http://") && !cookieDomain.startsWith("https://")) {
            cookieDomain = "http://" + cookieDomain;
        }

        try {
            let urlData: { hostname: string } = getURLDataFromString(cookieDomain);
            cookieDomain = urlData.hostname;

            // remove leading dot
            if (cookieDomain.startsWith(".")) {
                cookieDomain = cookieDomain.substr(1);
            }

            return cookieDomain;
        } catch (err) {
            throw new Error("Please provide a valid cookieDomain");
        }
    }

    function isAnIpAddress(ipaddress: string) {
        return /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
            ipaddress
        );
    }

    let noDotNormalised = helper(cookieDomain);

    if (noDotNormalised === "localhost" || isAnIpAddress(noDotNormalised)) {
        return noDotNormalised;
    }

    if (cookieDomain.startsWith(".")) {
        return "." + noDotNormalised;
    }

    return noDotNormalised;
}

export function validateAndNormaliseInputOrThrowError(options: InputType): NormalisedInputType {
    let apiDomain = normaliseURLDomainOrThrowError(options.apiDomain);

    let apiBasePath = normaliseURLPathOrThrowError("/auth");
    if (options.apiBasePath !== undefined) {
        apiBasePath = normaliseURLPathOrThrowError(options.apiBasePath);
    }

    let sessionExpiredStatusCode = 401;
    if (options.sessionExpiredStatusCode !== undefined) {
        sessionExpiredStatusCode = options.sessionExpiredStatusCode;
    }

    let autoAddCredentials = true;
    if (options.autoAddCredentials !== undefined) {
        autoAddCredentials = options.autoAddCredentials;
    }

    let cookieDomain: string | undefined = undefined;
    if (options.cookieDomain !== undefined) {
        cookieDomain = normalisCookieDomainOrThrowError(options.cookieDomain);
    }

    let preAPIHook = async (context: {
        action: "SIGN_OUT" | "REFRESH_SESSION";
        requestInit: RequestInit;
        url: string;
    }): Promise<{ url: string; requestInit: RequestInit }> => {
        return { url: context.url, requestInit: context.requestInit };
    };
    if (options.preAPIHook !== undefined) {
        preAPIHook = options.preAPIHook;
    }

    let onHandleEvent: EventHandler = () => {};
    if (options.onHandleEvent !== undefined) {
        onHandleEvent = options.onHandleEvent;
    }

    let override: {
        functions: (originalImplementation: RecipeInterface) => RecipeInterface;
    } = {
        functions: oI => oI,
        ...options.override
    };

    return {
        apiDomain,
        apiBasePath,
        sessionExpiredStatusCode,
        autoAddCredentials,
        cookieDomain,
        preAPIHook,
        onHandleEvent,
        override
    };
}

export function shouldDoInterceptionBasedOnUrl(
    toCheckUrl: string,
    apiDomain: string,
    cookieDomain: string | undefined
): boolean {
    function isNumeric(str: any) {
        if (typeof str != "string") return false; // we only process strings!
        return (
            !isNaN(str as any) && !isNaN(parseFloat(str)) // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
        ); // ...and ensure strings of whitespace fail
    }
    toCheckUrl = normaliseURLDomainOrThrowError(toCheckUrl);
    let urlInfo: { hostname: string; port: string } = getURLDataFromString(toCheckUrl);
    let domain = urlInfo.hostname;
    if (cookieDomain === undefined) {
        domain = urlInfo.port === "" ? domain : domain + ":" + urlInfo.port;
        apiDomain = normaliseURLDomainOrThrowError(apiDomain);
        let apiURLInfo: { port: string; hostname: string } = getURLDataFromString(apiDomain);
        return domain === (apiURLInfo.port === "" ? apiURLInfo.hostname : apiURLInfo.hostname + ":" + apiURLInfo.port);
    } else {
        let normalisedCookieDomain = normalisCookieDomainOrThrowError(cookieDomain);
        if (cookieDomain.split(":").length > 1) {
            // this means that a port may have been provided
            let portStr = cookieDomain.split(":")[cookieDomain.split(":").length - 1];
            if (isNumeric(portStr)) {
                normalisedCookieDomain += ":" + portStr;
                domain = urlInfo.port === "" ? domain : domain + ":" + urlInfo.port;
            }
        }
        if (cookieDomain.startsWith(".")) {
            return ("." + domain).endsWith(normalisedCookieDomain);
        } else {
            return domain === normalisedCookieDomain;
        }
    }
}

export function getURLDataFromString(
    urlString: string
): {
    hostname: string;
    host: string;
    port: string;
    protocol: string;
    pathname: string;
} {
    // We convert to a URL to see if the string is valid
    new URL(urlString);

    let split = urlString.split("//");
    let protocol = split[0];
    let hostAndPath = split[1];
    let host = hostAndPath.split("/")[0];

    // If the url has no path but has query params
    host = host.split("?")[0];

    let hostname = host;
    let port = "";
    // The domain includes a port
    if (host.includes(":")) {
        let splitHost = host.split(":");
        hostname = splitHost[0];
        port = splitHost[1];
    }

    let origin = protocol + "//" + host;
    let pathname = urlString.split(origin)[1];

    // If the url has a path and query params
    pathname = pathname.split("?")[0];

    if (pathname === "") {
        pathname = "/";
    }

    return {
        host,
        hostname,
        port,
        protocol,
        pathname
    };
}

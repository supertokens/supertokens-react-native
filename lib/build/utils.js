var __awaiter =
    (this && this.__awaiter) ||
    function(thisArg, _arguments, P, generator) {
        return new (P || (P = Promise))(function(resolve, reject) {
            function fulfilled(value) {
                try {
                    step(generator.next(value));
                } catch (e) {
                    reject(e);
                }
            }
            function rejected(value) {
                try {
                    step(generator["throw"](value));
                } catch (e) {
                    reject(e);
                }
            }
            function step(result) {
                result.done
                    ? resolve(result.value)
                    : new P(function(resolve) {
                          resolve(result.value);
                      }).then(fulfilled, rejected);
            }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    };
import NormalisedURLDomain from "./normalisedURLDomain";
import NormalisedURLPath from "./normalisedURLPath";
export function isAnIpAddress(ipaddress) {
    return /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
        ipaddress
    );
}
export function normaliseURLDomainOrThrowError(input) {
    let str = new NormalisedURLDomain(input).getAsStringDangerous();
    return str;
}
export function normaliseURLPathOrThrowError(input) {
    return new NormalisedURLPath(input).getAsStringDangerous();
}
export function normalisCookieDomainOrThrowError(cookieDomain) {
    function helper(cookieDomain) {
        cookieDomain = cookieDomain.trim().toLowerCase();
        // first we convert it to a URL so that we can use the URL class
        if (cookieDomain.startsWith(".")) {
            cookieDomain = cookieDomain.substr(1);
        }
        if (!cookieDomain.startsWith("http://") && !cookieDomain.startsWith("https://")) {
            cookieDomain = "http://" + cookieDomain;
        }
        try {
            let urlData = getURLDataFromString(cookieDomain);
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
    function isAnIpAddress(ipaddress) {
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
export function validateAndNormaliseInputOrThrowError(options) {
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
    let cookieDomain = undefined;
    if (options.cookieDomain !== undefined) {
        cookieDomain = normalisCookieDomainOrThrowError(options.cookieDomain);
    }
    let preAPIHook = context =>
        __awaiter(this, void 0, void 0, function*() {
            return { url: context.url, requestInit: context.requestInit };
        });
    if (options.preAPIHook !== undefined) {
        preAPIHook = options.preAPIHook;
    }
    let onHandleEvent = () => {};
    if (options.onHandleEvent !== undefined) {
        onHandleEvent = options.onHandleEvent;
    }
    let override = Object.assign({ functions: oI => oI }, options.override);
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
export function shouldDoInterceptionBasedOnUrl(toCheckUrl, apiDomain, cookieDomain) {
    function isNumeric(str) {
        if (typeof str != "string") return false; // we only process strings!
        return (
            !isNaN(str) && !isNaN(parseFloat(str)) // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
        ); // ...and ensure strings of whitespace fail
    }
    toCheckUrl = normaliseURLDomainOrThrowError(toCheckUrl);
    let urlInfo = getURLDataFromString(toCheckUrl);
    let domain = urlInfo.hostname;
    if (cookieDomain === undefined) {
        domain = urlInfo.port === "" ? domain : domain + ":" + urlInfo.port;
        apiDomain = normaliseURLDomainOrThrowError(apiDomain);
        let apiURLInfo = getURLDataFromString(apiDomain);
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
export function getURLDataFromString(urlString) {
    // We convert to a URL to see if the string is valid
    new URL(urlString);
    let split = urlString.split("//");
    let protocol = split[0];
    let hostAndPath = split[1];
    let host = hostAndPath.split("/")[0];
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

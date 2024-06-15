var __awaiter =
    (this && this.__awaiter) ||
    function(thisArg, _arguments, P, generator) {
        function adopt(value) {
            return value instanceof P
                ? value
                : new P(function(resolve) {
                      resolve(value);
                  });
        }
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
                result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
            }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    };
/**
 * From axios package
 * Update an Error with the specified config, error code, and response.
 *
 * @param {Error} error The error to update.
 * @param {Object} config The config.
 * @param {string} [code] The error code (for example, 'ECONNABORTED').
 * @param {Object} [request] The request.
 * @param {Object} [response] The response.
 * @returns {Error} The error.
 */
function enhanceAxiosError(error, config, code, request, response) {
    error.config = config;
    if (code) {
        error.code = code;
    }
    error.request = request;
    error.response = response;
    error.isAxiosError = true;
    error.toJSON = function toJSON() {
        return {
            // Standard
            message: this.message,
            name: this.name,
            // Microsoft
            description: this.description,
            number: this.number,
            // Mozilla
            fileName: this.fileName,
            lineNumber: this.lineNumber,
            columnNumber: this.columnNumber,
            stack: this.stack,
            // Axios
            config: this.config,
            code: this.code
        };
    };
    return error;
}
export function createAxiosErrorFromFetchResp(responseOrError) {
    return __awaiter(this, void 0, void 0, function*() {
        const config = {
            url: responseOrError.url,
            headers: responseOrError.headers
        };
        const isResponse = "status" in responseOrError;
        let axiosResponse;
        if (isResponse) {
            let data;
            const contentType = responseOrError.headers.get("content-type");
            if (!contentType || contentType.includes("application/json")) {
                try {
                    data = yield responseOrError.json();
                } catch (_a) {
                    data = yield responseOrError.text();
                }
            } else if (contentType.includes("text/")) {
                data = yield responseOrError.text();
            } else {
                data = yield responseOrError.blob();
            }
            axiosResponse = {
                data,
                status: responseOrError.status,
                statusText: responseOrError.statusText,
                headers: responseOrError.headers,
                config: config,
                request: undefined
            };
        }
        return enhanceAxiosError(
            "status" in responseOrError
                ? new Error("Request failed with status code " + responseOrError.status)
                : responseOrError,
            config,
            responseOrError.code,
            undefined,
            axiosResponse
        );
    });
}

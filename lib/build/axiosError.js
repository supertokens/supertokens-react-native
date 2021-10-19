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
export function createAxiosErrorFromFetchResp(response) {
    return __awaiter(this, void 0, void 0, function*() {
        const config = {
            url: response.url,
            headers: response.headers
        };
        const contentType = response.headers.get("content-type");
        let data;
        if (!contentType || contentType.includes("application/json")) {
            try {
                data = yield response.json();
            } catch (_a) {
                data = yield response.text();
            }
        } else if (contentType.includes("text/")) {
            data = yield response.text();
        } else {
            data = yield response.blob();
        }
        const axiosResponse = {
            data,
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            config: config,
            request: undefined
        };
        return enhanceAxiosError(
            new Error("Request failed with status code " + response.status),
            config,
            undefined,
            undefined,
            axiosResponse
        );
    });
}
export function createAxiosErrorFromAxiosResp(response) {
    return __awaiter(this, void 0, void 0, function*() {
        return enhanceAxiosError(
            new Error("Request failed with status code " + response.status),
            response.config,
            undefined,
            response.request,
            response
        );
    });
}

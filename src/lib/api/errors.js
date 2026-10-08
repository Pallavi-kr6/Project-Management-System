export class ApiError extends Error {
    status;
    code;
    details;
    headers;
    constructor(status, code, message, details, headers) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
        this.headers = headers;
        this.name = "ApiError";
    }
}
export const notFound = (code, message) => new ApiError(404, code, message);

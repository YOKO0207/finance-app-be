interface IError {
	status: number;
	message: string;
}

type ErrorMapping = {
	[key: string]: IError;
};

const errorCodeToStatus: ErrorMapping = {
	cancelled: { status: 499, message: "Client Closed Request" },
	unknown: { status: 500, message: "Internal Server Error" },
	"invalid-argument": { status: 400, message: "Bad Request" },
	"deadline-exceeded": { status: 504, message: "Gateway Timeout" },
	"not-found": { status: 404, message: "Not Found" },
	"already-exists": { status: 409, message: "Conflict" },
	"permission-denied": { status: 403, message: "Forbidden" }, 
	"resource-exhausted": { status: 429, message: "Too Many Requests" },
	"failed-precondition": { status: 412, message: "Precondition Failed" }, 
	aborted: { status: 409, message: "Conflict" }, 
	"out-of-range": { status: 400, message: "Bad Request" }, 
	unimplemented: { status: 501, message: "Not Implemented" },
	internal: { status: 500, message: "Internal Server Error" }, 
	unavailable: { status: 503, message: "Service Unavailable" }, 
	"data-loss": { status: 500, message: "Internal Server Error" }, 
	unauthenticated: { status: 401, message: "Unauthorized" }, 
};

export const handleFirebaseError = (error: any) => {
	const message = errorCodeToStatus[error.code]?.message || "An unexpected error occurred";
	const status = errorCodeToStatus[error.code]?.status || 500;

	return { message, status };
}
import * as admin from "firebase-admin";
import { FunctionParser } from "firebase-backend";
const key = require("../service-account-key.json");

// Initialize Firebase Admin SDK
admin.initializeApp({
	credential: admin.credential.cert(key),
});

exports = new FunctionParser({ rootPath: __dirname, exports }).exports;

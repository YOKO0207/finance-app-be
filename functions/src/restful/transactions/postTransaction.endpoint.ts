import { Request, Response } from "express";
import { Endpoint, RequestType } from "firebase-backend";
import * as admin from "firebase-admin";
import { handleFirebaseError } from "../../util";
import * as Joi from "joi";

interface TransactionRequestBody {
	amount: string;
	currency_type: number;
	transaction_type: number;
	transaction_desctiption: string;
}
interface TransactionSetBody extends TransactionRequestBody {
	uid: string;
}

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
	admin.initializeApp();
}

// Initialize Firestore
const db = admin.firestore();

// create schema for request body
const transactionCreateSchema = Joi.object({
	amount: Joi.number().required(),
	currency_type: Joi.number().required(),
	transaction_type: Joi.number().required(),
	transaction_desctiption: Joi.string(),
});

export default new Endpoint(
	"notes/:noteId/transactions",
	RequestType.POST,
	async (request: Request, response: Response) => {
		// check if token is included in the request header
		const token = request.headers.authorization?.split("Bearer ")[1];
		if (!token) {
			return response.status(401).send({ error: "No token provided" });
		}

		// check if noteId is included in the request params
		const noteId = request.params.noteId;
		if (!noteId) {
			return response.status(400).send({ error: "Note ID is required" });
		}

		// validata request body
		const validation = transactionCreateSchema.validate(request.body, {
			abortEarly: false,
		});
		if (validation.error) {
			return response.status(400).send({
				error: validation.error.details.map((detail) => detail.message),
			});
		}

		try {
			// get uid from token
			const decodedToken = await admin.auth().verifyIdToken(token);
			const uid = decodedToken.uid;

			// check if note exists
			const noteRef = db.collection("notes").doc(noteId);
			const noteSnapshot = await noteRef.get();
			if (!noteSnapshot.exists) {
				return response.status(404).send({
					error: "Note not found",
				});
			}
			// check if note belongs to the user
			const noteData = noteSnapshot.data();
			if (noteData?.uid !== uid) {
				return response
					.status(403)
					.send({ error: "You do not have permission to create on this note" });
			}

			// create transaction object with uid
			const transactionRequestBody: TransactionRequestBody = {
				amount: request.body["amount"],
				currency_type: request.body["currency_type"],
				transaction_type: request.body["transaction_type"],
				transaction_desctiption: request.body["transaction_desctiption"],
			};
			const transaction: TransactionSetBody = {...transactionRequestBody, uid};

			// create transaction
			const transactionRef = noteRef.collection("transactions").doc();
			await transactionRef.set(transaction);

			// return response
			return response.status(201).send({
				message: "Record created",
			});

		} catch (error) {
			console.log("Error", error);
			const { message, status } = handleFirebaseError(error);
			return response.status(status).send({
				error: message,
			});
		}
	}
);

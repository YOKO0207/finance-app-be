import { Request, Response } from "express";
import { Endpoint, RequestType } from "firebase-backend";
import * as admin from "firebase-admin";
import { handleFirebaseError } from "../../util";
import * as Joi from "joi";
import * as Firestore from "firebase-admin/firestore";
import axios from "axios";
import { OPEN_EXCHANGE_URL } from "../../constant";
import * as functions from "firebase-functions";

interface TransactionRequestBody {
	amount: number;
	currency_type: string;
	transaction_type: number;
	transaction_desctiption: string;
	updated_at: admin.firestore.FieldValue | Date;
}

const apiKey = functions.config().open_exchanging_rate.api_key;

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
	admin.initializeApp();
}

const db = admin.firestore();

const transactionUpdateSchema = Joi.object({
	amount: Joi.number(),
	currency_type: Joi.string(),
	transaction_type: Joi.number(),
	transaction_desctiption: Joi.string(),
});

export default new Endpoint(
	"notes/:noteId/transactions/:transactionId",
	RequestType.PATCH,
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

		// check if transactionId is included in the request params
		const transactionId = request.params.transactionId;
		if (!transactionId) {
			return response.status(400).send({ error: "Transaction ID is required" });
		}

		// validata body
		const validation = transactionUpdateSchema.validate(request.body, {
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
				return response.status(403).send({
					error: "You do not have permission to update this transaction",
				});
			}

			// check if the transaction exists
			const transactionRef = noteRef
				.collection("transactions")
				.doc(transactionId);
			const transactionSnapshot = await transactionRef.get();
			if (!transactionSnapshot.exists) {
				return response.status(404).send({
					error: "Transaction not found",
				});
			}
			// check if transaction belongs to the user
			const transactionData = transactionSnapshot.data();
			if (transactionData?.uid !== uid) {
				return response.status(403).send({
					error: "You do not have permission to update this transaction",
				});
			}

			// if currencty_type is changed, convert amount to dollars
			let amountInUSD = request.body.amount;
			if (
				request.body.currency_type !== transactionData?.currency_type ||
				request.body.amount !== transactionData?.amount
			) {
				const firestoreTimestamp = transactionData?.created_at; // Firestore Timestamp
				const dateObject = firestoreTimestamp.toDate();
				const formattedDate = dateObject.toISOString().split("T")[0]; // format to "YYYY-MM-DD"
				// Get exchange rates from Open Exchange Rates API
				const exchangeRatesResponse = await axios.get(
					`${OPEN_EXCHANGE_URL}/historical/${formattedDate}.json?app_id=${apiKey}`
				);
				const rates = exchangeRatesResponse.data.rates;

				// Convert amount to dollars
				const amountInOriginalCurrency = request.body.amount;
				const currencyType = request.body.currency_type;
				const exchangeRate = rates[currencyType];
				// Make sure this is a valid currency code
				if (!exchangeRate) {
					return response.status(400).send({ error: "Invalid currency type" });
				}
				amountInUSD = amountInOriginalCurrency / exchangeRate;
				request.body.amount = Number(amountInUSD.toFixed(2));
			}

			//create transaction object with uid
			const transactionRequestBody: TransactionRequestBody = {
				amount: Number(amountInUSD.toFixed(2)),
				currency_type: request.body.currency_type,
				transaction_type: request.body.transaction_type,
				transaction_desctiption: request.body.transaction_desctiption,
				updated_at: Firestore.FieldValue.serverTimestamp(),
			};

			// update the transaction
			await transactionRef.update({ ...transactionRequestBody });

			// return response
			return response.status(200).send({
				message: "Record updated",
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

import { Request, Response } from "express";
import { Endpoint, RequestType } from "firebase-backend";
import * as admin from "firebase-admin";
import { handleFirebaseError } from "../../util";
import * as Joi from "joi";
import { OPEN_EXCHANGE_URL } from "../../constant";
import axios from "axios";
import * as functions from "firebase-functions";
import * as Firestore from "firebase-admin/firestore";

const apiKey = functions.config().open_exchanging_rate.api_key;

interface TransactionBody {
	amount: number;
	currency_type: string;
	sign: number;
	transaction_desctiption: string;
	uid: string;
	exchange_rate: number;
	created_at: admin.firestore.FieldValue | Date;
	updated_at: admin.firestore.FieldValue | Date;
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
	currency_type: Joi.string().required(),
	sign: Joi.number().required(),
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

			// Get exchange rates from Open Exchange Rates API
			const exchangeRatesResponse = await axios.get(
				`${OPEN_EXCHANGE_URL}/latest.json?app_id=${apiKey}`
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
			const amountInUSD = amountInOriginalCurrency / exchangeRate;

			//create transaction object with uid
			const transactionBody: TransactionBody = {
				amount: Number(amountInUSD.toFixed(15)),
				currency_type: request.body.currency_type,
				sign: request.body.sign,
				transaction_desctiption: request.body.transaction_desctiption,
				uid,
				exchange_rate: exchangeRate,
				created_at: Firestore.FieldValue.serverTimestamp(),
				updated_at: Firestore.FieldValue.serverTimestamp(),
			};

			// create transaction
			const transactionRef = noteRef.collection("transactions").doc();
			await transactionRef.set(transactionBody);

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

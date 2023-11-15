import { Request, Response } from "express";
import { Endpoint, RequestType } from "firebase-backend";
import * as admin from "firebase-admin";
import { handleFirebaseError } from "../../util";
import { OPEN_EXCHANGE_URL } from "../../constant";
import axios from "axios";
import * as functions from "firebase-functions";

const apiKey = functions.config().open_exchanging_rate.api_key;

interface Notes {
	id: string;
	note_title: string;
	person_name: string;
	total: number;
	currency_type: number;
}
// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
	admin.initializeApp();
}

const db = admin.firestore();

export default new Endpoint(
	"notes",
	RequestType.GET,
	async (request: Request, response: Response) => {
		// check if token is included in the request header
		const token = request.headers.authorization?.split("Bearer ")[1];
		if (!token) {
			return response.status(401).send({ error: "No token provided" });
		}

		try {
			// get uid from token
			const decodedToken = await admin.auth().verifyIdToken(token);
			const uid = decodedToken.uid;

			// query notes
			const notesQuerySnapshot = await db
				.collection("notes")
				.where("uid", "==", uid)
				.get();

			const notesPromises = notesQuerySnapshot.docs.map(async (doc) => {
				const noteRef = db.collection("notes").doc(doc.id);
				const noteSnapshot = await noteRef.get();
				const noteData = noteSnapshot.data();
				const transactionsQuerySnapshot = await noteRef
					.collection("transactions")
					.get();

				let total = 0;
				if (transactionsQuerySnapshot) {
					const exchangeRatesMap = new Map(); // Cache exchange rates
					for (const doc of transactionsQuerySnapshot.docs) {
						if (typeof doc.data().amount === "number") {
							const firestoreTimestamp = doc.data()?.created_at; // Firestore Timestamp
							const dateObject = firestoreTimestamp.toDate();
							const formattedDate = dateObject.toISOString().split("T")[0]; // format to "YYYY-MM-DD"

							let rates;
							if (exchangeRatesMap.has(formattedDate)) {
								rates = exchangeRatesMap.get(formattedDate);
							} else {
								const exchangeRatesResponse = await axios.get(
									`${OPEN_EXCHANGE_URL}/historical/${formattedDate}.json?app_id=${apiKey}`
								);
								rates = exchangeRatesResponse.data.rates;
								exchangeRatesMap.set(formattedDate, rates);
							}

							const amountInDollars = doc.data()?.amount;
							const currencyType = noteData?.currency_type;
							let exchangeRate = rates[currencyType];

							if (!exchangeRate) {
								throw new Error("Invalid currency type");
							}

							let amountInCurrencyType = amountInDollars * exchangeRate;
							total += amountInCurrencyType;
						}
					}
					total = Math.round(total);
				}

				return {
					id: doc.id,
					note_title: doc.data().note_title,
					person_name: doc.data().person_name,
					currency_type: doc.data().currency_type,
					total: total || 0.0,
				};
			});

			const notes: Notes[] = await Promise.all(notesPromises);

			// return success response
			return response.status(201).send({
				message: "Record Retrieved",
				data: notes,
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

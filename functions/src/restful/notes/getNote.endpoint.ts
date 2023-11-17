import { Request, Response } from "express";
import { Endpoint, RequestType } from "firebase-backend";
import * as admin from "firebase-admin";
import { handleFirebaseError } from "../../util";
import { OPEN_EXCHANGE_URL } from "../../constant";
import axios from "axios";
import * as functions from "firebase-functions";
import { TRANSACTION_TYPES } from "../../constant/transactionType";

const apiKey = functions.config().open_exchanging_rate.api_key;

interface Note {
	id: string;
	note_title: string;
	person_name: string;
	total: number;
	currency_type: string;
}

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
	admin.initializeApp();
}

const db = admin.firestore();

export default new Endpoint(
	"notes/:noteId",
	RequestType.GET,
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

		try {
			// get uid from token
			const decodedToken = await admin.auth().verifyIdToken(token);
			const uid = decodedToken.uid;

			// check if the note exists
			const noteRef = db.collection("notes").doc(noteId);
			const noteSnapshot = await noteRef.get();
			if (!noteSnapshot.exists) {
				return response.status(404).send({ error: "Note not found" });
			}
			// check if the note belongs to the user
			const noteData = noteSnapshot.data();
			if (noteData?.uid !== uid) {
				return response
					.status(403)
					.send({ error: "You do not have permission to get this note" });
			}

			// query transactions and calculate total
			const transactionRef = noteRef.collection("transactions");
			const transactionsQuerySnapshot = await transactionRef.where("uid", "==", uid).get();
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
						if (doc.data().transaction_type === TRANSACTION_TYPES.PLUS)
							total += amountInCurrencyType;
						else if (doc.data().transaction_type === TRANSACTION_TYPES.MINUS)
							total -= amountInCurrencyType;
					}
				}
				total = Math.round(total);
			}

			// create note object
			const note: Note = {
				id: noteSnapshot.id,
				note_title: noteSnapshot.data()?.note_title,
				person_name: noteSnapshot.data()?.person_name,
				total: total,
				currency_type: noteSnapshot.data()?.currency_type,
			};

			// return success response
			return response.status(200).send({
				message: "Record Retrieved",
				data: note,
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

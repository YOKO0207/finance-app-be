import { Request, Response } from "express";
import { Endpoint, RequestType } from "firebase-backend";
import * as admin from "firebase-admin";
import { handleFirebaseError } from "../../util";
import { utcToZonedTime, format } from "date-fns-tz";
import ja from "date-fns/locale/ja";

interface Transactions {
	id: string;
	amount: number;
	currency_type: string;
	sign: number;
	transaction_desctiption: string;
	created_at: string;
}

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
	admin.initializeApp();
}

// Initialize Firestore
const db = admin.firestore();

export default new Endpoint(
	"notes/:noteId/transactions",
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
					.send({ error: "You do not have permission to get this note" });
			}

			// query transactions
			const transactionRef = noteRef.collection("transactions");
			const transactionsQuery = transactionRef.orderBy("created_at", "desc");
			const transactionsQuerySnapshot = await transactionsQuery.get();

			// create transactions array
			const transactions: Transactions[] = transactionsQuerySnapshot.docs.map(
				(doc) => {
					// get created_at and format it
					const firestoreTimestamp = doc.data()?.created_at; // Firestore Timestamp
					const dateObject = firestoreTimestamp.toDate();
					const timeZone = "Asia/Tokyo";
					const japanTime = utcToZonedTime(dateObject, timeZone);
					const formattedDate = format(japanTime, "yyyy年MM月dd日 HH時mm分", {
						locale: ja,
					});
					const amount = Math.round(
						doc.data().amount * doc.data().exchange_rate
					);

					return {
						id: doc.id,
						amount,
						currency_type: doc.data().currency_type,
						sign: doc.data().sign,
						transaction_desctiption: doc.data().transaction_desctiption,
						created_at: formattedDate,
					};
				}
			);

			// return response
			return response.status(201).send({
				message: "Records Retrieved",
				data: transactions,
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

import { Request, Response } from "express";
import { Endpoint, RequestType } from "firebase-backend";
import * as admin from "firebase-admin";
import { handleFirebaseError } from "../../util";
import { FirebaseError } from "firebase/app";

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
	admin.initializeApp();
}

const db = admin.firestore();

export default new Endpoint(
	"notes/:noteId/transactions/:transactionId",
	RequestType.DELETE,
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
					.send({
						error: "You do not have permission to delete this transaction",
					});
			}

			// check if the transanction exists
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
				return response
					.status(403)
					.send({
						error: "You do not have permission to delete this transaction",
					});
			}

			// delete the transaction
			await transactionRef.delete();

			// return response
			return response.status(200).send({
				message: "Record Deleted",
			});
		} catch (error) {
			console.log("Error", error);
			if (error instanceof FirebaseError) {
				const { message, status } = handleFirebaseError(error);
				return response.status(status).send({
					error: message,
				});
			} else {
				return response.status(500).send({
					error: "Internal Server Error",
				});
			}
		}
	}
);

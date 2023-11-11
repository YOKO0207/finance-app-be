import { Request, Response } from "express";
import { Endpoint, RequestType } from "firebase-backend";
import * as admin from "firebase-admin";
import { handleFirebaseError } from "../../util";

interface Notes {
	id: string;
	note_title: string;
	person_name: string;
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

			// create notes array
			const notes: Notes[] = notesQuerySnapshot.docs.map((doc) => ({
				id: doc.id,
				note_title: doc.data().note_title,
				person_name: doc.data().person_name,
			}));

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

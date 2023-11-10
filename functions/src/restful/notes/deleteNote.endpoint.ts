import { Request, Response } from "express";
import { Endpoint, RequestType } from "firebase-backend";
import * as admin from "firebase-admin";
import { handleFirebaseError } from "../../util";

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
	admin.initializeApp();
}

const db = admin.firestore();

export default new Endpoint(
	"note/:id",
	RequestType.DELETE,
	async (request: Request, response: Response) => {
		// check if token is included in the request header
		const token = request.headers.authorization?.split("Bearer ")[1];
		if (!token) {
			return response.status(401).send({ error: "No token provided" });
		}

		try {
			// verify token
			const decodedToken = await admin.auth().verifyIdToken(token);
			const uid = decodedToken.uid;

			// check if the note exists and belongs to the user
			const noteId = request.params.id;
			const noteRef = db.collection("notes").doc(noteId);
			const noteSnapshot = await noteRef.get();

			if (!noteSnapshot.exists) {
				return response.status(404).send({ error: "Note not found" });
			}
			const noteData = noteSnapshot.data();
			if (noteData?.uid !== uid) {
				return response
					.status(403)
					.send({ error: "You do not have permission to delete this note" });
			}

			// update the note
			await noteRef.delete();

			return response.status(200).send({
				message: "Record Deleted",
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
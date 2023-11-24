import { Request, Response } from "express";
import { Endpoint, RequestType } from "firebase-backend";
import * as admin from "firebase-admin";
import { handleFirebaseError } from "../../util";
import * as Joi from "joi";
import * as Firestore from "firebase-admin/firestore";
import { FirebaseError } from "firebase/app";

interface NoteBody {
	note_title: string;
	person_name: string;
	currency_type: string;
	updated_at: admin.firestore.FieldValue | Date;
}

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
	admin.initializeApp();
}

const db = admin.firestore();

const noteUpdateSchema = Joi.object({
	note_title: Joi.string(),
	person_name: Joi.string(),
	currency_type: Joi.string(),
});

export default new Endpoint(
	"notes/:noteId",
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

		// validata body
		const validation = noteUpdateSchema.validate(request.body, {
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
					.send({ error: "You do not have permission to update this note" });
			}

			// create note object with uid
			const noteBody: NoteBody = {
				note_title: request.body.note_title,
				person_name: request.body.person_name,
				currency_type: request.body.currency_type,
				updated_at: Firestore.FieldValue.serverTimestamp(),
			};

			// update the note
			await noteRef.update({ ...noteBody });

			// return response
			return response.status(200).send({
				message: "Record updated",
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

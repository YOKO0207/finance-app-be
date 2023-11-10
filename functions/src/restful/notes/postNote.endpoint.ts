import { Request, Response } from "express";
import { Endpoint, RequestType } from "firebase-backend";
import * as admin from "firebase-admin";
import { handleFirebaseError } from "../../util";
import * as Joi from "joi";

interface NoteRequestBody {
	note_title: string;
	person_name: string;
}
interface NoteSetBody {
	note_title: string;
	person_name: string;
	uid: string;
}

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
	admin.initializeApp();
}

const db = admin.firestore();

const noteCreateSchema = Joi.object({
	note_title: Joi.string().required(),
	person_name: Joi.string().required(),
});

export default new Endpoint(
	"notes",
	RequestType.POST,
	async (request: Request, response: Response) => {
		// check if token is included in the request header
		const token = request.headers.authorization?.split("Bearer ")[1];
		if (!token) {
			return response.status(401).send({ error: "No token provided" });
		}

		// validata body
		const validation = noteCreateSchema.validate(request.body, {
			abortEarly: false,
		});
		if (validation.error) {
			return response.status(400).send({
				error: validation.error.details.map((detail) => detail.message),
			});
		}

		try {
			const noteRequestBody: NoteRequestBody = {
				note_title: request.body["note_title"],
				person_name: request.body["person_name"],
			};

			const decodedToken = await admin.auth().verifyIdToken(token);
			const uid = decodedToken.uid;

			const note: NoteSetBody = { ...noteRequestBody, uid };

			const noteRef = db.collection("notes").doc();
			await noteRef.set(note);

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

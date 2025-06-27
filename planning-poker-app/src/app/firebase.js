// For Firebase JS SDK v7.20.0 and later, measurementId is optional
import { initializeApp } from "@angular/fire/app";
import { getDatabase } from "@angular/fire/database";
import { environment } from '../environments/environment';

const firebaseConfig = environment.firebase;

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export { app, database };

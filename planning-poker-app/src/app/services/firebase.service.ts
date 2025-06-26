import { Injectable } from '@angular/core';
import { Database, get, onDisconnect, onValue, ref, remove, set, update } from '@angular/fire/database';
import { BehaviorSubject, Observable } from 'rxjs';
import { Participant } from '../models/participant.model';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  constructor(private db: Database) { }

  joinRoom(roomId: string, userId: string, username: string): Promise<boolean> {
    const MAX_ROOM_PARTICIPANTS = 10; // Maximum number of participants allowed in a room
    // First check if the room exists, if not create it
    const roomRef = ref(this.db, `rooms/${roomId}`);

    return get(roomRef).then((snapshot) => {
      // Create room if it doesn't exist
      if (!snapshot.exists()) {
        set(roomRef, {
          revealed: false,
          createdAt: new Date().toISOString()
        });
      }

      // Check for existing participant with this userId
      const participantRef = ref(this.db, `rooms/${roomId}/participants/${userId}`);
      return get(participantRef).then((participantSnapshot) => {
        // If this participant already exists, just update their name
        if (participantSnapshot.exists()) {
          update(participantRef, { name: username });
          return true; // Success
        }

        // Check if room is full (max 10 participants)
        const participantsRef = ref(this.db, `rooms/${roomId}/participants`);
        return get(participantsRef).then((participantsSnapshot) => {
          const participantCount = participantsSnapshot.exists() ?
            Object.keys(participantsSnapshot.val()).length : 0;

          if (participantCount >= MAX_ROOM_PARTICIPANTS) {
            console.warn('Room is full, cannot join:', roomId);
            return false; // Room is full
          }

          // Add the participant
          set(participantRef, {
            id: userId,
            name: username,
            selectedCard: null,
            isRevealed: false
          });
          return true; // Success
        });
      });
    });
  }

  getParticipants(roomId: string): Observable<Participant[]> {
    const participantsSubject = new BehaviorSubject<Participant[]>([]);
    const participantsRef = ref(this.db, `rooms/${roomId}/participants`);

    onValue(participantsRef, (snapshot) => {
      const participants: Participant[] = [];
      snapshot.forEach((childSnapshot) => {
        const participant = childSnapshot.val() as Participant;
        participants.push(participant);
        return false; // Don't cancel enumeration
      });
      participantsSubject.next(participants);
    });

    return participantsSubject.asObservable();
  }

  selectCard(roomId: string, userId: string, card: string | undefined): void {
    const participantRef = ref(this.db, `rooms/${roomId}/participants/${userId}`);
    update(participantRef, {
      selectedCard: card
    });
  }

  setRevealState(roomId: string, revealed: boolean): void {
    const roomRef = ref(this.db, `rooms/${roomId}`);
    update(roomRef, { revealed });

    const participantsRef = ref(this.db, `rooms/${roomId}/participants`);
    get(participantsRef).then((snapshot) => {
      snapshot.forEach((childSnapshot) => {
        const participantKey = childSnapshot.key;
        if (participantKey) {
          const participantRef = ref(this.db, `rooms/${roomId}/participants/${participantKey}`);
          update(participantRef, {
            isRevealed: revealed
          });
        }
        return false; // Don't cancel enumeration
      });
    });
  }

  resetCards(roomId: string): void {
    const roomRef = ref(this.db, `rooms/${roomId}`);
    update(roomRef, { revealed: false });

    const participantsRef = ref(this.db, `rooms/${roomId}/participants`);
    get(participantsRef).then((snapshot) => {
      snapshot.forEach((childSnapshot) => {
        const participantKey = childSnapshot.key;
        if (participantKey) {
          const participantRef = ref(this.db, `rooms/${roomId}/participants/${participantKey}`);
          update(participantRef, {
            selectedCard: null,
            isRevealed: false
          });
        }
        return false; // Don't cancel enumeration
      });
    });
  }

  updateUserName(roomId: string, userId: string, username: string): Promise<boolean> {
    const participantRef = ref(this.db, `rooms/${roomId}/participants/${userId}`);
    return update(participantRef, {
      name: username
    }).then(() => true)
      .catch(error => {
        console.error('Error updating username:', error);
        return false;
      });
  }

  setupPresence(roomId: string, userId: string): void {
    const presenceRef = ref(this.db, `rooms/${roomId}/presence/${userId}`);
    const connectedRef = ref(this.db, '.info/connected');

    onValue(connectedRef, (snapshot) => {
      if (snapshot.val() === true) {
        set(presenceRef, true);
        onDisconnect(presenceRef).remove();
      }
    });
  }

  cleanupRoom(roomId: string): void {
    const presenceRef = ref(this.db, `rooms/${roomId}/presence`);

    onValue(presenceRef, (snapshot) => {
      if (!snapshot.exists() || Object.keys(snapshot.val() || {}).length === 0) {
        setTimeout(() => {
          const roomRef = ref(this.db, `rooms/${roomId}`);
          remove(roomRef);
        }, 900000); // 15 minutes
      }
    });
  }

  testFirebaseConnection(): void {
    console.log('Testing Firebase connection...');
    const testRef = ref(this.db, 'test');
    set(testRef, {
      timestamp: new Date().toISOString(),
      message: 'Testing connection'
    });
  }
}

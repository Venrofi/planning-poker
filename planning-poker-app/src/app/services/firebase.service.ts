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
          createdAt: new Date().toISOString(),
          title: 'Sprint Planning Poker'
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

  startCountdown(roomId: string, userId: string): Promise<boolean> {
    const roomRef = ref(this.db, `rooms/${roomId}`);
    return update(roomRef, {
      isCountdownActive: true,
      countdownStartedAt: new Date().toISOString(),
      countdownStartedBy: userId
    }).then(() => true)
      .catch(error => {
        console.error('Error starting countdown:', error);
        return false;
      });
  }

  getCountdownState(roomId: string): Observable<{ isActive: boolean, startedAt: string | null, startedBy: string | null }> {
    const countdownSubject = new BehaviorSubject<{ isActive: boolean, startedAt: string | null, startedBy: string | null }>({
      isActive: false,
      startedAt: null,
      startedBy: null
    });

    const roomRef = ref(this.db, `rooms/${roomId}`);
    onValue(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const roomData = snapshot.val();
        countdownSubject.next({
          isActive: roomData.isCountdownActive || false,
          startedAt: roomData.countdownStartedAt || null,
          startedBy: roomData.countdownStartedBy || null
        });
      }
    });

    return countdownSubject.asObservable();
  }

  endCountdown(roomId: string): Promise<boolean> {
    const roomRef = ref(this.db, `rooms/${roomId}`);
    return update(roomRef, {
      isCountdownActive: false,
      countdownStartedAt: null,
      countdownStartedBy: null
    }).then(() => true)
      .catch(error => {
        console.error('Error ending countdown:', error);
        return false;
      });
  }

  initiateReset(roomId: string, userId: string): Promise<boolean> {
    const roomRef = ref(this.db, `rooms/${roomId}`);
    return update(roomRef, {
      isResetActive: true,
      resetInitiatedAt: new Date().toISOString(),
      resetInitiatedBy: userId
    }).then(() => {
      this.resetCards(roomId);
      return true;
    }).catch(error => {
      console.error('Error initiating reset:', error);
      return false;
    });
  }

  getResetState(roomId: string): Observable<{ isActive: boolean, initiatedAt: string | null, initiatedBy: string | null }> {
    const resetSubject = new BehaviorSubject<{ isActive: boolean, initiatedAt: string | null, initiatedBy: string | null }>({
      isActive: false,
      initiatedAt: null,
      initiatedBy: null
    });

    const roomRef = ref(this.db, `rooms/${roomId}`);
    onValue(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const roomData = snapshot.val();
        resetSubject.next({
          isActive: roomData.isResetActive || false,
          initiatedAt: roomData.resetInitiatedAt || null,
          initiatedBy: roomData.resetInitiatedBy || null
        });
      }
    });

    return resetSubject.asObservable();
  }

  clearResetState(roomId: string): Promise<boolean> {
    const roomRef = ref(this.db, `rooms/${roomId}`);
    return update(roomRef, {
      isResetActive: false,
      resetInitiatedAt: null,
      resetInitiatedBy: null
    }).then(() => true)
      .catch(error => {
        console.error('Error clearing reset state:', error);
        return false;
      });
  }

  setRoomTitle(roomId: string, title: string): Promise<boolean> {
    const roomRef = ref(this.db, `rooms/${roomId}`);
    return update(roomRef, {
      title: title
    }).then(() => true)
      .catch(error => {
        console.error('Error updating room title:', error);
        return false;
      });
  }

  getRoomTitle(roomId: string): Observable<string> {
    const titleSubject = new BehaviorSubject<string>('Sprint Planning Poker');
    const roomRef = ref(this.db, `rooms/${roomId}`);

    onValue(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const roomData = snapshot.val();
        if (roomData.title) {
          titleSubject.next(roomData.title);
        }
      }
    });

    return titleSubject.asObservable();
  }
}

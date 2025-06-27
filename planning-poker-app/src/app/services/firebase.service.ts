import { Injectable } from '@angular/core';
import { Database, get, onDisconnect, onValue, ref, remove, set, update } from '@angular/fire/database';
import { BehaviorSubject, Observable } from 'rxjs';
import { Participant } from '../models/participant.model';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  constructor(private db: Database) { }

  /**
   * Validates if a room ID is properly formatted (UUID format)
   * This prevents users from creating rooms with arbitrary names
   */
  isValidRoomId(roomId: string): boolean {
    // UUID regex pattern (version 4)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidPattern.test(roomId);
  }

  joinRoom(roomId: string, userId: string, username: string): Promise<boolean> {
    const MAX_ROOM_PARTICIPANTS = 10; // Maximum number of participants allowed in a room

    // Check if the room ID is valid (UUID format)
    if (!this.isValidRoomId(roomId)) {
      console.warn('Invalid room ID format:', roomId);
      return Promise.resolve(false);
    }

    // First check and clean up any stale rooms in the database
    this.checkStaleRooms();

    // Then check if the room exists, if not create it
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

          // First participant becomes admin
          const isAdmin = participantCount === 0;

          // Add the participant
          set(participantRef, {
            id: userId,
            name: username,
            selectedCard: null,
            isRevealed: false,
            isAdmin: isAdmin
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
    const participantRef = ref(this.db, `rooms/${roomId}/participants/${userId}`);
    const roomRef = ref(this.db, `rooms/${roomId}`);
    const connectedRef = ref(this.db, '.info/connected');

    onValue(connectedRef, (snapshot) => {
      if (snapshot.val() === true) {
        // When the client connects, set their presence
        set(presenceRef, true);

        // First, set up an onDisconnect to remove this user's presence and participant data
        onDisconnect(presenceRef).remove();
        onDisconnect(participantRef).remove();

        // Second, set up a special transaction that will run server-side when the client disconnects
        // This will check if this was the last participant and delete the room if needed
        const participantsRef = ref(this.db, `rooms/${roomId}/participants`);
        const presenceListRef = ref(this.db, `rooms/${roomId}/presence`);

        // Create a server value that will be evaluated when the disconnect happens
        onDisconnect(participantRef).set(null).then(() => {
          console.log('Set up participant cleanup on disconnect');

          // We need to manually check for the last participant
          // This runs a server-side check when the client disconnects
          const checkLastParticipantRef = ref(this.db, `rooms/${roomId}/lastParticipantCheck/${userId}`);

          // This node is created when disconnect happens and then immediately cleaned up
          onDisconnect(checkLastParticipantRef).set(new Date().toISOString())
            .then(() => {
              // Set up a listener that will check when this node appears
              onValue(checkLastParticipantRef, (checkSnapshot) => {
                if (checkSnapshot.exists()) {
                  console.log(`Last participant check triggered for ${userId}`);

                  // Check if there are any participants left
                  get(participantsRef).then(participantsSnapshot => {
                    if (!participantsSnapshot.exists() ||
                      Object.keys(participantsSnapshot.val() || {}).length === 0) {
                      // No participants left, delete the room immediately
                      console.log(`Room ${roomId} is now empty after disconnect, deleting immediately`);
                      remove(roomRef);
                    }

                    // Remove the check node regardless
                    remove(checkLastParticipantRef);
                  });
                }
              });
            });
        });
      }
    });
  }

  cleanupRoom(roomId: string): void {
    const presenceRef = ref(this.db, `rooms/${roomId}/presence`);
    const roomRef = ref(this.db, `rooms/${roomId}`);
    const participantsRef = ref(this.db, `rooms/${roomId}/participants`);

    // Check for empty rooms based on presence
    onValue(presenceRef, (snapshot) => {
      if (!snapshot.exists() || Object.keys(snapshot.val() || {}).length === 0) {
        // Room is empty by presence, check participants too
        get(participantsRef).then(participantsSnapshot => {
          if (!participantsSnapshot.exists() || Object.keys(participantsSnapshot.val() || {}).length === 0) {
            // Room is truly empty, delete it immediately
            console.log(`Room ${roomId} is empty, deleting it immediately`);
            remove(roomRef);
          }
        });
      }
    });

    // Also listen to participants directly in case presence isn't updated
    onValue(participantsRef, (snapshot) => {
      if (!snapshot.exists() || Object.keys(snapshot.val() || {}).length === 0) {
        // No participants, check presence too to be sure
        get(presenceRef).then(presenceSnapshot => {
          if (!presenceSnapshot.exists() || Object.keys(presenceSnapshot.val() || {}).length === 0) {
            // Room is truly empty, delete it immediately
            console.log(`Room ${roomId} is empty (from participants check), deleting it immediately`);
            remove(roomRef);
          }
        });
      }
    });
  }

  private checkStaleRooms(): void {
    // Get all rooms
    const roomsRef = ref(this.db, 'rooms');

    get(roomsRef).then((snapshot) => {
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const roomId = childSnapshot.key;
          if (!roomId) return false;

          // For each room, check if it has any participants
          const participantsRef = ref(this.db, `rooms/${roomId}/participants`);
          const presenceRef = ref(this.db, `rooms/${roomId}/presence`);

          // Get both participants and presence
          Promise.all([
            get(participantsRef),
            get(presenceRef)
          ]).then(([participantsSnapshot, presenceSnapshot]) => {
            const hasParticipants = participantsSnapshot.exists() &&
              Object.keys(participantsSnapshot.val() || {}).length > 0;

            const hasPresence = presenceSnapshot.exists() &&
              Object.keys(presenceSnapshot.val() || {}).length > 0;

            // If room has no participants and no presence, delete it
            if (!hasParticipants && !hasPresence) {
              const roomRef = ref(this.db, `rooms/${roomId}`);
              remove(roomRef);
              console.log(`Removed empty room during cleanup: ${roomId}`);
            }

            // Clean up old format flags if they exist
            const roomData = childSnapshot.val();
            if ((roomData.deletion_scheduled || roomData.emptyAt || roomData.lastActive) &&
              (hasParticipants || hasPresence)) {
              // Room has participants but has deletion flags, clear them
              const roomRef = ref(this.db, `rooms/${roomId}`);
              update(roomRef, {
                deletion_scheduled: null,
                emptyAt: null,
                lastActive: null
              });
            }
          });

          return false; // Don't cancel enumeration
        });
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

  removeParticipant(roomId: string, userId: string): Promise<boolean> {
    const participantRef = ref(this.db, `rooms/${roomId}/participants/${userId}`);
    const presenceRef = ref(this.db, `rooms/${roomId}/presence/${userId}`);
    const roomRef = ref(this.db, `rooms/${roomId}`);

    return Promise.all([
      remove(participantRef),
      remove(presenceRef)
    ])
      .then(() => {
        console.log(`Participant ${userId} removed from room ${roomId}`);

        // Check if this was the last participant
        return Promise.all([
          get(ref(this.db, `rooms/${roomId}/participants`)),
          get(ref(this.db, `rooms/${roomId}/presence`))
        ]);
      })
      .then(([participantsSnapshot, presenceSnapshot]) => {
        const hasParticipants = participantsSnapshot.exists() &&
          Object.keys(participantsSnapshot.val() || {}).length > 0;

        const hasPresence = presenceSnapshot.exists() &&
          Object.keys(presenceSnapshot.val() || {}).length > 0;

        if (!hasParticipants && !hasPresence) {
          // No participants and no presence left, delete the room immediately
          console.log(`Room ${roomId} is now empty, deleting immediately`);
          return remove(roomRef);
        }
        return Promise.resolve();
      })
      .then(() => true)
      .catch(error => {
        console.error('Error removing participant:', error);
        return false;
      });
  }

  getRoomRevealedState(roomId: string): Observable<boolean> {
    const roomRevealedSubject = new BehaviorSubject<boolean>(false);
    const roomRef = ref(this.db, `rooms/${roomId}/revealed`);

    onValue(roomRef, (snapshot) => {
      const revealed = snapshot.val() || false;
      roomRevealedSubject.next(revealed);
    });

    return roomRevealedSubject.asObservable();
  }
}

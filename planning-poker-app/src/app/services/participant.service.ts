import { inject, Injectable } from '@angular/core';
import { Database, get, onDisconnect, onValue, ref, remove, set, update } from '@angular/fire/database';
import { BehaviorSubject, Observable } from 'rxjs';
import { Participant } from '../models/participant.model';

@Injectable({
  providedIn: 'root'
})
export class ParticipantService {
  private db = inject(Database);

  joinRoom(roomId: string, userId: string, username: string): Promise<boolean> {
    const MAX_ROOM_PARTICIPANTS = 10; // Maximum number of participants allowed in a room

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

  async transferAdminRole(roomId: string, newAdminId: string): Promise<boolean> {
    try {
      const participantsRef = ref(this.db, `rooms/${roomId}/participants`);
      const snapshot = await get(participantsRef);

      if (!snapshot.exists()) {
        return false;
      }

      const participants = snapshot.val();
      const updates: Record<string, boolean> = {};

      // Remove admin role from all participants
      Object.keys(participants).forEach(participantId => {
        updates[`${participantId}/isAdmin`] = false;
      });

      // Set new admin
      if (participants[newAdminId]) {
        updates[`${newAdminId}/isAdmin`] = true;
      }

      await update(participantsRef, updates);
      console.log(`Admin role transferred to participant: ${newAdminId}`);
      return true;
    } catch (error) {
      console.error('Error transferring admin role:', error);
      return false;
    }
  }

  async findNextAdmin(roomId: string, excludeUserId: string): Promise<string | null> {
    try {
      const participantsRef = ref(this.db, `rooms/${roomId}/participants`);
      const snapshot = await get(participantsRef);

      if (!snapshot.exists()) {
        return null;
      }

      const participants = snapshot.val();

      // Find the first participant that is not the one leaving
      for (const participantId of Object.keys(participants)) {
        if (participantId !== excludeUserId) {
          return participantId;
        }
      }

      return null;
    } catch (error) {
      console.error('Error finding next admin:', error);
      return null;
    }
  }
}

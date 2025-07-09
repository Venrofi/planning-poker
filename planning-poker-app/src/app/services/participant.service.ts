import { inject, Injectable } from '@angular/core';
import { Database, get, onDisconnect, onValue, ref, remove, set, update, DatabaseReference } from '@angular/fire/database';
import { BehaviorSubject, Observable } from 'rxjs';
import { Participant } from '../models/participant.model';

@Injectable({
  providedIn: 'root'
})
export class ParticipantService {
  private db = inject(Database);

  joinRoom(roomId: string, userId: string, username: string): Promise<boolean> {
    const MAX_ROOM_PARTICIPANTS = 10;

    const participantRef = ref(this.db, `rooms/${roomId}/participants/${userId}`);
    return get(participantRef).then((participantSnapshot) => {
      if (participantSnapshot.exists()) {
        update(participantRef, { name: username });
        return true;
      }

      const participantsRef = ref(this.db, `rooms/${roomId}/participants`);
      return get(participantsRef).then((participantsSnapshot) => {
        const participantCount = participantsSnapshot.exists() ?
          Object.keys(participantsSnapshot.val()).length : 0;

        if (participantCount >= MAX_ROOM_PARTICIPANTS) {
          return false;
        }

        const isAdmin = participantCount === 0;

        set(participantRef, {
          id: userId,
          name: username,
          selectedCard: null,
          isRevealed: false,
          isAdmin: isAdmin
        });
        return true;
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
        return false;
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
        set(presenceRef, true);
        this.setupDisconnectHandlers(roomId, userId, presenceRef, participantRef, roomRef);
      }
    });
  }

  private setupDisconnectHandlers(roomId: string, userId: string, presenceRef: DatabaseReference, participantRef: DatabaseReference, roomRef: DatabaseReference): void {
    onDisconnect(presenceRef).remove();

    const disconnectCheckRef = ref(this.db, `rooms/${roomId}/disconnectCheck/${userId}`);

    onDisconnect(disconnectCheckRef).set(new Date().toISOString()).then(() => {
      onValue(disconnectCheckRef, async (checkSnapshot) => {
        if (checkSnapshot.exists()) {
          try {
            const participantsSnapshot = await get(ref(this.db, `rooms/${roomId}/participants`));

            if (participantsSnapshot.exists()) {
              const participants = participantsSnapshot.val();
              const disconnectedUser = participants[userId];
              const otherParticipants = Object.keys(participants).filter(id => id !== userId);

              if (disconnectedUser?.isAdmin && otherParticipants.length > 0) {
                const newAdminId = otherParticipants[0];
                await this.transferAdminRole(roomId, newAdminId);
              }

              await remove(participantRef);

              const remainingParticipants = Object.keys(participants).filter(id => id !== userId);
              if (remainingParticipants.length === 0) {
                await remove(roomRef);
              }
            }
          } catch (error) {
            console.error('Error handling disconnect:', error);
          } finally {
            remove(disconnectCheckRef);
          }
        }
      });
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

      Object.keys(participants).forEach(participantId => {
        updates[`${participantId}/isAdmin`] = false;
      });

      if (participants[newAdminId]) {
        updates[`${newAdminId}/isAdmin`] = true;
      }

      await update(participantsRef, updates);
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

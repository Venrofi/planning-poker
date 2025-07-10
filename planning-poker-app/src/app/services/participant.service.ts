import { inject, Injectable } from '@angular/core';
import { Database, get, onDisconnect, onValue, ref, remove, set, update, DatabaseReference } from '@angular/fire/database';
import { BehaviorSubject, Observable } from 'rxjs';
import { Participant } from '../models/participant.model';
import { RoomService } from './room.service';

@Injectable({
  providedIn: 'root'
})
export class ParticipantService {
  private db = inject(Database);
  private roomService = inject(RoomService);

  async joinRoom(roomId: string, userId: string, username: string): Promise<boolean> {
    const MAX_ROOM_PARTICIPANTS = 10;

    const participantRef = ref(this.db, `rooms/${roomId}/participants/${userId}`);
    const participantsRef = ref(this.db, `rooms/${roomId}/participants`);
    const participantSnapshot = await get(participantRef);
    const participantsSnapshot = await get(participantsRef);

    const participantsCount = participantsSnapshot.exists() ? Object.keys(participantsSnapshot.val()).length : 0;
    const isAdmin = participantsCount === 0;

    if (participantsCount >= MAX_ROOM_PARTICIPANTS && !participantSnapshot.exists()) {
      return false;
    }

    set(participantRef, {
      id: userId,
      name: username,
      selectedCard: null,
      isRevealed: false,
      isAdmin: isAdmin
    });

    return true;
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

  async removeParticipant(roomId: string, userId: string): Promise<boolean> {
    const participantRef = ref(this.db, `rooms/${roomId}/participants/${userId}`);
    const presenceRef = ref(this.db, `rooms/${roomId}/presence/${userId}`);

    try {
      await Promise.all([
        remove(participantRef),
        remove(presenceRef)
      ]);

      await this.roomService.deleteEmptyRoom(roomId);
      return true;
    } catch (error) {
      console.error('Error removing participant:', error);
      return false;
    }
  }

  setupPresence(roomId: string, userId: string): void {
    const presenceRef = ref(this.db, `rooms/${roomId}/presence/${userId}`);
    const connectedRef = ref(this.db, '.info/connected');

    onValue(connectedRef, (snapshot) => {
      if (snapshot.val() === true) {
        set(presenceRef, true);
        this.setupDisconnectHandlers(roomId, userId, presenceRef);
      }
    });
  }

  private setupDisconnectHandlers(roomId: string, userId: string, presenceRef: DatabaseReference): void {
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

              if (disconnectedUser) {
                await this.removeParticipantAndTransferAdmin(roomId, userId, disconnectedUser.isAdmin, otherParticipants);
                await this.roomService.deleteEmptyRoom(roomId);
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

      if (!participants[newAdminId]) {
        return false;
      }

      const updates: Record<string, boolean> = {};

      Object.keys(participants).forEach(participantId => {
        if (participants[participantId].isAdmin) {
          updates[`${participantId}/isAdmin`] = false;
        }
      });

      updates[`${newAdminId}/isAdmin`] = true;

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

  private async removeParticipantAndTransferAdmin(
    roomId: string,
    userId: string,
    isAdmin: boolean,
    otherParticipants: string[]
  ): Promise<void> {
    const userParticipantRef = ref(this.db, `rooms/${roomId}/participants/${userId}`);
    const presenceRef = ref(this.db, `rooms/${roomId}/presence/${userId}`);

    await remove(userParticipantRef);
    await remove(presenceRef);

    if (isAdmin && otherParticipants.length > 0) {
      const newAdminId = otherParticipants[0];
      const newAdminRef = ref(this.db, `rooms/${roomId}/participants/${newAdminId}/isAdmin`);
      await set(newAdminRef, true);
    }
  }
}

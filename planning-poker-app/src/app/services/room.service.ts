import { inject, Injectable } from '@angular/core';
import { Database, get, onValue, ref, remove, set, update } from '@angular/fire/database';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RoomService {
  private db = inject(Database);

  isValidRoomId(roomId: string): boolean {
    const shortIdPattern = /^[0-9a-f]{8}$/i;
    return shortIdPattern.test(roomId);
  }

  generateShortRoomId(): string {
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  createRoom(roomId: string): Promise<boolean> {
    if (!this.isValidRoomId(roomId)) {
      console.warn('Invalid room ID format:', roomId);
      return Promise.resolve(false);
    }

    const roomRef = ref(this.db, `rooms/${roomId}`);

    return get(roomRef).then((snapshot) => {
      if (!snapshot.exists()) {
        return set(roomRef, {
          revealed: false,
          createdAt: new Date().toISOString(),
          title: 'Sprint Planning Poker'
        }).then(() => true);
      }
      return true;
    }).catch(error => {
      console.error('Error creating room:', error);
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

  getRoomRevealedState(roomId: string): Observable<boolean> {
    const roomRevealedSubject = new BehaviorSubject<boolean>(false);
    const roomRef = ref(this.db, `rooms/${roomId}/revealed`);

    onValue(roomRef, (snapshot) => {
      const revealed = snapshot.val() || false;
      roomRevealedSubject.next(revealed);
    });

    return roomRevealedSubject.asObservable();
  }

  deleteRoom(roomId: string): Promise<boolean> {
    const roomRef = ref(this.db, `rooms/${roomId}`);
    return remove(roomRef)
      .then(() => true)
      .catch(error => {
        console.error('Error deleting room:', error);
        return false;
      });
  }

  cleanupRoom(roomId: string): void {
    const participantsRef = ref(this.db, `rooms/${roomId}/participants`);

    onValue(participantsRef, async (snapshot) => {
      if (!snapshot.exists() || Object.keys(snapshot.val() || {}).length === 0) {
        await this.deleteEmptyRoom(roomId);
      }
    });
  }

  async deleteEmptyRoom(roomId: string): Promise<void> {
    try {
      const isEmpty = await this.isRoomEmpty(roomId);
      if (isEmpty) {
        await this.deleteRoom(roomId);
      }
    } catch (error) {
      console.error('Error checking room for cleanup:', error);
    }
  }

  async checkStaleRooms(): Promise<void> {
    const roomsRef = ref(this.db, 'rooms');

    try {
      const snapshot = await get(roomsRef);
      if (!snapshot.exists()) return;

      const cleanupPromises: Promise<void>[] = [];

      snapshot.forEach((childSnapshot) => {
        const roomId = childSnapshot.key;
        if (roomId) {
          cleanupPromises.push(this.deleteEmptyRoom(roomId));
        }
        return false;
      });

      await Promise.all(cleanupPromises);
    } catch (error) {
      console.error('Error checking stale rooms:', error);
    }
  }

  private async isRoomEmpty(roomId: string): Promise<boolean> {
    const participantsRef = ref(this.db, `rooms/${roomId}/participants`);
    const presenceRef = ref(this.db, `rooms/${roomId}/presence`);

    try {
      const [participantsSnapshot, presenceSnapshot] = await Promise.all([
        get(participantsRef),
        get(presenceRef)
      ]);

      const hasParticipants = participantsSnapshot.exists() && Object.keys(participantsSnapshot.val() || {}).length > 0;
      const hasPresence = presenceSnapshot.exists() && Object.keys(presenceSnapshot.val() || {}).length > 0;

      return !hasParticipants && !hasPresence;
    } catch (error) {
      console.error('Error checking if room is empty:', error);
      return false;
    }
  }
}

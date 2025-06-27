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
      return true; // Room already exists
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
      .then(() => {
        console.log(`Room ${roomId} deleted successfully`);
        return true;
      })
      .catch(error => {
        console.error('Error deleting room:', error);
        return false;
      });
  }

  checkStaleRooms(): void {
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
}

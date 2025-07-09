import { inject, Injectable } from '@angular/core';
import { Database, get, onValue, ref, update } from '@angular/fire/database';
import { BehaviorSubject, Observable } from 'rxjs';
import { CountdownState, ResetState } from '../models/poker.model';
import { Card } from '../models/cards.model';

@Injectable({
  providedIn: 'root'
})
export class PokerService {
  private db = inject(Database);

  selectCard(roomId: string, userId: string, card: Card | undefined): void {
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
        return false;
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

  getCountdownState(roomId: string): Observable<CountdownState> {
    const countdownSubject = new BehaviorSubject<CountdownState>({
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

  getResetState(roomId: string): Observable<ResetState> {
    const resetSubject = new BehaviorSubject<ResetState>({
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
}

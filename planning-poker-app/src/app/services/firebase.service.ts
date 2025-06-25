import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { Observable, map } from 'rxjs';
import { Participant } from '../models/participant.model';

@Injectable({
    providedIn: 'root'
})
export class FirebaseService {
    constructor(private db: AngularFireDatabase) { }

    joinRoom(roomId: string, userId: string, username: string): void {
        this.db.object(`rooms/${roomId}/participants/${userId}`).set({
            id: userId,
            name: username,
            selectedCard: undefined,
            isRevealed: false
        });
    }

    getParticipants(roomId: string): Observable<Participant[]> {
        return this.db.list<Participant>(`rooms/${roomId}/participants`).valueChanges();
    }

    selectCard(roomId: string, userId: string, card: string | undefined): void {
        this.db.object(`rooms/${roomId}/participants/${userId}`).update({
            selectedCard: card
        });
    }

    setRevealState(roomId: string, revealed: boolean): void {
        this.db.object(`rooms/${roomId}`).update({ revealed });

        this.db.list<Participant>(`rooms/${roomId}/participants`).snapshotChanges().pipe(
            map(changes => changes.map(c => ({ key: c.payload.key, ...c.payload.val() })))
        ).subscribe(participants => {
            participants.forEach(participant => {
                if (participant.key) {
                    this.db.object(`rooms/${roomId}/participants/${participant.key}`).update({
                        isRevealed: revealed
                    });
                }
            });
        });
    }

    resetCards(roomId: string): void {
        this.db.object(`rooms/${roomId}`).update({ revealed: false });

        this.db.list<Participant>(`rooms/${roomId}/participants`).snapshotChanges().pipe(
            map(changes => changes.map(c => ({ key: c.payload.key, ...c.payload.val() })))
        ).subscribe(participants => {
            participants.forEach(participant => {
                if (participant.key) {
                    this.db.object(`rooms/${roomId}/participants/${participant.key}`).update({
                        selectedCard: undefined,
                        isRevealed: false
                    });
                }
            });
        });
    }
}

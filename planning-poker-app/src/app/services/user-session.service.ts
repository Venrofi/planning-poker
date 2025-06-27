import { Injectable, signal, inject } from '@angular/core';
import { ParticipantService } from './participant.service';
import { Participant } from '../models/participant.model';

@Injectable({
  providedIn: 'root'
})
export class UserSessionService {
  private participantService = inject(ParticipantService);

  private _userId = signal<string>(crypto.randomUUID());
  private _userName = signal<string>('Radek');

  userId = this._userId.asReadonly();
  userName = this._userName.asReadonly();

  showUsernamePrompt = signal<boolean>(false);
  promptUsername = signal<string>('');

  initializeUser(): void {
    const savedUserName = localStorage.getItem('planningPokerUserName');
    if (savedUserName) {
      this._userName.set(savedUserName);
    } else {
      this.promptForUserName();
    }
  }

  promptForUserName(): void {
    this.promptUsername.set(localStorage.getItem('planningPokerUserName') || '');
    this.showUsernamePrompt.set(true);
  }

  async confirmUsernameChange(roomId: string): Promise<void> {
    const userName = this.promptUsername()?.trim();
    if (!userName) return;

    this._userName.set(userName);
    localStorage.setItem('planningPokerUserName', userName);

    if (roomId && this.userId()) {
      try {
        await this.participantService.updateUserName(roomId, this.userId(), userName);
      } catch (error) {
        console.error('Error updating username:', error);
      }
    }

    this.showUsernamePrompt.set(false);
    this.promptUsername.set('');
  }

  cancelUsernameChange(): void {
    this.showUsernamePrompt.set(false);
    this.promptUsername.set('');
  }

  async handleUserLeaving(roomId: string, participants: Participant[]): Promise<void> {
    if (!roomId || !this.userId()) return;

    try {
      const currentUser = participants.find(p => p.id === this.userId());
      const otherParticipants = participants.filter(p => p.id !== this.userId());

      if (currentUser?.isAdmin && otherParticipants.length > 0) {
        await this.participantService.transferAdminRole(roomId, otherParticipants[0].id);
      }

      this.participantService.removeParticipant(roomId, this.userId());
    } catch (error) {
      console.error('Error during user leaving cleanup:', error);
    }
  }

  setupPresence(roomId: string): void {
    this.participantService.setupPresence(roomId, this.userId());
  }

  removeFromRoom(roomId: string): void {
    if (roomId && this.userId()) {
      this.participantService.removeParticipant(roomId, this.userId());
    }
  }
}

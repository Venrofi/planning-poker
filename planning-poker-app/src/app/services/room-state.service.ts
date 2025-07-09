import { Injectable, signal, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { Participant } from '../models/participant.model';
import { Card } from '../models/cards.model';
import { RoomService } from './room.service';
import { ParticipantService } from './participant.service';
import { NotificationService } from './notification.service';
import { UserSessionService } from './user-session.service';

@Injectable({
  providedIn: 'root'
})
export class RoomStateService {
  private roomService = inject(RoomService);
  private participantService = inject(ParticipantService);
  private notificationService = inject(NotificationService);
  private userSessionService = inject(UserSessionService);

  private _participants = signal<Participant[]>([]);
  private _roomTitle = signal<string>('Sprint Planning Poker');
  private _areCardsRevealed = signal<boolean>(false);
  private _selectedCard = signal<Card | undefined>(undefined);
  private _isRevealInProgress = signal<boolean>(false);
  private _cards = signal<Card[]>(['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '?']);

  participants = this._participants.asReadonly();
  roomTitle = this._roomTitle.asReadonly();
  areCardsRevealed = this._areCardsRevealed.asReadonly();
  selectedCard = this._selectedCard.asReadonly();
  isRevealInProgress = this._isRevealInProgress.asReadonly();
  cards = this._cards.asReadonly();

  private previousParticipants: Participant[] = [];
  private currentAdminId: string | null = null;
  private isCurrentUserLeaving = false;

  private titleSubscription: Subscription | null = null;
  private participantsSubscription: Subscription | null = null;

  setupSubscriptions(roomId: string): void {
    this.userSessionService.setupPresence(roomId);
    this.roomService.cleanupRoom(roomId);

    this.titleSubscription = this.roomService.getRoomTitle(roomId).subscribe(title => {
      if (title) this._roomTitle.set(title);
    });

    this.participantsSubscription = this.participantService.getParticipants(roomId).subscribe(participants => {
      this.handleParticipantsUpdate(participants);
    });
  }

  private async handleParticipantsUpdate(participants: Participant[]): Promise<void> {
    await this.handleUserDepartures(participants);
    await this.handleAdminChanges(participants);

    this.previousParticipants = [...participants];

    if (!participants?.length) {
      this.resetState();
    }

    this.updateUI(participants);
  }

  private getCurrentRoomId(): string | null {
    const url = window.location.pathname;
    const match = url.match(/\/room\/([^/]+)/);
    return match ? match[1] : null;
  }

  private async handleAdminChanges(participants: Participant[]): Promise<Participant[]> {
    const currentAdmin = participants.find(p => p.isAdmin);
    const currentAdminId = currentAdmin?.id || null;

    if (this.currentAdminId && this.currentAdminId !== currentAdminId && currentAdminId) {
      const previousAdmin = this.previousParticipants.find(p => p.isAdmin);
      const newAdmin = participants.find(p => p.id === currentAdminId);

      if (newAdmin) {
        if (this.userSessionService.userId() === newAdmin.id) {
          this.notificationService.showNewAdmin();
        } else {
          this.notificationService.showAdminTransfer(newAdmin.name);
        }

        if (previousAdmin) {
          const isCurrentUserLeavingThisSession = previousAdmin.id === this.userSessionService.userId();
          if (!isCurrentUserLeavingThisSession) {
            this.notificationService.showUserLeft(previousAdmin.name);
          }
        }
      }
    }

    this.currentAdminId = currentAdminId;
    return participants;
  }

  private async handleUserDepartures(participants: Participant[]): Promise<void> {
    if (!this.previousParticipants.length) return;

    const leftUsers = this.previousParticipants.filter(prev =>
      !participants.find(current => current.id === prev.id)
    );

    leftUsers.forEach(leftUser => {
      const isCurrentUserLeavingThisSession = leftUser.id === this.userSessionService.userId();
      const shouldShow = !isCurrentUserLeavingThisSession;

      if (shouldShow) {
        this.notificationService.showUserLeft(leftUser.name);
      }
    });
  }

  private updateUI(participants: Participant[]): void {
    this._participants.set(participants);
    this._areCardsRevealed.set(participants.some(p => p.isRevealed));

    const currentUser = participants.find(p => p.id === this.userSessionService.userId());
    if (currentUser) {
      this._selectedCard.set(currentUser.selectedCard as Card | undefined);
    }
  }

  updateParticipants(updatedParticipants: Participant[]): void {
    const isReset = updatedParticipants.every(p => !p.selectedCard && !p.isRevealed);

    if (isReset) {
      this._selectedCard.set(undefined);
      this._areCardsRevealed.set(false);
    } else {
      this._areCardsRevealed.set(updatedParticipants.some(p => p.isRevealed));
    }
    this._participants.set(updatedParticipants);
  }

  setSelectedCard(card: Card | undefined): void {
    this._selectedCard.set(card);
  }

  setCardsRevealed(revealed: boolean): void {
    this._areCardsRevealed.set(revealed);
  }

  updateTitle(newTitle: string, roomId: string): void {
    this._roomTitle.set(newTitle);
    if (roomId) {
      this.roomService.setRoomTitle(roomId, newTitle);
    }
  }

  resetState(): void {
    this._participants.set([]);
    this.currentAdminId = null;
  }

  setUserLeaving(leaving: boolean): void {
    this.isCurrentUserLeaving = leaving;
  }

  isUserLeaving(): boolean {
    return this.isCurrentUserLeaving;
  }

  isCurrentUserAdmin(): boolean {
    return this.participants().find(p => p.id === this.userSessionService.userId())?.isAdmin || false;
  }

  cleanup(): void {
    this.titleSubscription?.unsubscribe();
    this.participantsSubscription?.unsubscribe();
    this.titleSubscription = null;
    this.participantsSubscription = null;

    this._participants.set([]);
    this.previousParticipants = [];
    this.currentAdminId = null;
    this._areCardsRevealed.set(false);
    this._isRevealInProgress.set(false);
    this._selectedCard.set(undefined);

    this.notificationService.clearAll();
  }

  setRevealInProgress(inProgress: boolean): void {
    this._isRevealInProgress.set(inProgress);
  }
}

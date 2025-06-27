import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PokerTableComponent } from '../poker-table/poker-table.component';
import { PokerCardComponent } from '../poker-card/poker-card.component';
import { RoomHeaderComponent } from '../room-header/room-header.component';
import { RoomNotificationsComponent, NotificationData } from '../room-notifications/room-notifications.component';
import { Participant } from '../../models/participant.model';
import { Card } from '../../models/cards.model';
import { RoomService } from '../../services/room.service';
import { ParticipantService } from '../../services/participant.service';
import { PokerService } from '../../services/poker.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-room',
  standalone: true,
  imports: [CommonModule, FormsModule, PokerTableComponent, PokerCardComponent, RoomHeaderComponent, RoomNotificationsComponent],
  templateUrl: './room.component.html',
  styleUrl: './room.component.scss'
})
export class RoomComponent implements OnInit, OnDestroy {
  roomTitle = signal<string>('Sprint Planning Poker');
  roomId = signal<string>('');
  userId = signal<string>(crypto.randomUUID());
  userName = signal<string>('Radek');

  areCardsRevealed = signal<boolean>(false);
  isRevealInProgress = signal<boolean>(false);
  showRoomRedirectAlert = false;
  showUsernamePrompt = false;
  promptUsername = '';

  notifications: NotificationData = {
    showUserLeftNotification: false,
    userLeftMessage: '',
    showAdminTransferNotification: false,
    adminTransferMessage: '',
    showNewAdminNotification: false,
    newAdminMessage: ''
  };

  participants = signal<Participant[]>([]);
  private previousParticipants: Participant[] = [];
  private isCurrentUserLeaving = false;
  private currentAdminId: string | null = null;

  cards = signal<Card[]>(['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '?']);
  selectedCard = signal<Card | undefined>(undefined);

  private titleSubscription: Subscription | null = null;
  private participantsSubscription: Subscription | null = null;
  private routeSubscription: Subscription | null = null;
  private boundBeforeUnloadHandler: (event: BeforeUnloadEvent) => void;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private roomService = inject(RoomService);
  private participantService = inject(ParticipantService);
  private pokerService = inject(PokerService);

  constructor() {
    this.boundBeforeUnloadHandler = this.handleBeforeUnload.bind(this);
    window.addEventListener('beforeunload', this.boundBeforeUnloadHandler);
  }

  ngOnInit(): void {
    this.initializeUser();
    this.routeSubscription = this.route.paramMap.subscribe(params => {
      this.handleRouteChange(params.get('id'));
    });
  }

  private initializeUser(): void {
    const savedUserName = localStorage.getItem('planningPokerUserName');
    if (savedUserName) {
      this.userName.set(savedUserName);
    } else {
      this.promptForUserName();
    }
  }

  private async handleRouteChange(providedRoomId: string | null): Promise<void> {
    if (!providedRoomId) {
      const generatedRoomId = this.roomService.generateShortRoomId();
      this.roomId.set(generatedRoomId);
      this.router.navigate(['room', generatedRoomId]);
      return;
    }

    this.roomId.set(providedRoomId);
    await this.joinRoom(providedRoomId);
  }

  private async joinRoom(roomId: string): Promise<void> {
    try {
      const roomCreated = await this.roomService.createRoom(roomId);
      if (!roomCreated) {
        this.redirectToNewRoom();
        return;
      }

      this.roomService.checkStaleRooms();
      const joined = await this.participantService.joinRoom(roomId, this.userId(), this.userName());

      if (!joined) {
        this.redirectToNewRoom();
        return;
      }

      this.setupRoomSubscriptions();
    } catch (error) {
      console.error(`Error joining room ${roomId}: `, error);
      this.redirectToNewRoom();
    }
  }

  private redirectToNewRoom(): void {
    this.showRoomRedirectAlert = true;
    const newRoomId = this.roomService.generateShortRoomId();
    this.roomId.set(newRoomId);
    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
      this.router.navigate(['room', newRoomId]);
    });
  }

  private setupRoomSubscriptions(): void {
    this.participantService.setupPresence(this.roomId(), this.userId());
    this.roomService.cleanupRoom(this.roomId());

    this.titleSubscription = this.roomService.getRoomTitle(this.roomId()).subscribe(title => {
      if (title) this.roomTitle.set(title);
    });

    this.participantsSubscription = this.participantService.getParticipants(this.roomId()).subscribe(participants => {
      this.handleParticipantsUpdate(participants);
    });
  }

  private async handleParticipantsUpdate(participants: Participant[]): Promise<void> {
    if (!participants?.length) {
      this.resetRoomState();
      return;
    }

    await this.handleAdminChanges(participants);
    await this.handleUserDepartures(participants);
    this.updateUI(participants);
    this.previousParticipants = [...participants];
  }

  private async handleAdminChanges(participants: Participant[]): Promise<void> {
    const currentAdmin = participants.find(p => p.isAdmin);
    const currentAdminId = currentAdmin?.id || null;

    if (this.currentAdminId && this.currentAdminId !== currentAdminId && currentAdminId) {
      const isCurrentUserTheNewAdmin = this.userId() === currentAdminId;
      const isCurrentUserInParticipants = participants.some(p => p.id === this.userId());

      if (!this.isCurrentUserLeaving && isCurrentUserInParticipants) {
        if (isCurrentUserTheNewAdmin) {
          this.showNewAdminMessage();
        } else {
          this.showAdminTransferMessage(currentAdmin!.name);
        }
      }
    }

    this.currentAdminId = currentAdminId;
  }

  private async handleUserDepartures(participants: Participant[]): Promise<void> {
    if (this.isCurrentUserLeaving || !this.previousParticipants.length) return;

    const leftUsers = this.previousParticipants.filter(prev =>
      !participants.find(current => current.id === prev.id)
    );

    const adminLeft = this.previousParticipants.find(p =>
      p.isAdmin && !participants.find(current => current.id === p.id)
    );

    leftUsers.forEach(leftUser => {
      if (leftUser.id !== this.userId()) {
        this.showUserLeftMessage(leftUser.name);
      }
    });

    if (adminLeft && participants.length > 0) {
      await this.handleAdminTransfer(participants);
    }
  }

  private async handleAdminTransfer(participants: Participant[]): Promise<void> {
    const newAdmin = participants.find(p => p.isAdmin);
    if (!newAdmin) return;

    if (this.userId() === newAdmin.id) {
      this.showNewAdminMessage();
    } else {
      this.showAdminTransferMessage(newAdmin.name);
    }

    try {
      await this.participantService.transferAdminRole(this.roomId(), newAdmin.id);
    } catch (error) {
      console.error('Error transferring admin role:', error);
    }
  }

  private updateUI(participants: Participant[]): void {
    this.participants.set(participants);
    this.areCardsRevealed.set(participants.some(p => p.isRevealed));

    const currentUser = participants.find(p => p.id === this.userId());
    if (currentUser) {
      this.selectedCard.set(currentUser.selectedCard as Card | undefined);
    }
  }

  private resetRoomState(): void {
    this.participants.set([]);
    this.previousParticipants = [];
    this.currentAdminId = null;
  }

  updateParticipants(updatedParticipants: Participant[]): void {
    const isReset = updatedParticipants.every(p => !p.selectedCard && !p.isRevealed);

    if (isReset) {
      this.selectedCard.set(undefined);
      this.areCardsRevealed.set(false);
      this.isRevealInProgress.set(false);
    } else {
      this.areCardsRevealed.set(updatedParticipants.some(p => p.isRevealed));
    }
    this.participants.set(updatedParticipants);
  }

  handleCardClick(card: Card): void {
    if (this.areCardsRevealed() || this.isRevealInProgress()) return;

    this.selectedCard.set(card);
    this.pokerService.selectCard(this.roomId(), this.userId(), card);
  }

  toggleReveal(): void {
    this.isRevealInProgress.set(true);
    setTimeout(() => {
      this.pokerService.setRevealState(this.roomId(), !this.areCardsRevealed());
      this.isRevealInProgress.set(false);
    }, 3000);
  }

  resetCards(): void {
    this.pokerService.resetCards(this.roomId());
  }

  promptForUserName(): void {
    this.promptUsername = localStorage.getItem('planningPokerUserName') || '';
    this.showUsernamePrompt = true;
  }

  async confirmUsernameChange(): Promise<void> {
    const userName = this.promptUsername?.trim();
    if (!userName) return;

    this.userName.set(userName);
    localStorage.setItem('planningPokerUserName', userName);

    if (this.roomId() && this.userId()) {
      try {
        await this.participantService.updateUserName(this.roomId(), this.userId(), userName);
      } catch (error) {
        console.error('Error updating username:', error);
      }
    }

    this.showUsernamePrompt = false;
    this.promptUsername = '';
  }

  cancelUsernameChange(): void {
    this.showUsernamePrompt = false;
    this.promptUsername = '';
  }

  ngOnDestroy(): void {
    this.isCurrentUserLeaving = true;
    this.unsubscribeAll();
    window.removeEventListener('beforeunload', this.boundBeforeUnloadHandler);
    this.handleUserLeaving();
    this.clearComponentState();
  }

  private unsubscribeAll(): void {
    this.titleSubscription?.unsubscribe();
    this.participantsSubscription?.unsubscribe();
    this.routeSubscription?.unsubscribe();
    this.titleSubscription = null;
    this.participantsSubscription = null;
    this.routeSubscription = null;
  }

  private clearComponentState(): void {
    this.participants.set([]);
    this.previousParticipants = [];
    this.currentAdminId = null;
    this.areCardsRevealed.set(false);
    this.isRevealInProgress.set(false);
    this.selectedCard.set(undefined);
    this.notifications.showUserLeftNotification = false;
    this.notifications.showAdminTransferNotification = false;
    this.notifications.showNewAdminNotification = false;
  }

  private async handleUserLeaving(): Promise<void> {
    if (!this.roomId() || !this.userId()) return;

    try {
      const currentUser = this.participants().find(p => p.id === this.userId());
      const otherParticipants = this.participants().filter(p => p.id !== this.userId());

      if (currentUser?.isAdmin && otherParticipants.length > 0) {
        await this.participantService.transferAdminRole(this.roomId(), otherParticipants[0].id);
      }

      this.participantService.removeParticipant(this.roomId(), this.userId());
    } catch (error) {
      console.error('Error during user leaving cleanup:', error);
    }
  }

  updateRoomTitle(newTitle: string): void {
    this.roomTitle.set(newTitle);
    if (this.roomId()) {
      this.roomService.setRoomTitle(this.roomId(), newTitle);
    }
  }

  private handleBeforeUnload(): void {
    this.isCurrentUserLeaving = true;
    if (this.roomId() && this.userId()) {
      this.participantService.removeParticipant(this.roomId(), this.userId());
    }
  }

  async createNewRoom(): Promise<void> {
    const newRoomId = this.roomService.generateShortRoomId();
    await this.navigateToRoomWithCleanup(newRoomId);
  }

  private async navigateToRoomWithCleanup(roomId: string): Promise<void> {
    this.isCurrentUserLeaving = true;
    await this.handleUserLeaving();
    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
      this.router.navigate(['room', roomId]);
    });
  }

  private showUserLeftMessage(userName: string): void {
    this.notifications.userLeftMessage = `${userName} left the room`;
    this.notifications.showUserLeftNotification = true;
    setTimeout(() => this.notifications.showUserLeftNotification = false, 4000);
  }

  dismissUserLeftNotification(): void {
    this.notifications.showUserLeftNotification = false;
  }

  isCurrentUserAdmin(): boolean {
    return this.participants().find(p => p.id === this.userId())?.isAdmin || false;
  }

  private showAdminTransferMessage(newAdminName: string): void {
    this.notifications.adminTransferMessage = `👑 ${newAdminName} is now the room admin`;
    this.notifications.showAdminTransferNotification = true;
    setTimeout(() => this.notifications.showAdminTransferNotification = false, 3000);
  }

  dismissAdminTransferNotification(): void {
    this.notifications.showAdminTransferNotification = false;
  }

  private showNewAdminMessage(): void {
    this.notifications.newAdminMessage = `🎉 You are now the room admin!`;
    this.notifications.showNewAdminNotification = true;
    setTimeout(() => this.notifications.showNewAdminNotification = false, 3000);
  }

  dismissNewAdminNotification(): void {
    this.notifications.showNewAdminNotification = false;
  }
}

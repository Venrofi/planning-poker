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
    const savedUserName = localStorage.getItem('planningPokerUserName');
    if (savedUserName) {
      this.userName.set(savedUserName);
    } else {
      this.promptForUserName();
    }

    this.routeSubscription = this.route.paramMap.subscribe(params => {
      const providedRoomId = params.get('id');
      const generatedRoomId = this.roomService.generateShortRoomId();

      // If no ID provided, navigate to a new random room
      if (!providedRoomId) {
        this.roomId.set(generatedRoomId);
        this.router.navigate(['room', generatedRoomId]);
        return;
      }

      this.roomId.set(providedRoomId);

      // Join the room with the current user only
      // First create the room if it doesn't exist, then join the participant
      this.roomService.createRoom(providedRoomId).then((roomCreated: boolean) => {
        if (roomCreated) {
          this.roomService.checkStaleRooms(); // Clean up stale rooms
          return this.participantService.joinRoom(providedRoomId, this.userId(), this.userName());
        }
        return false;
      }).then((joined: boolean) => {
        if (!joined) {
          // Room ID invalid or room is full - redirect to a new valid room
          console.warn(`Unable to join room "${providedRoomId}". Creating a new room.`);
          this.showRoomRedirectAlert = true;
          const newGeneratedRoomId = this.roomService.generateShortRoomId();
          this.roomId.set(newGeneratedRoomId);
          // Force component reload for consistency
          this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
            this.router.navigate(['room', newGeneratedRoomId]);
          });
          return;
        }

        this.participantService.setupPresence(this.roomId(), this.userId());
        this.roomService.cleanupRoom(this.roomId());

        this.titleSubscription = this.roomService.getRoomTitle(this.roomId()).subscribe((title: string) => {
          if (title) {
            this.roomTitle.set(title);
          }
        });

        this.participantsSubscription = this.participantService.getParticipants(this.roomId()).subscribe((participants: Participant[]) => {
          if (participants && participants.length > 0) {
            // Track admin changes
            const currentAdmin = participants.find(p => p.isAdmin);
            const currentAdminId = currentAdmin?.id || null;

            // Check if admin changed
            if (this.currentAdminId && this.currentAdminId !== currentAdminId && currentAdminId) {
              // Admin changed - determine notification strategy
              console.log(`Admin changed from ${this.currentAdminId} to ${currentAdminId}. Current user: ${this.userId()}, isLeaving: ${this.isCurrentUserLeaving}`);

              const isCurrentUserTheNewAdmin = this.userId() === currentAdminId;
              const isCurrentUserInParticipants = participants.some(p => p.id === this.userId());

              if (!this.isCurrentUserLeaving && isCurrentUserInParticipants) {
                if (isCurrentUserTheNewAdmin) {
                  // Show "you are now admin" message to the new admin
                  console.log(`Showing "you are admin" notification to new admin: ${currentAdmin?.name}`);
                  this.showNewAdminMessage();
                } else {
                  // Show "X is now admin" message to other participants
                  console.log(`Showing admin transfer notification for new admin: ${currentAdmin?.name}`);
                  this.showAdminTransferMessage(currentAdmin!.name, currentAdminId);
                }
              } else {
                console.log(`Not showing admin change notification because:`, {
                  isNewAdmin: isCurrentUserTheNewAdmin,
                  isLeaving: this.isCurrentUserLeaving,
                  isInParticipants: isCurrentUserInParticipants
                });
              }
            }

            // Update the current admin ID for next comparison
            this.currentAdminId = currentAdminId;

            // Check for users who left before updating the participants list
            // But only if the current user is not the one leaving
            if (!this.isCurrentUserLeaving) {
              this.checkForLeftUsers(participants).then(() => {
                // Update previousParticipants after checking for left users
                this.previousParticipants = [...participants];
              }).catch(error =>
                console.error('Error checking for left users:', error)
              );
            } else {
              // If current user is leaving, just update the previous participants
              this.previousParticipants = [...participants];
            }

            // Room has participants, update the UI
            this.participants.set(participants);

            const areRevealed = participants.some((p: Participant) => p.isRevealed);
            this.areCardsRevealed.set(areRevealed);

            const currentUser = participants.find((p: Participant) => p.id === this.userId());
            if (currentUser) {
              this.selectedCard.set(currentUser.selectedCard as Card | undefined);
            }
          } else if (participants && participants.length === 0) {
            // Empty room, clear previous participants but don't show notifications
            this.participants.set([]);
            this.previousParticipants = [];
            this.currentAdminId = null;
          }
        });
      });
    });
  }

  updateParticipants(updatedParticipants: Participant[]): void {
    const isReset = updatedParticipants.every(p => !p.selectedCard && !p.isRevealed);
    if (isReset) {
      this.selectedCard.set(undefined);
      this.areCardsRevealed.set(false);
      this.isRevealInProgress.set(false);
    } else {
      const areRevealed = updatedParticipants.some(p => p.isRevealed);
      this.areCardsRevealed.set(areRevealed);
    }

    this.participants.set(updatedParticipants);
  }

  selectCard(card: Card): void {
    if (this.areCardsRevealed() || this.isRevealInProgress()) return;

    this.selectedCard.set(card);
    this.pokerService.selectCard(this.roomId(), this.userId(), card);
  }

  handleCardClick(card: Card): void {
    if (this.areCardsRevealed() || this.isRevealInProgress()) return;

    this.selectCard(card);
  }

  toggleReveal(): void {
    const newRevealState = !this.areCardsRevealed();
    this.isRevealInProgress.set(true);

    setTimeout(() => {
      this.pokerService.setRevealState(this.roomId(), newRevealState);
      this.isRevealInProgress.set(false);
    }, 3000);
  }
  resetCards(): void {
    this.pokerService.resetCards(this.roomId());
  }

  promptForUserName(): void {
    const defaultName = localStorage.getItem('planningPokerUserName') || '';
    this.promptUsername = defaultName;
    this.showUsernamePrompt = true;
  }

  confirmUsernameChange(): void {
    const userName = this.promptUsername;

    if (userName && userName.trim()) {
      this.userName.set(userName.trim());
      localStorage.setItem('planningPokerUserName', userName.trim());

      // Update the user in Firebase if we're already connected
      if (this.roomId() && this.userId()) {
        this.participantService.updateUserName(this.roomId(), this.userId(), userName.trim())
          .then((success: boolean) => {
            if (!success) {
              console.warn('Failed to update username in Firebase');
            }
          });
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
    // Set flag to indicate current user is leaving
    this.isCurrentUserLeaving = true;

    // Clean up all subscriptions
    if (this.titleSubscription) {
      this.titleSubscription.unsubscribe();
      this.titleSubscription = null;
    }
    if (this.participantsSubscription) {
      this.participantsSubscription.unsubscribe();
      this.participantsSubscription = null;
    }
    if (this.routeSubscription) {
      this.routeSubscription.unsubscribe();
      this.routeSubscription = null;
    }

    window.removeEventListener('beforeunload', this.boundBeforeUnloadHandler);

    // Handle admin transfer and participant removal
    this.handleUserLeaving();

    // Clear all component state
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
    try {
      if (this.roomId() && this.userId()) {
        // Check if current user is admin and there are other participants
        const currentUser = this.participants().find(p => p.id === this.userId());
        const otherParticipants = this.participants().filter(p => p.id !== this.userId());

        if (currentUser?.isAdmin && otherParticipants.length > 0) {
          // Transfer admin role before leaving
          const nextAdmin = otherParticipants[0];
          await this.participantService.transferAdminRole(this.roomId(), nextAdmin.id);
          console.log(`Transferred admin role to ${nextAdmin.name} before leaving`);
        }

        // Remove participant from room
        this.participantService.removeParticipant(this.roomId(), this.userId());
      }
    } catch (error) {
      console.error('Error during user leaving cleanup:', error);
    }
  }

  updateRoomTitle(newTitle: string): void {
    this.roomTitle.set(newTitle);
    if (this.roomId()) {
      this.roomService.setRoomTitle(this.roomId(), newTitle)
        .then((success: boolean) => {
          if (!success) {
            console.warn('Failed to update room title in Firebase');
          }
        });
    }
  }

  private handleBeforeUnload(): void {
    this.isCurrentUserLeaving = true;
    // Note: In beforeunload, we can't use async operations reliably
    // The participant removal will be handled by Firebase presence detection
    if (this.roomId() && this.userId()) {
      this.participantService.removeParticipant(this.roomId(), this.userId())
        .catch((error: unknown) => console.error('Error removing participant:', error));
    }
  }

  async createNewRoom(): Promise<void> {
    const newRoomId = this.roomService.generateShortRoomId();
    await this.navigateToRoomWithCleanup(newRoomId);
  }

  /**
   * Helper function to navigate to a room with proper cleanup.
   * Uses a two-step navigation pattern to force component destruction and recreation,
   * which is necessary to prevent memory leaks and cross-room event bugs.
   */
  private async navigateToRoomWithCleanup(roomId: string): Promise<void> {
    // Set flag to indicate current user is leaving
    this.isCurrentUserLeaving = true;

    try {
      if (this.roomId() && this.userId()) {
        // Check if current user is admin and there are other participants
        const currentUser = this.participants().find(p => p.id === this.userId());
        const otherParticipants = this.participants().filter(p => p.id !== this.userId());

        if (currentUser?.isAdmin && otherParticipants.length > 0) {
          // Transfer admin role before leaving
          const nextAdmin = otherParticipants[0];
          await this.participantService.transferAdminRole(this.roomId(), nextAdmin.id);
          console.log(`Transferred admin role to ${nextAdmin.name} before leaving`);
        }

        // Remove participant from room
        await this.participantService.removeParticipant(this.roomId(), this.userId());
      }
    } catch (error) {
      console.error('Error removing participant before navigating to new room:', error);
    }

    // Force component reload by navigating away and back
    // This ensures proper cleanup of subscriptions and component state
    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
      this.router.navigate(['room', roomId]);
    });
  }

  private async checkForLeftUsers(currentParticipants: Participant[]): Promise<void> {
    // Only check if we have previous participants to compare with
    if (this.previousParticipants.length === 0) {
      console.log('No previous participants to compare with, skipping left users check');
      return;
    }

    console.log('Checking for left users...', {
      previous: this.previousParticipants.map(p => ({ id: p.id, name: p.name, isAdmin: p.isAdmin })),
      current: currentParticipants.map(p => ({ id: p.id, name: p.name, isAdmin: p.isAdmin }))
    });

    // Find participants who were in the previous list but not in current list
    const leftUsers = this.previousParticipants.filter(prevParticipant =>
      !currentParticipants.find(currentParticipant =>
        currentParticipant.id === prevParticipant.id
      )
    );

    console.log('Left users detected:', leftUsers.map(u => ({ id: u.id, name: u.name, isAdmin: u.isAdmin })));

    // Check if any admin left by looking at the PREVIOUS participants data
    // (before Firebase updated the admin roles)
    const adminLeft = this.previousParticipants.find(p => p.isAdmin &&
      !currentParticipants.find(current => current.id === p.id)
    );

    // Show notification for each user who left (excluding current user)
    // This should always be shown to all remaining users regardless of admin changes
    for (const leftUser of leftUsers) {
      if (leftUser.id !== this.userId() && !this.isCurrentUserLeaving) {
        console.log(`Showing user left notification for: ${leftUser.name}`);
        this.showUserLeftMessage(leftUser.name);
      }
    }

    // Handle admin transfer if an admin left and there are still participants
    if (adminLeft && currentParticipants.length > 0) {
      console.log(`Admin ${adminLeft.name} left (detected from previous data), handling admin transfer...`);

      // Find who became the new admin (should be the first participant in current list)
      const newAdmin = currentParticipants.find(p => p.isAdmin);

      if (newAdmin) {
        console.log(`New admin detected: ${newAdmin.name} (${newAdmin.id})`);

        // Determine what notification to show based on current user
        if (this.userId() === newAdmin.id) {
          // Current user is the new admin - show "you are now admin" message
          console.log(`Current user is the new admin, showing "you are admin" notification`);
          this.showNewAdminMessage();
        } else {
          // Current user is not the new admin - show "X is now admin" message
          console.log(`Showing admin transfer notification for new admin: ${newAdmin.name}`);
          this.showAdminTransferMessage(newAdmin.name, newAdmin.id);
        }

        // Ensure the admin role is properly transferred in case it wasn't automatic
        try {
          await this.participantService.transferAdminRole(this.roomId(), newAdmin.id);
          console.log(`Admin role transfer completed for: ${newAdmin.name}`);
        } catch (error) {
          console.warn('Admin role transfer may have already occurred:', error);
        }
      }
    }
  }

  private showUserLeftMessage(userName: string): void {
    this.notifications.userLeftMessage = `${userName} left the room`;
    this.notifications.showUserLeftNotification = true;

    // Auto-hide notification after 4 seconds
    setTimeout(() => {
      this.notifications.showUserLeftNotification = false;
    }, 4000);
  }

  dismissUserLeftNotification(): void {
    this.notifications.showUserLeftNotification = false;
  }

  isCurrentUserAdmin(): boolean {
    const currentUser = this.participants().find(p => p.id === this.userId());
    return currentUser?.isAdmin || false;
  }

  private showAdminTransferMessage(newAdminName: string, newAdminId: string): void {
    console.log(`Showing admin transfer notification to remaining participant. New admin: ${newAdminName} (${newAdminId})`);

    this.notifications.adminTransferMessage = `👑 ${newAdminName} is now the room admin`;
    this.notifications.showAdminTransferNotification = true;

    setTimeout(() => {
      this.notifications.showAdminTransferNotification = false;
    }, 3000);
  }

  dismissAdminTransferNotification(): void {
    this.notifications.showAdminTransferNotification = false;
  }

  private showNewAdminMessage(): void {
    console.log(`Showing "you are now admin" notification to current user`);

    this.notifications.newAdminMessage = `🎉 You are now the room admin!`;
    this.notifications.showNewAdminNotification = true;

    setTimeout(() => {
      this.notifications.showNewAdminNotification = false;
    }, 3000);
  }

  dismissNewAdminNotification(): void {
    this.notifications.showNewAdminNotification = false;
  }
}

import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PokerTableComponent } from '../components/poker-table/poker-table.component';
import { CardComponent } from '../components/card/card.component';
import { HeaderComponent } from '../components/header/header.component';
import { Participant } from '../models/participant.model';
import { Card } from '../models/cards.model';
import { FirebaseService } from '../services/firebase.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, PokerTableComponent, CardComponent, HeaderComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  roomTitle = signal<string>('Sprint Planning Poker');
  roomId = signal<string>('');
  userId = signal<string>(crypto.randomUUID());
  userName = signal<string>('Radek');

  areCardsRevealed = signal<boolean>(false);
  isRevealInProgress = signal<boolean>(false);
  showRoomRedirectAlert = false;
  showUsernamePrompt = false;
  promptUsername = '';

  // User left notification
  showUserLeftNotification = false;
  userLeftMessage = '';

  participants = signal<Participant[]>([]);
  private previousParticipants: Participant[] = [];
  private isCurrentUserLeaving = false;

  cards = signal<Card[]>(['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '?']);
  selectedCard = signal<Card | undefined>(undefined);

  private titleSubscription: Subscription | null = null;
  private boundBeforeUnloadHandler: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private firebaseService: FirebaseService
  ) {
    // Set up the beforeunload event handler to remove the participant when the window/tab is closed
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

    this.route.paramMap.subscribe(params => {
      const providedRoomId = params.get('id');
      const generatedRoomId = crypto.randomUUID();

      // If no ID provided, navigate to a new random room
      if (!providedRoomId) {
        this.roomId.set(generatedRoomId);
        this.router.navigate(['room', generatedRoomId]);
        return;
      }

      this.roomId.set(providedRoomId);

      // Join the room with the current user only
      this.firebaseService.joinRoom(providedRoomId, this.userId(), this.userName()).then(joined => {
        if (!joined) {
          // Room ID invalid or room is full - redirect to a new valid room
          console.warn(`Unable to join room "${providedRoomId}". Creating a new room.`);
          this.showRoomRedirectAlert = true;
          this.roomId.set(generatedRoomId);
          this.router.navigate(['room', generatedRoomId]);
          return;
        }

        this.firebaseService.setupPresence(this.roomId(), this.userId());
        this.firebaseService.cleanupRoom(this.roomId());

        this.titleSubscription = this.firebaseService.getRoomTitle(this.roomId()).subscribe(title => {
          if (title) {
            this.roomTitle.set(title);
          }
        });

        this.firebaseService.getParticipants(this.roomId()).subscribe(participants => {
          if (participants && participants.length > 0) {
            // Check for users who left before updating the participants list
            // But only if the current user is not the one leaving
            if (!this.isCurrentUserLeaving) {
              this.checkForLeftUsers(participants);
            }

            // Room has participants, update the UI
            this.participants.set(participants);
            this.previousParticipants = [...participants]; // Store for next comparison

            const areRevealed = participants.some(p => p.isRevealed);
            this.areCardsRevealed.set(areRevealed);

            const currentUser = participants.find(p => p.id === this.userId());
            if (currentUser) {
              this.selectedCard.set(currentUser.selectedCard as Card | undefined);
            }
          } else if (participants && participants.length === 0) {
            // Empty room, clear previous participants but don't show notifications
            this.participants.set([]);
            this.previousParticipants = [];
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
    this.firebaseService.selectCard(this.roomId(), this.userId(), card);
  }

  handleCardClick(card: Card): void {
    if (this.areCardsRevealed() || this.isRevealInProgress()) return;

    this.selectCard(card);
  }

  toggleReveal(): void {
    const newRevealState = !this.areCardsRevealed();
    this.isRevealInProgress.set(true);

    setTimeout(() => {
      this.firebaseService.setRevealState(this.roomId(), newRevealState);
      this.isRevealInProgress.set(false);
    }, 3000);
  }
  resetCards(): void {
    this.firebaseService.resetCards(this.roomId());
  }

  private initParticipants(maxVirtualParticipants: number = 9): Participant[] {
    const participants: Participant[] = [{
      id: this.userId(),
      name: this.userName(),
      selectedCard: undefined,
      isRevealed: false
    }];

    const names = ['John', 'Sarah', 'Mike', 'Emma', 'David', 'Alice', 'Bob', 'Charlie', 'Diana'];
    const cards: Card[] = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];

    const actualParticipantCount = Math.min(maxVirtualParticipants, names.length);

    for (let i = 0; i < actualParticipantCount; i++) {
      const randomIndex = Math.floor(Math.random() * cards.length);
      const randomId = crypto.randomUUID();

      participants.push({
        id: randomId,
        name: names[i],
        selectedCard: cards[randomIndex],
        isRevealed: false
      });
    }

    return participants;
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
        this.firebaseService.updateUserName(this.roomId(), this.userId(), userName.trim())
          .then(success => {
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
    if (this.titleSubscription) {
      this.titleSubscription.unsubscribe();
    }

    // Remove event listener
    window.removeEventListener('beforeunload', this.boundBeforeUnloadHandler);

    // Set flag to indicate current user is leaving
    this.isCurrentUserLeaving = true;

    // Also remove the participant when the component is destroyed
    this.removeParticipantFromRoom();
  }

  updateRoomTitle(newTitle: string): void {
    this.roomTitle.set(newTitle);
    if (this.roomId()) {
      this.firebaseService.setRoomTitle(this.roomId(), newTitle)
        .then(success => {
          if (!success) {
            console.warn('Failed to update room title in Firebase');
          }
        });
    }
  }

  private handleBeforeUnload(event: BeforeUnloadEvent): void {
    // Set flag to indicate current user is leaving
    this.isCurrentUserLeaving = true;

    // Remove the participant from the room when the window/tab is closed
    this.removeParticipantFromRoom();
  }

  private removeParticipantFromRoom(): void {
    if (this.roomId() && this.userId()) {
      this.firebaseService.removeParticipant(this.roomId(), this.userId())
        .catch(error => console.error('Error removing participant:', error));
    }
  }

  async createNewRoom(): Promise<void> {
    const newRoomId = crypto.randomUUID();

    // Set flag to indicate current user is leaving
    this.isCurrentUserLeaving = true;

    try {
      if (this.roomId() && this.userId()) {
        await this.firebaseService.removeParticipant(this.roomId(), this.userId());
      }
    } catch (error) {
      console.error('Error removing participant before creating new room:', error);
    }

    // Reset the flag when navigating to new room
    setTimeout(() => {
      this.isCurrentUserLeaving = false;
    }, 1000);

    this.router.navigate(['room', newRoomId]);
  }

  private checkForLeftUsers(currentParticipants: Participant[]): void {
    // Only check if we have previous participants to compare with
    if (this.previousParticipants.length === 0) {
      return;
    }

    // Find participants who were in the previous list but not in current list
    const leftUsers = this.previousParticipants.filter(prevParticipant =>
      !currentParticipants.find(currentParticipant =>
        currentParticipant.id === prevParticipant.id
      )
    );

    // Show notification for each user who left (excluding current user)
    leftUsers.forEach(leftUser => {
      if (leftUser.id !== this.userId()) {
        this.showUserLeftMessage(leftUser.name);
      }
    });
  }

  private showUserLeftMessage(userName: string): void {
    this.userLeftMessage = `${userName} left the room`;
    this.showUserLeftNotification = true;

    // Auto-hide notification after 4 seconds
    setTimeout(() => {
      this.showUserLeftNotification = false;
    }, 4000);
  }

  dismissUserLeftNotification(): void {
    this.showUserLeftNotification = false;
  }
}

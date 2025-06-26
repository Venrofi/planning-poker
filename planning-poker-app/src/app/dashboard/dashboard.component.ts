import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PokerTableComponent } from '../components/poker-table/poker-table.component';
import { CardComponent } from '../components/card/card.component';
import { Participant } from '../models/participant.model';
import { Card } from '../models/cards.model';
import { FirebaseService } from '../services/firebase.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, PokerTableComponent, CardComponent],
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

  participants = signal<Participant[]>([]);

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
      const roomId = params.get('id') || crypto.randomUUID();
      this.roomId.set(roomId);

      if (!params.has('id')) {
        this.router.navigate(['room', roomId]);
        return;
      }

      // Join the room with the current user only
      this.firebaseService.joinRoom(roomId, this.userId(), this.userName()).then(joined => {
        if (!joined) {
          alert('Room is full! Maximum of 10 participants reached.');
          // Could navigate away or show a message
          return;
        }

        this.firebaseService.setupPresence(roomId, this.userId());
        this.firebaseService.cleanupRoom(roomId);

        this.titleSubscription = this.firebaseService.getRoomTitle(roomId).subscribe(title => {
          if (title) {
            this.roomTitle.set(title);
          }
        });

        this.firebaseService.getParticipants(roomId).subscribe(participants => {
          if (participants && participants.length > 0) {
            // Room has participants, update the UI
            this.participants.set(participants);
            const areRevealed = participants.some(p => p.isRevealed);
            this.areCardsRevealed.set(areRevealed);

            const currentUser = participants.find(p => p.id === this.userId());
            if (currentUser) {
              this.selectedCard.set(currentUser.selectedCard as Card | undefined);
            }
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

  copyRoomLink(): void {
    const url = window.location.href;
    navigator.clipboard.writeText(url)
      .then(() => alert('Room link copied to clipboard!'))
      .catch(err => console.error('Failed to copy room link:', err));
  }

  promptForUserName(): void {
    const defaultName = localStorage.getItem('planningPokerUserName') || '';
    const userName = prompt('Enter your name:', defaultName);

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
  }

  ngOnDestroy(): void {
    if (this.titleSubscription) {
      this.titleSubscription.unsubscribe();
    }

    // Remove event listener
    window.removeEventListener('beforeunload', this.boundBeforeUnloadHandler);

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
    // Remove the participant from the room when the window/tab is closed
    this.removeParticipantFromRoom();
  }

  private removeParticipantFromRoom(): void {
    if (this.roomId() && this.userId()) {
      this.firebaseService.removeParticipant(this.roomId(), this.userId())
        .catch(error => console.error('Error removing participant:', error));
    }
  }
}

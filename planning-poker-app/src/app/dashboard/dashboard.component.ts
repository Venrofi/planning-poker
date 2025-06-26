import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PokerTableComponent } from '../components/poker-table/poker-table.component';
import { CardComponent } from '../components/card/card.component';
import { Participant } from '../models/participant.model';
import { Card } from '../models/cards.model';
import { FirebaseService } from '../services/firebase.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, PokerTableComponent, CardComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  roomTitle = signal<string>('Sprint Planning Poker');
  roomId = signal<string>('');
  userId = signal<string>(crypto.randomUUID());
  userName = signal<string>('Radek');

  areCardsRevealed = signal<boolean>(false);
  isRevealInProgress = signal<boolean>(false);

  participants = signal<Participant[]>([]);

  cards = signal<Card[]>(['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '?']);
  selectedCard = signal<Card | undefined>(undefined);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private firebaseService: FirebaseService
  ) { }

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

      // Always join the room with the current user
      this.firebaseService.joinRoom(roomId, this.userId(), this.userName()).then(joined => {
        if (!joined) {
          alert('Room is full! Maximum of 10 participants reached.');
          // Could navigate away or show a message
          return;
        }

        this.firebaseService.setupPresence(roomId, this.userId());
        this.firebaseService.cleanupRoom(roomId);

        this.firebaseService.getParticipants(roomId).subscribe(participants => {
          if (participants && participants.length > 0) {
            // Room already has participants, just update the UI
            this.participants.set(participants);
            const areRevealed = participants.some(p => p.isRevealed);
            this.areCardsRevealed.set(areRevealed);

            const currentUser = participants.find(p => p.id === this.userId());
            if (currentUser) {
              this.selectedCard.set(currentUser.selectedCard as Card | undefined);
            }
          } else {
            // This is a brand new room, initialize with some participants up to max 5
            const initialParticipants = this.initParticipants(4); // 4 virtual + 1 real user = 5 total

            // We've already joined as the current user, so just add the virtual participants
            // Add them one by one and check if we can still add more
            const addVirtualParticipants = async () => {
              for (const p of initialParticipants.filter(p => p.id !== this.userId())) {
                const joined = await this.firebaseService.joinRoom(roomId, p.id, p.name);
                if (!joined) break; // Stop if we can't add more
                if (p.selectedCard) {
                  this.firebaseService.selectCard(roomId, p.id, p.selectedCard);
                }
              }
            };

            addVirtualParticipants();
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

  initParticipants(maxVirtualParticipants: number = 9): Participant[] {
    // Always include the current user
    const userID = this.userId();
    const participants: Participant[] = [{
      id: userID,
      name: this.userName(),
      selectedCard: undefined,
      isRevealed: false
    }];

    // Add virtual participants (up to maxVirtualParticipants or 9 by default)
    const names = ['John', 'Sarah', 'Mike', 'Emma', 'David', 'Alice', 'Bob', 'Charlie', 'Diana'];
    const cards: Card[] = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];

    // Limit the number of additional participants
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
}

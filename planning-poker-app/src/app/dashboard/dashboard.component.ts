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
    this.route.paramMap.subscribe(params => {
      const roomId = params.get('id') || crypto.randomUUID();
      this.roomId.set(roomId);

      if (!params.has('id')) {
        this.router.navigate(['room', roomId]);
        return;
      }

      this.firebaseService.joinRoom(roomId, this.userId(), this.userName());

      this.firebaseService.getParticipants(roomId).subscribe(participants => {
        if (participants && participants.length > 0) {
          this.participants.set(participants);
          const areRevealed = participants.some(p => p.isRevealed);
          this.areCardsRevealed.set(areRevealed);

          const currentUser = participants.find(p => p.id === this.userId());
          if (currentUser) {
            this.selectedCard.set(currentUser.selectedCard as Card | undefined);
          }
        } else {
          const initialParticipants = this.initParticipants();
          initialParticipants.forEach(p => {
            if (p.id === this.userId()) {
              this.firebaseService.joinRoom(roomId, p.id, p.name);
            } else {
              this.firebaseService.joinRoom(roomId, p.id, p.name);
              if (p.selectedCard) {
                this.firebaseService.selectCard(roomId, p.id, p.selectedCard);
              }
            }
          });
        }
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

  initParticipants(): Participant[] {
    const userID = this.userId();
    const participants: Participant[] = [{
      id: userID,
      name: this.userName(),
      selectedCard: undefined,
      isRevealed: false
    }];

    const names = ['John', 'Sarah', 'Mike', 'Emma', 'David', 'Alice', 'Bob', 'Charlie', 'Diana'];
    const cards: Card[] = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];

    names.forEach((name, index) => {
      const randomIndex = Math.floor(Math.random() * cards.length);
      const randomId = crypto.randomUUID();

      participants.push({
        id: randomId,
        name,
        selectedCard: cards[randomIndex],
        isRevealed: false
      });
    });

    return participants;
  }

  copyRoomLink(): void {
    const url = window.location.href;
    navigator.clipboard.writeText(url)
      .then(() => alert('Room link copied to clipboard!'))
      .catch(err => console.error('Failed to copy room link:', err));
  }
}

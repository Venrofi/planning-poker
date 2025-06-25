import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PokerTableComponent } from '../components/poker-table/poker-table.component';
import { CardComponent } from '../components/card/card.component';
import { Participant } from '../models/participant.model';
import { Card } from '../models/cards.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, PokerTableComponent, CardComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  roomTitle = signal<string>('Sprint Planning Poker');

  participants = signal<Participant[]>([
    { id: '1', name: 'John', selectedCard: 'XS', isRevealed: false },
    { id: '2', name: 'Sarah', selectedCard: 'S', isRevealed: false },
    { id: '3', name: 'Mike', selectedCard: 'S', isRevealed: false },
    { id: '4', name: 'Emma', selectedCard: undefined, isRevealed: false },
    { id: '5', name: 'David', selectedCard: '?', isRevealed: false },
    { id: '6', name: 'Alice', selectedCard: undefined, isRevealed: false },
    { id: '7', name: 'Bob', selectedCard: undefined, isRevealed: false },
    { id: '8', name: 'Charlie', selectedCard: undefined, isRevealed: false },
    { id: '9', name: 'Diana', selectedCard: undefined, isRevealed: false },
    { id: '10', name: 'Ethan', selectedCard: undefined, isRevealed: false }
  ]);

  cards = signal<Card[]>(['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '?']);
  selectedCard = signal<Card | undefined>(undefined);
  areCardsRevealed = signal<boolean>(false);

  selectCard(card: Card): void {
    this.selectedCard.set(card);

    // Update current user's card (assuming user ID 1 for simplicity)
    this.participants.update(participants =>
      participants.map(p =>
        p.id === '1' ? { ...p, selectedCard: card } : p
      )
    );
  }

  toggleReveal(): void {
    const newRevealState = !this.areCardsRevealed();
    this.areCardsRevealed.set(newRevealState);

    // Update all participants' reveal state
    this.participants.update(participants =>
      participants.map(p => ({ ...p, isRevealed: newRevealState }))
    );
  }

  resetCards(): void {
    this.selectedCard.set(undefined);
    this.areCardsRevealed.set(false);

    // Reset all participants
    this.participants.update(participants =>
      participants.map(p => ({ ...p, selectedCard: undefined, isRevealed: false }))
    );
  }
}

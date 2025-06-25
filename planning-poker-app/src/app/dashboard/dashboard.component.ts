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
    { id: '1', name: 'John', selectedCard: undefined, isRevealed: false },
    { id: '2', name: 'Sarah', selectedCard: 'S', isRevealed: false },
    { id: '3', name: 'Mike', selectedCard: 'S', isRevealed: false },
    { id: '4', name: 'Emma', selectedCard: 'XS', isRevealed: false },
    { id: '5', name: 'David', selectedCard: '?', isRevealed: false },
    { id: '6', name: 'Alice', selectedCard: 'S', isRevealed: false },
    { id: '7', name: 'Bob', selectedCard: 'M', isRevealed: false },
    { id: '8', name: 'Charlie', selectedCard: 'XS', isRevealed: false },
    { id: '9', name: 'Diana', selectedCard: 'M', isRevealed: false },
    { id: '10', name: 'Ethan', selectedCard: 'XXS', isRevealed: false }
  ]);
  cards = signal<Card[]>(['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '?']);
  selectedCard = signal<Card | undefined>(undefined);

  updateParticipants(updatedParticipants: Participant[]): void {
    // Check if we're resetting cards
    const isReset = updatedParticipants.every(p => !p.selectedCard && !p.isRevealed);
    if (isReset) {
      this.selectedCard.set(undefined);
    }

    this.participants.set(updatedParticipants);
  }

  selectCard(card: Card): void {
    this.selectedCard.set(card);

    // Update current user's card (assuming user ID 1 for simplicity)
    this.participants.update(participants =>
      participants.map(p =>
        p.id === '1' ? { ...p, selectedCard: card } : p
      )
    );
  }
}

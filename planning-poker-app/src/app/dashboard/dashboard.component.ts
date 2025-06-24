import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PokerTableComponent } from '../components/poker-table/poker-table.component';
import { CardComponent } from '../components/card/card.component';
import { Participant } from '../models/participant.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, PokerTableComponent, CardComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  roomTitle = signal<string>('Sprint Planning Poker');
  participants = signal<Participant[]>([
    { id: '1', name: 'John', selectedCard: '3', isRevealed: false },
    { id: '2', name: 'Sarah', selectedCard: '5', isRevealed: false },
    { id: '3', name: 'Mike', selectedCard: '8', isRevealed: false },
    { id: '4', name: 'Emma', selectedCard: undefined, isRevealed: false },
    { id: '5', name: 'David', selectedCard: '13', isRevealed: false }
  ]);
  cards = signal<string[]>(['1', '2', '3', '5', '8', '13', '21', '?']);
  selectedCard = signal<string | undefined>(undefined);
  areCardsRevealed = signal<boolean>(false);

  selectCard(card: string): void {
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

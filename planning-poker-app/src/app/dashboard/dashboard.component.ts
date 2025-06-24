import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PokerTableComponent } from '../components/poker-table/poker-table.component';
import { CardComponent } from '../components/card/card.component';
import { Participant } from '../models/participant.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, PokerTableComponent, CardComponent],
  template: `
    <div class="dashboard">
      <header class="header">
        <h1>{{ roomTitle() }}</h1>
      </header>

      <main>
        <app-poker-table [participants]="participants()"></app-poker-table>
      </main>

      <section class="card-selection">
        <h2>Your Cards</h2>
        <div class="cards">
          @for (card of cards(); track card) {
            <app-card
              [value]="card"
              [selected]="selectedCard() === card"
              (click)="selectCard(card)"
            ></app-card>
          }
        </div>
      </section>

      <section class="controls">
        <button class="reveal-btn" (click)="toggleReveal()">
          {{ areCardsRevealed() ? 'Hide Cards' : 'Reveal Cards' }}
        </button>
        <button class="reset-btn" (click)="resetCards()">Reset</button>
      </section>
    </div>
  `,
  styles: `
    .dashboard {
      min-height: 100vh;
      padding: 20px;
      background: linear-gradient(135deg, #f5f7fa, #c3cfe2);
      display: flex;
      flex-direction: column;
    }

    .header {
      text-align: center;
      margin-bottom: 20px;
    }

    h1 {
      font-size: 32px;
      font-weight: 700;
      color: #333;
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(10px);
      padding: 15px 20px;
      border-radius: 15px;
      display: inline-block;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    main {
      flex-grow: 1;
    }

    .card-selection {
      margin-top: 30px;
      background: rgba(255, 255, 255, 0.3);
      backdrop-filter: blur(10px);
      padding: 20px;
      border-radius: 15px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
    }

    h2 {
      font-size: 20px;
      margin-bottom: 15px;
      color: #444;
    }

    .cards {
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
      justify-content: center;
    }

    .controls {
      display: flex;
      justify-content: center;
      gap: 20px;
      margin-top: 30px;
      padding-bottom: 20px;
    }

    button {
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .reveal-btn {
      background: rgba(79, 70, 229, 0.9);
      color: white;
      backdrop-filter: blur(5px);
    }

    .reset-btn {
      background: rgba(255, 255, 255, 0.8);
      color: #333;
      backdrop-filter: blur(5px);
    }

    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 8px rgba(0, 0, 0, 0.15);
    }
  `
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

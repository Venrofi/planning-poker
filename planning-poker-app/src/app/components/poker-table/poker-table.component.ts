import { Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ParticipantComponent } from '../participant/participant.component';
import { Participant } from '../../models/participant.model';

@Component({
  selector: 'app-poker-table',
  standalone: true,
  imports: [CommonModule, ParticipantComponent],
  templateUrl: './poker-table.component.html',
  styleUrl: './poker-table.component.scss'
})
export class PokerTableComponent {
  private readonly COUNTDOWN_SECONDS = 3;

  participants = input.required<Participant[]>();

  areCardsRevealed = signal<boolean>(false);
  isCountingDown = signal<boolean>(false);
  countdownValue = signal<string>(this.COUNTDOWN_SECONDS.toString());
  winningCard = computed(() => this.calculateWinningCard());

  participantsChange = output<Participant[]>();
  isRevealInProgressChange = output<boolean>();

  startCountdown(): void {
    if (this.areCardsRevealed()) {
      this.toggleReveal();
      return;
    }

    this.isCountingDown.set(true);
    this.isRevealInProgressChange.emit(true);
    this.asyncCountdown();
  }
  private async asyncCountdown(): Promise<void> {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = this.COUNTDOWN_SECONDS; i > 0; i--) {
      this.countdownValue.set(i.toString());
      await delay(800);
    }

    this.countdownValue.set('Reveal!');
    await delay(500);

    this.isCountingDown.set(false);
    this.isRevealInProgressChange.emit(false);
    this.toggleReveal();
  }

  toggleReveal(): void {
    const newRevealState = !this.areCardsRevealed();
    this.areCardsRevealed.set(newRevealState);

    const updatedParticipants = this.participants().map(p => ({ ...p, isRevealed: newRevealState }));
    this.participantsChange.emit(updatedParticipants);
  }

  resetCards(): void {
    this.areCardsRevealed.set(false);
    this.isCountingDown.set(false);
    this.isRevealInProgressChange.emit(false);

    const resetParticipants = this.participants().map(p => ({
      ...p,
      selectedCard: undefined,
      isRevealed: false
    }));
    this.participantsChange.emit(resetParticipants);
  }

  private calculateWinningCard(): string | undefined {
    if (!this.areCardsRevealed()) {
      return undefined;
    }

    const participants = this.participants();

    const cardCounts = participants
      .filter(p => p.selectedCard !== undefined)
      .reduce((counts, participant) => {
        const card = participant.selectedCard!;
        counts[card] = (counts[card] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);

    if (Object.keys(cardCounts).length === 0) {
      return undefined;
    }

    let maxCount = 0;
    let winners: string[] = [];

    for (const [card, count] of Object.entries(cardCounts)) {
      if (count > maxCount) {
        maxCount = count;
        winners = [card];
      } else if (count === maxCount) {
        winners.push(card);
      }
    }

    if (winners.length > 1) {
      return `${winners.join(' / ')} (${maxCount} votes each)`;
    } else {
      return `${winners[0]} (${maxCount} vote${maxCount !== 1 ? 's' : ''})`;
    }
  }
}

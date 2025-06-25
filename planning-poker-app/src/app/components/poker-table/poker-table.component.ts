import { Component, input, output, signal } from '@angular/core';
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

  participantsChange = output<Participant[]>();

  startCountdown(): void {
    if (this.areCardsRevealed()) {
      this.toggleReveal();
      return;
    }

    this.isCountingDown.set(true);
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

    const resetParticipants = this.participants().map(p => ({
      ...p,
      selectedCard: undefined,
      isRevealed: false
    }));
    this.participantsChange.emit(resetParticipants);
  }
}

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
  participants = input.required<Participant[]>();

  areCardsRevealed = signal<boolean>(false);

  participantsChange = output<Participant[]>();

  toggleReveal(): void {
    const newRevealState = !this.areCardsRevealed();
    this.areCardsRevealed.set(newRevealState);

    const updatedParticipants = this.participants().map(p => ({ ...p, isRevealed: newRevealState }));
    this.participantsChange.emit(updatedParticipants);
  }

  resetCards(): void {
    this.areCardsRevealed.set(false);

    const resetParticipants = this.participants().map(p => ({
      ...p,
      selectedCard: undefined,
      isRevealed: false
    }));
    this.participantsChange.emit(resetParticipants);
  }
}

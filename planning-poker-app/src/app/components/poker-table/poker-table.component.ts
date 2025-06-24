import { Component, input } from '@angular/core';
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

  getPosition(id: string): number {
    const index = this.participants().findIndex(p => p.id === id);
    const totalParticipants = this.participants().length;
    if (totalParticipants <= 1) return 0;
    return (360 / totalParticipants) * index;
  }
}

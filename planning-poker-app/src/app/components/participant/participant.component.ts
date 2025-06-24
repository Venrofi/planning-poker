import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent } from '../card/card.component';
import { Participant } from '../../models/participant.model';

@Component({
  selector: 'app-participant',
  standalone: true,
  imports: [CommonModule, CardComponent],
  template: `
    <div class="participant">
      <app-card
        [value]="participant().selectedCard || '?'"
        [revealed]="participant().isRevealed"
        [selected]="!!participant().selectedCard"
      ></app-card>
      <div class="participant-name">{{ participant().name }}</div>
    </div>
  `,
  styles: `
    .participant {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }

    .participant-name {
      background: rgba(255, 255, 255, 0.6);
      backdrop-filter: blur(5px);
      padding: 5px 10px;
      border-radius: 15px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
  `
})
export class ParticipantComponent {
  participant = input.required<Participant>();
}

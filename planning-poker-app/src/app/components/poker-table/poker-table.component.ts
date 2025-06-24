import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ParticipantComponent } from '../participant/participant.component';
import { Participant } from '../../models/participant.model';

@Component({
  selector: 'app-poker-table',
  standalone: true,
  imports: [CommonModule, ParticipantComponent],
  template: `
    <div class="table-container">
      <div class="poker-table">
        <div class="participants">
          @for (participant of participants(); track participant.id) {
            <div class="participant-position" [style.--rotate]="getPosition(participant.id)">
              <app-participant [participant]="participant"></app-participant>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .table-container {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }

    .poker-table {
      width: 600px;
      height: 400px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 300px / 200px;
      backdrop-filter: blur(15px);
      box-shadow:
        0 10px 30px rgba(0, 0, 0, 0.1),
        inset 0 0 20px rgba(255, 255, 255, 0.5);
      position: relative;
      border: 1px solid rgba(255, 255, 255, 0.3);
      overflow: visible;
    }

    .participants {
      position: absolute;
      width: 100%;
      height: 100%;
    }

    .participant-position {
      position: absolute;
      top: 50%;
      left: 50%;
      transform-origin: 0 -180px;
      transform: rotate(calc(var(--rotate) * 1deg)) translateX(-50%);
    }
  `
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

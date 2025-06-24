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
}

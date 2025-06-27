import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PokerCardComponent } from '../poker-card/poker-card.component';
import { Participant } from '../../models/participant.model';

@Component({
  selector: 'app-participant',
  standalone: true,
  imports: [CommonModule, PokerCardComponent],
  templateUrl: './participant.component.html',
  styleUrl: './participant.component.scss'
})
export class ParticipantComponent {
  participant = input.required<Participant>();
}

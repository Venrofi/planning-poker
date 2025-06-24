import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent } from '../card/card.component';
import { Participant } from '../../models/participant.model';

@Component({
  selector: 'app-participant',
  standalone: true,
  imports: [CommonModule, CardComponent],
  templateUrl: './participant.component.html',
  styleUrl: './participant.component.scss'
})
export class ParticipantComponent {
  participant = input.required<Participant>();
}

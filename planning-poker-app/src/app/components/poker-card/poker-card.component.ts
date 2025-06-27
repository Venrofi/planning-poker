import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Card } from '../../models/cards.model';

@Component({
  selector: 'app-poker-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './poker-card.component.html',
  styleUrls: ['./poker-card.component.scss']
})
export class PokerCardComponent {
  value = input<Card>('?');
  selected = input<boolean>(false);
  revealed = input<boolean>(false);
  disabled = input<boolean>(false);
}

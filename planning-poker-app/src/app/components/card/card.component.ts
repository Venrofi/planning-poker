import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Card } from '../../models/cards.model';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './card.component.html',
  styleUrls: ['./card.component.scss']
})
export class CardComponent {
  value = input<Card>('?');
  selected = input<boolean>(false);
  revealed = input<boolean>(false);
}

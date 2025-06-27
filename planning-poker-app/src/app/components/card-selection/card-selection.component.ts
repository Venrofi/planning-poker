import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PokerCardComponent } from '../poker-card/poker-card.component';
import { Card } from '../../models/cards.model';

@Component({
  selector: 'app-card-selection',
  standalone: true,
  imports: [CommonModule, PokerCardComponent],
  templateUrl: './card-selection.component.html',
  styleUrls: ['./card-selection.component.scss']
})
export class CardSelectionComponent {
  cards = input.required<Card[]>();
  selectedCard = input<Card | undefined>();
  isDisabled = input<boolean>(false);
  cardClick = output<Card>();

  headerText = computed(() =>
    this.isDisabled() ? 'Cards Locked' : 'Pick a Card!'
  );

  onCardClick(card: Card): void {
    if (!this.isDisabled()) {
      this.cardClick.emit(card);
    }
  }
}

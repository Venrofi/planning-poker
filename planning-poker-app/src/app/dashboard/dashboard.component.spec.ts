import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardComponent } from './dashboard.component';
import { PokerTableComponent } from '../components/poker-table/poker-table.component';
import { CardComponent } from '../components/card/card.component';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Participant } from '../models/participant.model';
import { Card } from '../models/cards.model';
import { By } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';

// Mock Components
@Component({
  selector: 'app-poker-table',
  template: '<div data-testid="poker-table"></div>'
})
class MockPokerTableComponent {
  @Input() participants: Participant[] = [];
  @Output() participantsChange = new EventEmitter<Participant[]>();
  @Output() isRevealInProgressChange = new EventEmitter<boolean>();
}

@Component({
  selector: 'app-card',
  template: '<div data-testid="card"></div>'
})
class MockCardComponent {
  @Input() value: Card = '?';
  @Input() selected = false;
  @Input() revealed = false;
  @Input() disabled = false;
}

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormsModule, DashboardComponent],
      providers: [],
    })
      .overrideComponent(DashboardComponent, {
        remove: { imports: [PokerTableComponent, CardComponent] },
        add: { imports: [MockPokerTableComponent, MockCardComponent] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Initial State', () => {
    it('should have default room title', () => {
      expect(component.roomTitle()).toBe('Sprint Planning Poker');
    });

    it('should initialize with cards not revealed', () => {
      expect(component.areCardsRevealed()).toBeFalse();
    });

    it('should initialize with reveal not in progress', () => {
      expect(component.isRevealInProgress()).toBeFalse();
    });

    it('should initialize with participants', () => {
      expect(component.participants().length).toBe(10);
    });

    it('should initialize with card options', () => {
      expect(component.cards().length).toBe(8);
      expect(component.cards()).toContain('S');
      expect(component.cards()).toContain('?');
    });

    it('should initialize with no selected card', () => {
      expect(component.selectedCard()).toBeUndefined();
    });
  });

  describe('Room Title', () => {
    it('should update room title when input changes', () => {
      const titleInput = fixture.debugElement.query(By.css('.title-input')).nativeElement;
      titleInput.value = 'New Room Title';
      titleInput.dispatchEvent(new Event('input'));

      expect(component.roomTitle()).toBe('New Room Title');
    });
  });

  describe('Card Selection', () => {
    it('should select a card when clicked', () => {
      component.handleCardClick('M');
      expect(component.selectedCard()).toBe('M');

      // Check that the participant's card was updated
      const updatedParticipant = component.participants().find(p => p.id === '1');
      expect(updatedParticipant?.selectedCard).toBe('M');
    });

    it('should not select a card when cards are revealed', () => {
      // Setup revealed state
      component.areCardsRevealed.set(true);

      component.handleCardClick('M');
      expect(component.selectedCard()).toBeUndefined();
    });

    it('should not select a card when reveal is in progress', () => {
      // Setup reveal in progress state
      component.isRevealInProgress.set(true);

      component.handleCardClick('M');
      expect(component.selectedCard()).toBeUndefined();
    });
  });

  describe('Participant Updates', () => {
    it('should update participants', () => {
      const newParticipants: Participant[] = [
        { id: '1', name: 'John', selectedCard: 'XL', isRevealed: false }
      ];

      component.updateParticipants(newParticipants);
      expect(component.participants().length).toBe(1);
      expect(component.participants()[0].selectedCard).toBe('XL');
    });

    it('should reset state when all participants are reset', () => {
      // First, set some state
      component.selectedCard.set('M');
      component.areCardsRevealed.set(true);
      component.isRevealInProgress.set(true);

      // Then reset all participants
      const resetParticipants = component.participants().map(p => ({
        ...p,
        selectedCard: undefined,
        isRevealed: false
      }));

      component.updateParticipants(resetParticipants);

      expect(component.selectedCard()).toBeUndefined();
      expect(component.areCardsRevealed()).toBeFalse();
      expect(component.isRevealInProgress()).toBeFalse();
    });

    it('should update areCardsRevealed when participants are revealed', () => {
      // Update participants with some revealed
      const updatedParticipants = component.participants().map(p => ({
        ...p,
        isRevealed: true
      }));

      component.updateParticipants(updatedParticipants);
      expect(component.areCardsRevealed()).toBeTrue();
    });
  });

  describe('Component Integration', () => {
    it('should update isRevealInProgress when poker table emits the event', () => {
      const pokerTable = fixture.debugElement.query(By.directive(MockPokerTableComponent))
        .componentInstance as MockPokerTableComponent;

      pokerTable.isRevealInProgressChange.emit(true);
      expect(component.isRevealInProgress()).toBeTrue();

      pokerTable.isRevealInProgressChange.emit(false);
      expect(component.isRevealInProgress()).toBeFalse();
    });

    it('should update participants when poker table emits new participants', () => {
      const pokerTable = fixture.debugElement.query(By.directive(MockPokerTableComponent))
        .componentInstance as MockPokerTableComponent;

      const newParticipants: Participant[] = [
        { id: '1', name: 'John', selectedCard: 'XXL', isRevealed: true }
      ];

      pokerTable.participantsChange.emit(newParticipants);
      expect(component.participants().length).toBe(1);
      expect(component.participants()[0].selectedCard).toBe('XXL');
      expect(component.areCardsRevealed()).toBeTrue();
    });
  });

  describe('Template Rendering', () => {
    it('should display "Cards Locked" when cards are revealed', () => {
      component.areCardsRevealed.set(true);
      fixture.detectChanges();

      const headerText = fixture.debugElement.query(By.css('.card-selection-header')).nativeElement.textContent;
      expect(headerText.trim()).toBe('Cards Locked');
    });

    it('should display "Cards Locked" when reveal is in progress', () => {
      component.isRevealInProgress.set(true);
      fixture.detectChanges();

      const headerText = fixture.debugElement.query(By.css('.card-selection-header')).nativeElement.textContent;
      expect(headerText.trim()).toBe('Cards Locked');
    });

    it('should display "Pick a Card!" when cards are not revealed and reveal is not in progress', () => {
      component.areCardsRevealed.set(false);
      component.isRevealInProgress.set(false);
      fixture.detectChanges();

      const headerText = fixture.debugElement.query(By.css('.card-selection-header')).nativeElement.textContent;
      expect(headerText.trim()).toBe('Pick a Card!');
    });

    it('should render the correct number of card options', () => {
      const cardElements = fixture.debugElement.queryAll(By.directive(MockCardComponent));
      expect(cardElements.length).toBe(component.cards().length);
    });

    it('should apply disabled class to cards when revealed', () => {
      component.areCardsRevealed.set(true);
      fixture.detectChanges();

      const cardsContainer = fixture.debugElement.query(By.css('.cards'));
      expect(cardsContainer.classes['disabled']).toBeTrue();
    });
  });
});

import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { PokerTableComponent } from './poker-table.component';
import { ParticipantComponent } from '../participant/participant.component';
import { Component, Input } from '@angular/core';
import { Participant } from '../../models/participant.model';
import { By } from '@angular/platform-browser';

// Mock the ParticipantComponent
@Component({
  selector: 'app-participant',
  template: '<div data-testid="participant"></div>'
})
class MockParticipantComponent {
  @Input() participant!: Participant;
}

describe('PokerTableComponent', () => {
  let component: PokerTableComponent;
  let fixture: ComponentFixture<PokerTableComponent>;

  // Setup mock data
  const mockParticipants: Participant[] = [
    { id: '1', name: 'John', selectedCard: 'M', isRevealed: false },
    { id: '2', name: 'Jane', selectedCard: 'S', isRevealed: false }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PokerTableComponent],
    })
      .overrideComponent(PokerTableComponent, {
        remove: { imports: [ParticipantComponent] },
        add: { imports: [MockParticipantComponent] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(PokerTableComponent);
    component = fixture.componentInstance;

    // Mock the participants input for testing
    Object.defineProperty(component, 'participants', {
      get: () => () => mockParticipants
    });

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Winning Card Calculation', () => {
    it('should return undefined when cards are not revealed', () => {
      component.areCardsRevealed.set(false);
      fixture.detectChanges();

      expect(component.winningCard()).toBeUndefined();
    });

    it('should identify the winning card when there is a single winner', () => {
      // Setup: make all participants have the same card 'M' except one with 'S'
      const participantsWithWinner: Participant[] = [
        { id: '1', name: 'John', selectedCard: 'M', isRevealed: true },
        { id: '2', name: 'Jane', selectedCard: 'M', isRevealed: true },
        { id: '3', name: 'Bob', selectedCard: 'M', isRevealed: true },
        { id: '4', name: 'Alice', selectedCard: 'S', isRevealed: true }
      ];

      // Override the participants getter
      Object.defineProperty(component, 'participants', {
        get: () => () => participantsWithWinner
      });

      component.areCardsRevealed.set(true);
      fixture.detectChanges();

      // M should win with 3 votes
      expect(component.winningCard()).toContain('M');
      expect(component.winningCard()).toContain('3 votes');
    });

    it('should identify multiple winners in case of a tie', () => {
      // Setup: make tie between 'M' and 'S'
      const participantsWithTie: Participant[] = [
        { id: '1', name: 'John', selectedCard: 'M', isRevealed: true },
        { id: '2', name: 'Jane', selectedCard: 'M', isRevealed: true },
        { id: '3', name: 'Bob', selectedCard: 'S', isRevealed: true },
        { id: '4', name: 'Alice', selectedCard: 'S', isRevealed: true }
      ];

      // Override the participants getter
      Object.defineProperty(component, 'participants', {
        get: () => () => participantsWithTie
      });

      component.areCardsRevealed.set(true);
      fixture.detectChanges();

      // Should mention both M and S
      expect(component.winningCard()).toContain('M / S');
      expect(component.winningCard()).toContain('2 votes each');
    });

    it('should handle participants with undefined cards', () => {
      // Setup: some participants have not selected cards
      const participantsWithUndefined: Participant[] = [
        { id: '1', name: 'John', selectedCard: 'M', isRevealed: true },
        { id: '2', name: 'Jane', selectedCard: undefined, isRevealed: true },
        { id: '3', name: 'Bob', selectedCard: 'S', isRevealed: true },
        { id: '4', name: 'Alice', selectedCard: undefined, isRevealed: true }
      ];

      // Override the participants getter
      Object.defineProperty(component, 'participants', {
        get: () => () => participantsWithUndefined
      });

      component.areCardsRevealed.set(true);
      fixture.detectChanges();

      // M and S should each have 1 vote, resulting in a tie
      expect(component.winningCard()).toContain('M / S');
      expect(component.winningCard()).toContain('1 vote each');
    });
  });

  describe('UI Display', () => {
    it('should not display winner when cards are not revealed', () => {
      component.areCardsRevealed.set(false);
      fixture.detectChanges();

      const winnerElement = fixture.debugElement.query(By.css('.winning-card'));
      expect(winnerElement).toBeFalsy();
    });

    it('should display winner when cards are revealed', () => {
      component.areCardsRevealed.set(true);
      fixture.detectChanges();

      const winnerElement = fixture.debugElement.query(By.css('.winning-card'));
      expect(winnerElement).toBeTruthy();

      const winnerLabel = fixture.debugElement.query(By.css('.winner-label'));
      expect(winnerLabel.nativeElement.textContent).toContain('Winner');

      const winnerValue = fixture.debugElement.query(By.css('.winner-value'));
      expect(winnerValue).toBeTruthy();
    });
  });
});

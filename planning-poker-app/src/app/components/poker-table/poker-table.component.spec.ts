import { Component, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Participant } from '../../models/participant.model';
import { ParticipantComponent } from '../participant/participant.component';
import { PokerTableComponent } from './poker-table.component';

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
      const participantsWithWinner: Participant[] = [
        { id: '1', name: 'John', selectedCard: 'M', isRevealed: true },
        { id: '2', name: 'Jane', selectedCard: 'M', isRevealed: true },
        { id: '3', name: 'Bob', selectedCard: 'M', isRevealed: true },
        { id: '4', name: 'Alice', selectedCard: 'S', isRevealed: true }
      ];

      Object.defineProperty(component, 'participants', {
        get: () => () => participantsWithWinner
      });

      component.areCardsRevealed.set(true);
      fixture.detectChanges();

      expect(component.winningCard()).toContain('M');
      expect(component.winningCard()).toContain('3 votes');
    });

    it('should identify multiple winners in case of a tie', () => {
      const participantsWithTie: Participant[] = [
        { id: '1', name: 'John', selectedCard: 'M', isRevealed: true },
        { id: '2', name: 'Jane', selectedCard: 'M', isRevealed: true },
        { id: '3', name: 'Bob', selectedCard: 'S', isRevealed: true },
        { id: '4', name: 'Alice', selectedCard: 'S', isRevealed: true }
      ];

      Object.defineProperty(component, 'participants', {
        get: () => () => participantsWithTie
      });

      component.areCardsRevealed.set(true);
      fixture.detectChanges();

      expect(component.winningCard()).toContain('M / S');
      expect(component.winningCard()).toContain('2 votes each');
    });

    it('should handle participants with undefined cards', () => {
      const participantsWithUndefined: Participant[] = [
        { id: '1', name: 'John', selectedCard: 'M', isRevealed: true },
        { id: '2', name: 'Jane', selectedCard: undefined, isRevealed: true },
        { id: '3', name: 'Bob', selectedCard: 'S', isRevealed: true },
        { id: '4', name: 'Alice', selectedCard: undefined, isRevealed: true }
      ];

      Object.defineProperty(component, 'participants', {
        get: () => () => participantsWithUndefined
      });

      component.areCardsRevealed.set(true);
      fixture.detectChanges();

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

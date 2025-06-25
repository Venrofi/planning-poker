import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CardComponent } from './card.component';
import { By } from '@angular/platform-browser';
import { Card } from '../../models/cards.model';

describe('CardComponent', () => {
  let component: CardComponent;
  let fixture: ComponentFixture<CardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CardComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(CardComponent);
    component = fixture.componentInstance;

    // Set default values for testing using the defineProperty approach for Angular v20 input signals
    Object.defineProperty(component, 'value', {
      get: () => () => 'M' as Card
    });
    Object.defineProperty(component, 'selected', {
      get: () => () => false
    });
    Object.defineProperty(component, 'revealed', {
      get: () => () => false
    });
    Object.defineProperty(component, 'disabled', {
      get: () => () => false
    });

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Input Properties', () => {
    it('should display the correct card value', () => {
      // Update the value input
      Object.defineProperty(component, 'value', {
        get: () => () => 'XL' as Card
      });
      fixture.detectChanges();

      const cardValue = fixture.debugElement.query(By.css('.card-value')).nativeElement;
      expect(cardValue.textContent).toBe('XL');
    });

    it('should apply selected class when selected is true', () => {
      // First check with selected=false
      Object.defineProperty(component, 'selected', {
        get: () => () => false
      });
      fixture.detectChanges();
      let card = fixture.debugElement.query(By.css('.card'));
      expect(card.classes['selected']).toBeFalsy();

      // Then check with selected=true
      Object.defineProperty(component, 'selected', {
        get: () => () => true
      });
      fixture.detectChanges();
      card = fixture.debugElement.query(By.css('.card'));
      expect(card.classes['selected']).toBeTruthy();
    });

    it('should apply revealed class when revealed is true', () => {
      // First check with revealed=false
      Object.defineProperty(component, 'revealed', {
        get: () => () => false
      });
      fixture.detectChanges();
      let card = fixture.debugElement.query(By.css('.card'));
      expect(card.classes['revealed']).toBeFalsy();

      // Then check with revealed=true
      Object.defineProperty(component, 'revealed', {
        get: () => () => true
      });
      fixture.detectChanges();
      card = fixture.debugElement.query(By.css('.card'));
      expect(card.classes['revealed']).toBeTruthy();
    });

    it('should apply disabled class when disabled is true', () => {
      // First check with disabled=false
      Object.defineProperty(component, 'disabled', {
        get: () => () => false
      });
      fixture.detectChanges();
      let card = fixture.debugElement.query(By.css('.card'));
      expect(card.classes['disabled']).toBeFalsy();

      // Then check with disabled=true
      Object.defineProperty(component, 'disabled', {
        get: () => () => true
      });
      fixture.detectChanges();
      card = fixture.debugElement.query(By.css('.card'));
      expect(card.classes['disabled']).toBeTruthy();
    });
  });

  describe('Card Appearance', () => {
    it('should have front and back faces', () => {
      const frontFace = fixture.debugElement.query(By.css('.card-front'));
      const backFace = fixture.debugElement.query(By.css('.card-back'));

      expect(frontFace).toBeTruthy();
      expect(backFace).toBeTruthy();
    });

    it('should have a card pattern on the back face', () => {
      const pattern = fixture.debugElement.query(By.css('.card-pattern'));
      expect(pattern).toBeTruthy();
    });
  });

  describe('Interaction States', () => {
    it('should rotate card when revealed', () => {
      Object.defineProperty(component, 'revealed', {
        get: () => () => true
      });
      fixture.detectChanges();

      const card = fixture.debugElement.query(By.css('.card'));
      expect(card.classes['revealed']).toBeTrue();
    });
  });
});

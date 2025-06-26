import { Component, computed, inject, input, output, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ParticipantComponent } from '../participant/participant.component';
import { Participant } from '../../models/participant.model';
import { FirebaseService } from '../../services/firebase.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-poker-table',
  standalone: true,
  imports: [CommonModule, ParticipantComponent],
  templateUrl: './poker-table.component.html',
  styleUrl: './poker-table.component.scss'
})
export class PokerTableComponent implements OnInit, OnDestroy {
  private readonly COUNTDOWN_SECONDS = 3;
  private firebaseService = inject(FirebaseService);
  private countdownSubscription: Subscription | null = null;
  private resetSubscription: Subscription | null = null;
  private revealedStateSubscription: Subscription | null = null;

  participants = input.required<Participant[]>();
  roomId = input.required<string>();
  currentUserId = input.required<string>();

  areCardsRevealed = signal<boolean>(false);
  isCountingDown = signal<boolean>(false);
  countdownValue = signal<string>(this.COUNTDOWN_SECONDS.toString());
  winningCard = computed(() => this.calculateWinningCard());
  countdownStartedBy = signal<string | null>(null);
  resetInitiatedBy = signal<string | null>(null);
  isResetting = signal<boolean>(false);

  participantsChange = output<Participant[]>();
  isRevealInProgressChange = output<boolean>();

  startCountdown(): void {
    if (this.areCardsRevealed()) {
      this.toggleReveal();
      return;
    }

    if (this.isCountingDown()) {
      return;
    }

    this.countdownStartedBy.set(this.currentUserId());
    this.isCountingDown.set(true);
    this.isRevealInProgressChange.emit(true);

    this.firebaseService.startCountdown(this.roomId(), this.currentUserId());

    this.asyncCountdown();
  }

  private async asyncCountdown(): Promise<void> {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = this.COUNTDOWN_SECONDS; i > 0; i--) {
      this.countdownValue.set(i.toString());
      await delay(800);
    }

    this.countdownValue.set('Reveal!');
    await delay(500);

    this.isCountingDown.set(false);
    this.isRevealInProgressChange.emit(false);

    if (this.countdownStartedBy() === this.currentUserId()) {
      this.firebaseService.endCountdown(this.roomId());
    }

    this.toggleReveal();
  }

  toggleReveal(): void {
    const newRevealState = !this.areCardsRevealed();

    // Update Firebase state - this will trigger updates for all participants
    // Allow any user to hide cards once they're revealed, but only the countdown starter can reveal
    const canUpdateState = this.countdownStartedBy() === this.currentUserId() ||
      this.countdownStartedBy() === null ||
      (this.areCardsRevealed() && !newRevealState); // Allow any user to hide cards

    if (canUpdateState) {
      this.firebaseService.setRevealState(this.roomId(), newRevealState);
    }

    // Set local state immediately for the user who triggered the action
    this.areCardsRevealed.set(newRevealState);

    // Clear countdown starter when hiding cards so any user can start a new reveal
    if (!newRevealState) {
      this.countdownStartedBy.set(null);
    }
  }

  resetCards(): void {
    this.areCardsRevealed.set(false);
    this.isCountingDown.set(false);
    this.countdownStartedBy.set(null);
    this.isRevealInProgressChange.emit(false);
    this.isResetting.set(true);
    this.resetInitiatedBy.set(this.currentUserId());

    this.firebaseService.initiateReset(this.roomId(), this.currentUserId())
      .then(() => {
        return this.firebaseService.endCountdown(this.roomId());
      })
      .then(() => {
        const resetParticipants = this.participants().map(p => ({
          ...p,
          selectedCard: undefined,
          isRevealed: false
        }));
        this.participantsChange.emit(resetParticipants);

        setTimeout(() => {
          this.isResetting.set(false);
          this.resetInitiatedBy.set(null);
          this.firebaseService.clearResetState(this.roomId());
        }, 1000);
      });
  }

  private calculateWinningCard(): string | undefined {
    if (!this.areCardsRevealed()) {
      return undefined;
    }

    const participants = this.participants();

    const cardCounts = participants
      .filter(p => p.selectedCard !== undefined)
      .reduce((counts, participant) => {
        const card = participant.selectedCard!;
        counts[card] = (counts[card] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);

    if (Object.keys(cardCounts).length === 0) {
      return undefined;
    }

    let maxCount = 0;
    let winners: string[] = [];

    for (const [card, count] of Object.entries(cardCounts)) {
      if (count > maxCount) {
        maxCount = count;
        winners = [card];
      } else if (count === maxCount) {
        winners.push(card);
      }
    }

    if (winners.length > 1) {
      return `${winners.join(' / ')} (${maxCount} votes each)`;
    } else {
      return `${winners[0]} (${maxCount} vote${maxCount !== 1 ? 's' : ''})`;
    }
  }

  // Helper method to get participant name from ID
  getParticipantName(userId: string | null): string {
    if (!userId) return 'Unknown';

    const participant = this.participants().find(p => p.id === userId);
    return participant ? participant.name : 'Someone';
  }

  ngOnInit(): void {
    this.countdownSubscription = this.firebaseService.getCountdownState(this.roomId()).subscribe(countdownState => {
      if (countdownState.isActive && !this.isCountingDown()) {
        this.countdownStartedBy.set(countdownState.startedBy);
        this.isCountingDown.set(true);
        this.isRevealInProgressChange.emit(true);
        this.asyncCountdown();
      }
    });

    this.resetSubscription = this.firebaseService.getResetState(this.roomId()).subscribe(resetState => {
      if (resetState.isActive && resetState.initiatedBy !== this.currentUserId()) {
        this.resetInitiatedBy.set(resetState.initiatedBy);
        this.isResetting.set(true);

        this.areCardsRevealed.set(false);
        this.isCountingDown.set(false);
        this.countdownStartedBy.set(null);
        this.isRevealInProgressChange.emit(false);

        const resetParticipants = this.participants().map(p => ({
          ...p,
          selectedCard: undefined,
          isRevealed: false
        }));
        this.participantsChange.emit(resetParticipants);

        setTimeout(() => {
          this.isResetting.set(false);
          this.resetInitiatedBy.set(null);
        }, 1000);
      }
    });

    // Subscribe to room's revealed state for additional synchronization
    this.revealedStateSubscription = this.firebaseService.getRoomRevealedState(this.roomId()).subscribe(revealed => {
      // Only sync if we're not currently in a countdown to avoid conflicts
      if (!this.isCountingDown() && this.areCardsRevealed() !== revealed) {
        this.areCardsRevealed.set(revealed);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.countdownSubscription) {
      this.countdownSubscription.unsubscribe();
    }
    if (this.resetSubscription) {
      this.resetSubscription.unsubscribe();
    }
    if (this.revealedStateSubscription) {
      this.revealedStateSubscription.unsubscribe();
    }
  }
}

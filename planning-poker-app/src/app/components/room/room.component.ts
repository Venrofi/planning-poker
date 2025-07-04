import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { PokerTableComponent } from '../poker-table/poker-table.component';
import { RoomHeaderComponent } from '../room-header/room-header.component';
import { RoomNotificationsComponent } from '../room-notifications/room-notifications.component';
import { CardSelectionComponent } from '../card-selection/card-selection.component';
import { Card } from '../../models/cards.model';
import { PokerService } from '../../services/poker.service';
import { NotificationService } from '../../services/notification.service';
import { UserSessionService } from '../../services/user-session.service';
import { RoomStateService } from '../../services/room-state.service';
import { RoomNavigationService } from '../../services/room-navigation.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-room',
  standalone: true,
  imports: [CommonModule, FormsModule, PokerTableComponent, RoomHeaderComponent, RoomNotificationsComponent, CardSelectionComponent],
  templateUrl: './room.component.html',
  styleUrl: './room.component.scss'
})
export class RoomComponent implements OnInit, OnDestroy {
  roomId = signal<string>('');

  private route = inject(ActivatedRoute);
  private routeSubscription: Subscription | null = null;
  private boundBeforeUnloadHandler: (event: BeforeUnloadEvent) => void;
  private pokerService = inject(PokerService);

  notificationService = inject(NotificationService);
  userSessionService = inject(UserSessionService);
  roomStateService = inject(RoomStateService);
  roomNavigationService = inject(RoomNavigationService);

  get roomTitle() { return this.roomStateService.roomTitle; }
  get userId() { return this.userSessionService.userId; }
  get userName() { return this.userSessionService.userName; }
  get areCardsRevealed() { return this.roomStateService.areCardsRevealed; }
  get isRevealInProgress() { return this.roomStateService.isRevealInProgress; }
  get participants() { return this.roomStateService.participants; }
  get selectedCard() { return this.roomStateService.selectedCard; }
  get cards() { return this.roomStateService.cards; }
  get notifications() { return this.notificationService.notifications; }
  get showUsernamePrompt() { return this.userSessionService.showUsernamePrompt; }
  get promptUsername() { return this.userSessionService.promptUsername; }
  get showRoomRedirectAlert() { return this.roomNavigationService.showRoomRedirectAlert; }

  constructor() {
    this.boundBeforeUnloadHandler = this.handleBeforeUnload.bind(this);
    window.addEventListener('beforeunload', this.boundBeforeUnloadHandler);
  }

  ngOnInit(): void {
    this.userSessionService.initializeUser();
    this.routeSubscription = this.route.paramMap.subscribe(params => {
      this.handleRouteChange(params.get('id'));
    });
  }

  ngOnDestroy(): void {
    // Only handle user leaving if we're not already in the process of leaving
    if (!this.roomStateService.isUserLeaving()) {
      this.roomStateService.setUserLeaving(true);
      // Fire and forget - we can't await in ngOnDestroy
      this.userSessionService.handleUserLeaving(this.roomId(), this.roomStateService.participants());
    }
    this.roomStateService.cleanup();
    this.roomNavigationService.cleanup();

    this.routeSubscription?.unsubscribe();
    window.removeEventListener('beforeunload', this.boundBeforeUnloadHandler);
  }

  private async handleRouteChange(providedRoomId: string | null): Promise<void> {
    await this.roomNavigationService.handleRouteChange(providedRoomId, this.roomId);
    if (this.roomId()) {
      this.roomStateService.setupSubscriptions(this.roomId());
    }
  }

  private handleBeforeUnload(): void {
    this.roomStateService.setUserLeaving(true);
    // Fire and forget - we can't await in beforeunload
    this.userSessionService.handleUserLeaving(this.roomId(), this.roomStateService.participants());
  }

  handleCardClick(card: Card): void {
    if (this.areCardsRevealed() || this.isRevealInProgress()) return;

    this.roomStateService.setSelectedCard(card);
    this.pokerService.selectCard(this.roomId(), this.userId(), card);
  }

  toggleReveal(): void {
    this.roomStateService.setCardsRevealed(true);
    setTimeout(() => {
      this.pokerService.setRevealState(this.roomId(), !this.areCardsRevealed());
    }, 3000);
  }

  resetCards(): void {
    this.pokerService.resetCards(this.roomId());
  }
}

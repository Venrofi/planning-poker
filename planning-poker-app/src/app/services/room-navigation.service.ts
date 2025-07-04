import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import { Router } from '@angular/router';
import { RoomService } from './room.service';
import { ParticipantService } from './participant.service';
import { UserSessionService } from './user-session.service';
import { RoomStateService } from './room-state.service';

@Injectable({
  providedIn: 'root'
})
export class RoomNavigationService {
  private router = inject(Router);
  private roomService = inject(RoomService);
  private participantService = inject(ParticipantService);
  private userSessionService = inject(UserSessionService);
  private roomStateService = inject(RoomStateService);

  showRoomRedirectAlert = signal<boolean>(false);

  async handleRouteChange(providedRoomId: string | null, roomId: WritableSignal<string>): Promise<void> {
    if (!providedRoomId) {
      const generatedRoomId = this.roomService.generateShortRoomId();
      roomId.set(generatedRoomId);
      this.router.navigate(['room', generatedRoomId]);
      return;
    }

    roomId.set(providedRoomId);
    await this.joinRoom(providedRoomId, roomId);
  }

  private async joinRoom(roomId: string, roomIdSignal: WritableSignal<string>): Promise<void> {
    try {
      const roomCreated = await this.roomService.createRoom(roomId);
      if (!roomCreated) {
        this.redirectToNewRoom(roomIdSignal);
        return;
      }

      this.roomService.checkStaleRooms();
      const joined = await this.participantService.joinRoom(roomId, this.userSessionService.userId(), this.userSessionService.userName());

      if (!joined) {
        this.redirectToNewRoom(roomIdSignal);
        return;
      }

      this.roomStateService.setupSubscriptions(roomId);
    } catch (error) {
      console.error(`Error joining room ${roomId}: `, error);
      this.redirectToNewRoom(roomIdSignal);
    }
  }

  private redirectToNewRoom(roomIdSignal: WritableSignal<string>): void {
    this.showRoomRedirectAlert.set(true);
    const newRoomId = this.roomService.generateShortRoomId();
    roomIdSignal.set(newRoomId);
    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
      this.router.navigate(['room', newRoomId]);
    });
  }

  async createNewRoom(): Promise<void> {
    const newRoomId = this.roomService.generateShortRoomId();
    await this.navigateToRoomWithCleanup(newRoomId);
  }

  private async navigateToRoomWithCleanup(newRoomId: string): Promise<void> {
    this.roomStateService.setUserLeaving(true);

    // Get current room ID from the router state
    const currentUrl = this.router.url;
    const currentRoomIdMatch = currentUrl.match(/\/room\/([^/]+)/);
    const currentRoomId = currentRoomIdMatch ? currentRoomIdMatch[1] : null;

    if (currentRoomId) {
      await this.userSessionService.handleUserLeaving(currentRoomId, this.roomStateService.participants());
    }

    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
      this.router.navigate(['room', newRoomId]);
    });
  }

  dismissRoomRedirectAlert(): void {
    this.showRoomRedirectAlert.set(false);
  }

  cleanup(): void {
    this.showRoomRedirectAlert.set(false);
  }
}

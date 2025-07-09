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
    await this.joinRoom(roomId);
  }

  private async joinRoom(roomId: WritableSignal<string>): Promise<void> {
    try {
      const currentRoomId = roomId();
      const room = await this.roomService.createRoom(currentRoomId);
      if (!room) {
        this.redirectToNewRoom(roomId);
        return;
      }

      this.roomService.checkStaleRooms();
      const joined = await this.participantService.joinRoom(currentRoomId, this.userSessionService.userId(), this.userSessionService.userName());

      if (!joined) {
        this.redirectToNewRoom(roomId);
        return;
      }

      this.roomStateService.setupSubscriptions(currentRoomId);
    } catch (error) {
      console.error(`Error joining room ${roomId()}: `, error);
      this.redirectToNewRoom(roomId);
    }
  }

  private redirectToNewRoom(roomId: WritableSignal<string>): void {
    this.showRoomRedirectAlert.set(true);

    const newRoomId = this.roomService.generateShortRoomId();
    roomId.set(newRoomId);

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

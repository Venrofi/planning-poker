import { Injectable, signal } from '@angular/core';
import { NotificationData } from '../components/room-notifications/room-notifications.component';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private _notifications = signal<NotificationData>({
    showUserLeftNotification: false,
    userLeftMessage: '',
    showAdminTransferNotification: false,
    adminTransferMessage: '',
    showNewAdminNotification: false,
    newAdminMessage: ''
  });

  notifications = this._notifications.asReadonly();

  showUserLeft(userName: string): void {
    this._notifications.update(n => ({
      ...n,
      userLeftMessage: `${userName} left the room`,
      showUserLeftNotification: true
    }));
    setTimeout(() => this.dismissUserLeft(), 4000);
  }

  showAdminTransfer(newAdminName: string): void {
    this._notifications.update(n => ({
      ...n,
      adminTransferMessage: `👑 ${newAdminName} is now the room admin`,
      showAdminTransferNotification: true
    }));
    setTimeout(() => this.dismissAdminTransfer(), 3000);
  }

  showNewAdmin(): void {
    this._notifications.update(n => ({
      ...n,
      newAdminMessage: `🎉 You are now the room admin!`,
      showNewAdminNotification: true
    }));
    setTimeout(() => this.dismissNewAdmin(), 3000);
  }

  dismissUserLeft(): void {
    this._notifications.update(n => ({
      ...n,
      showUserLeftNotification: false
    }));
  }

  dismissAdminTransfer(): void {
    this._notifications.update(n => ({
      ...n,
      showAdminTransferNotification: false
    }));
  }

  dismissNewAdmin(): void {
    this._notifications.update(n => ({
      ...n,
      showNewAdminNotification: false
    }));
  }

  clearAll(): void {
    this._notifications.set({
      showUserLeftNotification: false,
      userLeftMessage: '',
      showAdminTransferNotification: false,
      adminTransferMessage: '',
      showNewAdminNotification: false,
      newAdminMessage: ''
    });
  }
}

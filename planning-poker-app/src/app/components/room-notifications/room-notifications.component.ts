import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface NotificationData {
    showUserLeftNotification: boolean;
    userLeftMessage: string;
    showAdminTransferNotification: boolean;
    adminTransferMessage: string;
    showNewAdminNotification: boolean;
    newAdminMessage: string;
}

@Component({
    selector: 'app-room-notifications',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './room-notifications.component.html',
    styleUrl: './room-notifications.component.scss'
})
export class RoomNotificationsComponent {
    @Input() notificationData: NotificationData = {
        showUserLeftNotification: false,
        userLeftMessage: '',
        showAdminTransferNotification: false,
        adminTransferMessage: '',
        showNewAdminNotification: false,
        newAdminMessage: ''
    };

    @Output() dismissUserLeft = new EventEmitter<void>();
    @Output() dismissAdminTransfer = new EventEmitter<void>();
    @Output() dismissNewAdmin = new EventEmitter<void>();

    onDismissUserLeft(): void {
        this.dismissUserLeft.emit();
    }

    onDismissAdminTransfer(): void {
        this.dismissAdminTransfer.emit();
    }

    onDismissNewAdmin(): void {
        this.dismissNewAdmin.emit();
    }
}

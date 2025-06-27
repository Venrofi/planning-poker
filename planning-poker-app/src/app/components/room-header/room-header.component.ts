import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Participant } from '../../models/participant.model';

@Component({
  selector: 'app-room-header',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './room-header.component.html',
  styleUrl: './room-header.component.scss'
})
export class RoomHeaderComponent {
  @Input() roomId = '';
  @Input() roomTitle = '';
  @Input() userName = '';
  @Input() participants: Participant[] = [];

  @Output() roomTitleChange = new EventEmitter<string>();
  @Output() promptForUserName = new EventEmitter<void>();
  @Output() createNewRoom = new EventEmitter<void>();

  showCopyTooltip = false;

  onRoomTitleChange(newTitle: string): void {
    this.roomTitleChange.emit(newTitle);
  }

  onCreateNewRoom(): void {
    this.createNewRoom.emit();
  }

  copyRoomLink(): void {
    const url = window.location.href;
    navigator.clipboard.writeText(url)
      .then(() => {
        this.showCopyTooltip = true;

        setTimeout(() => {
          this.showCopyTooltip = false;
        }, 1000);
      })
      .catch(err => console.error('Failed to copy room link:', err));
  }

  onPromptForUserName(): void {
    this.promptForUserName.emit();
  }
}

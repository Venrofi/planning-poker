import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Participant } from '../../models/participant.model';
import { Router } from '@angular/router';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  @Input() roomTitle: string = '';
  @Input() participants: Participant[] = [];
  @Input() roomId: string = '';
  @Input() userName: string = '';

  @Output() roomTitleChange = new EventEmitter<string>();
  @Output() promptForUserName = new EventEmitter<void>();
  @Output() createNewRoom = new EventEmitter<void>();

  showCopyTooltip: boolean = false;

  constructor(private router: Router) { }

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
        // Hide tooltip after 2 seconds
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

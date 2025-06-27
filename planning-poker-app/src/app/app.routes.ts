import { Routes } from '@angular/router';
import { RoomComponent } from './components/room/room.component';

export const routes: Routes = [
  { path: '', component: RoomComponent },
  { path: 'room/:id', component: RoomComponent },
  { path: '**', redirectTo: '' }
];

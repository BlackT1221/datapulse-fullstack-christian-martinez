import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-dashboard',
  imports: [MatCardModule],
  template: `
    <mat-card appearance="outlined">
      <mat-card-header>
        <mat-card-title>Panel de control</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <p>Bienvenido a DataPulse Latam.</p>
      </mat-card-content>
    </mat-card>
  `,
})
export class DashboardComponent {}

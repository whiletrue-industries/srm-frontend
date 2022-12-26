import { Component, Input, OnChanges, OnInit } from '@angular/core';
import { Card } from '../consts';

@Component({
  selector: 'app-card-action-nav',
  templateUrl: './card-action-nav.component.html',
  styleUrls: ['./card-action-nav.component.less'],
  host: {
    '[class.active]': 'active',
  }
})
export class CardActionNavComponent implements OnChanges {

  @Input() card: Card;

  action = '';
  active = false;

  constructor() { }

  ngOnChanges(): void {
    this.active = false;
    if (this.card?.branch_geometry) {
      const coords = [this.card.branch_geometry[1], this.card?.branch_geometry[0]].filter(x => !!x);
      const latLng = coords.join(',');
      if (coords.length === 2 && latLng && latLng.length) {
        this.action = `https://www.google.com/maps/search/?api=1&query=${latLng}`;
        this.active = true;
      }
    }  
  }
}

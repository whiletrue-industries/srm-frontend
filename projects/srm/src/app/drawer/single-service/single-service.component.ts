import { Component, Input, OnInit } from '@angular/core';
import { Card } from '../../common/datatypes';

@Component({
  selector: 'app-single-service',
  templateUrl: './single-service.component.html',
  styleUrls: ['./single-service.component.less']
})
export class SingleServiceComponent implements OnInit {

  @Input() item: Card | null = null;

  card: Card;

  constructor() { }

  ngOnInit(): void {
    if (this.item) {
      this.card = this.item;
    }
  }

  geoLink() {
    return 'geo:' + this.card.branch_geometry.join(',');
  }
}

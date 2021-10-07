import { Component, Input, OnInit } from '@angular/core';
import { Card } from '../../common/datatypes';

@Component({
  selector: 'app-service-card',
  templateUrl: './service-card.component.html',
  styleUrls: ['./service-card.component.less']
})
export class ServiceCardComponent implements OnInit {

  @Input() item: Card;

  constructor() { }

  ngOnInit(): void {
  }
}

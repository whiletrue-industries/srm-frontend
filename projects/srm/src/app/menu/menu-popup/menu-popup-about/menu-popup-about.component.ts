import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

@Component({
  selector: 'app-menu-popup-about',
  templateUrl: './menu-popup-about.component.html',
  styleUrls: ['./menu-popup-about.component.less']
})
export class MenuPopupAboutComponent implements OnInit {

  @Input() active = false;
  @Output() close = new EventEmitter<void>();
  
  constructor() { }

  ngOnInit(): void {
  }

}

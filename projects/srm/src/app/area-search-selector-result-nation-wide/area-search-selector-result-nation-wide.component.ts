import { Component, Input, OnInit } from '@angular/core';
import { AreaSearchState } from '../area-search-selector/area-search-state';
import { timer } from 'rxjs';

@Component({
  selector: 'app-area-search-selector-result-nation-wide',
  templateUrl: './area-search-selector-result-nation-wide.component.html',
  styleUrls: ['./area-search-selector-result-nation-wide.component.less']
})
export class AreaSearchSelectorResultNationWideComponent implements OnInit {

  @Input() state: AreaSearchState;

  constructor() { }

  ngOnInit(): void {
  }


  select() {
    this.state.selectNationWide();
  }
}

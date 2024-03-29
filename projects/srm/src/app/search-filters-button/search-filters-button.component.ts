import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { FiltersState } from '../search-filters/filters-state';
import { LayoutService } from '../layout.service';

@Component({
  selector: 'app-search-filters-button',
  templateUrl: './search-filters-button.component.html',
  styleUrls: ['./search-filters-button.component.less']
})
export class SearchFiltersButtonComponent {

  @Input() filtersState: FiltersState;
  
  @Output() activate = new EventEmitter<void>();

  constructor(private layout: LayoutService) { }

  get message(): string {
    if (this.filtersState.active) {
      if (!this.filtersState.totalFilters) {
        return 'ללא סינון';
      } 
    }
    if (this.filtersState.totalFilters) {
      if (this.layout.mobile()) {
        return `${this.filtersState.totalFilters}`;
      }
      if (this.filtersState.totalFilters > 1) {
        return `${this.filtersState.totalFilters} מסננים:`;
      } else {
        return `מסנן אחד:`;
      }
    }
    return `סינון`;
  }

  get state() {
    if (!!this.filtersState.totalFilters) {
      return 'active';
    } else {
      if (!this.filtersState.active) {
        return 'default';
      } else {
        return 'inactive';
      }  
    }
  }
}

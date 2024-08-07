import { Component, EventEmitter, Input, OnChanges, OnInit, Output } from '@angular/core';
import { TaxonomyItem, prepareQuery } from '../consts';
import { ResponseBase } from '../response/response-base';
import { Router } from '@angular/router';
import { SearchService } from '../search.service';

@Component({
  selector: 'app-response-linky',
  templateUrl: './response-linky.component.html',
  styleUrls: ['./response-linky.component.less']
})
export class ResponseLinkyComponent extends ResponseBase implements OnChanges {

  @Input() response: TaxonomyItem = {};

  @Input() link = true;
  @Input() search = true;
  @Input() small = false;

  responseQuery = '';

  constructor(private router: Router, private searchSvc: SearchService) {
    super();
  }

  ngOnChanges(): void {
    this.initColors(this.response);
    this.recalcColors();
    this.responseQuery = prepareQuery(this.response.name || '');
  }

  doSearch(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.search) {
      if (this.response.name) {
        this.searchSvc.search(this.response.name);
      }
    } else {
      this.router.navigate(['/s', this.responseQuery], { queryParamsHandling: 'merge', queryParams: { from: 'tag-response' } });
    }
  }
}

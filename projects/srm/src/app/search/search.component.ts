import { Location } from '@angular/common';
import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { Subject, timer } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';
import { ApiService } from '../api.service';
import { _h } from '../consts';

export type ResultType = {
  link: string[] | string | null,
  linkParams?: Params,
  display: string,
  query: string | null,
  direct: boolean,
};

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.less']
})
export class SearchComponent implements OnInit {

  @ViewChild('input') inputEl: any;

  autoCompleteResults: ResultType[] = [];
  topCards: ResultType[] = [];
  presets: ResultType[] = [];
  results_: ResultType[] | null = null;
  query_ = '';
  queries = new Subject<string>();
  noResults = false;

  constructor(private api: ApiService, public location: Location, private route: ActivatedRoute, private router: Router) {
    console.log('LOADING PRESETS');
    api.getPresets().subscribe(presets => {
      console.log('PRESETS', presets);
      this.presets = presets.map((preset) => {
        return {
          link: preset.link,
          display: `<em>${preset.title}</em>`,
          query: preset.title,
          direct: false,
        };
      });
    });
    this.queries.pipe(
      debounceTime(500),
      switchMap(query => api.getAutoComplete(query)),
    ).subscribe(results => {
      this.autoCompleteResults = results.map((result) => {
        return {
          link: ['/s', result.query],
          display: _h(result, 'query'),
          query: result.query,
          direct: false,
        };
      });
      this.noResults = this.autoCompleteResults.length === 0;
      this.results_ = null;
    });
    this.queries.pipe(
      debounceTime(500),
      switchMap(query => api.getTopCards(query)),
    ).subscribe(results => {
      this.topCards = results.map((result) => {
        return {
          link: ['/c', result.card_id],
          display: `${_h(result, 'service_name')} (${_h(result, 'branch_name')})`,
          query: null,
          direct: true,
        };
      });
      this.results_ = null;
    });
    route.queryParams.subscribe(params => {
      console.log('QUERY PARAMS', params);
      timer(0).subscribe(() => {
        this.query = params.q || '';
      });
    });
  }

  ngOnInit(): void {
  }

  get query() {
    return this.query_;
  }

  set query(query: string) {
    if (this.query_ === '' && query) {
      this.inputEl?.nativeElement?.focus();
    }
    this.query_ = query;
    this.noResults = false;
    if (query) {
      this.queries.next(query);
    }
  }

  get results(): ResultType[] {
    if (this.results_ === null) {
      this.results_ = this.autoCompleteResults.slice(0, 5 - this.topCards.length).concat(this.topCards);
    }
    if (this.noResults && this.query?.length > 0) {
      this.results_ = [{
        link: ['/s'],
        linkParams: {q: this.query},
        display: `חיפוש ״${this.query}״`,
        query: null,
        direct: true,
      }];
    }
    return this.results_;
  }

  changed(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.router.navigate(['/s'], {queryParams: {q: this.query}});
    }
  }
}
import { Params, Router } from "@angular/router";
import { ApiService } from "../api.service";
import { Subject, debounceTime, from, fromEvent, switchMap, timer } from "rxjs";
import { _h, prepareQuery } from "../consts";
import { untilDestroyed } from "@ngneat/until-destroy";
import { PlatformService } from "../platform.service";
import { Component } from "@angular/core";
import { SearchService } from "../search.service";

export type ResultType = {
  link: string[] | null,
  linkParams?: Params,
  display: string,
  query: string | null,
  direct: boolean,
};


export class SearchConfig {
  query_ = '';
  noResults = false;
  inputEl: HTMLInputElement | null = null;

  autoCompleteResults: ResultType[] = [];
  topCards: ResultType[] = [];
  presets: ResultType[] = [];
  results_: ResultType[] | null = null;

  queries = new Subject<string>();
  typedQueries = new Subject<string>();

  autoFocus = true;
  searching = false;

  constructor(private container: any, private router: Router, private api: ApiService, private platform: PlatformService, public closeSearch_: () => void) {
    api.getPresets().subscribe(presets => {
      console.table(presets);
      this.presets = [{
        link: ['/s', 'שירותים_למצב_החירום'],
        linkParams: {q: prepareQuery(this.query), from: 'search-presets'},
        display: '<span class="emergency">שירותים למצב החירום המלחמתי</span>',
        query: 'שירותים למצב החירום',
        direct: false,
      }, ...presets.map((preset) => {
        return {
          link: ['/s', prepareQuery(preset.title)],
          linkParams: {q: prepareQuery(this.query), from: 'search-presets'},
          display: `<em>${preset.title}</em>`,
          query: preset.title,
          direct: false,
        };
      })];
    });
    this.typedQueries.pipe(
      untilDestroyed(this.container),
      debounceTime(this.platform.browser() ? 500 : 0),
    ).subscribe((query) => {
      this.queries.next(query);
    });
    this.queries.pipe(
      untilDestroyed(this.container),
      switchMap(query => api.getAutoComplete(query)),
    ).subscribe(results => {
      this.autoCompleteResults = results.map((result) => {
        return {
          link: ['/s', result.id],
          linkParams: {q: prepareQuery(this.query), from: 'search-autocomplete-result'},
          display: _h(result, 'query'),
          query: result.query,
          direct: false,
        };
      });
      this.noResults = this.autoCompleteResults.length === 0;
      this.results_ = null;
    });
    this.queries.pipe(
      untilDestroyed(this.container),
      switchMap(query => api.getTopCards(query)),
    ).subscribe(results => {
      this.topCards = results.map((result) => {
        let display = _h(result, 'service_name');
        if (result.branch_city) {
          display += ` (${_h(result, 'branch_city')})`;
        }
        return {
          link: ['/c', result.card_id],
          display,
          query: null,
          direct: true,
          linkParams: {from: 'search-autocomplete-direct'},
        };
      });
      this.results_ = null;
    });
  }

  get query() {
    return this.query_;
  }

  set query(query: string) {
    if (this.query_ === '' && query) {
      this.inputEl?.focus();
    }
    this.query_ = query;
    this.noResults = false;
    this.queries.next(query);
  }

  setInputEl(el: HTMLInputElement) {
    if (this.query_) {
      el.setSelectionRange(0, this.query_.length);
    }
    fromEvent(el, 'focus').pipe(
      untilDestroyed(this.container),
    ).subscribe(() => {
      this.searching = true;
    });
    if (this.autoFocus) {
      el.focus();
    }
    this.inputEl = el;
  }

  focus() {
    this.inputEl?.focus();
  }

  blur() {
    this.inputEl?.blur();
  }

  changed(event: KeyboardEvent) {
    if (event.key === 'Enter' && this.query?.length > 0) {
      let found = false;
      for (const result of this.autoCompleteResults) {
        if (result.query === this.query.trim()) {
          this.closeSearch();
          this.router.navigate(result.link as string[], {queryParams: result.linkParams});
          found = true;
          break;
        }
      }
      if (!found) {
        this.closeSearch();
        this.router.navigate(['/s', '_'], {queryParams: {q: prepareQuery(this.query), from: 'search-autocomplete-fulltext'}});
      }
    }
  }

  get results(): ResultType[] {
    if (this.results_ === null) {
      // console.table('RESULTS', this.autoCompleteResults, this.topCards);
      this.results_ = [
        ...this.autoCompleteResults.slice(0, 5 - this.topCards.length),
        ...this.topCards
      ];
      this.results_ = [
        ...this.results_.filter(r => r.query !== this.query),
        ...this.results_.filter(r => r.query === this.query)
      ];
      const lastPart = this.query.split(' ').slice(-1)[0];
      this.results_.forEach((r) => {
        r.display = r.display.replace(new RegExp(`^(${lastPart})`), '<em>$1</em>');
        r.display = r.display.replace(new RegExp(`(\\s${lastPart})`), '<em>$1</em>');
      });
      if (this.noResults && this.query?.length > 0) {
        this.results_.push({
          link: ['/s', '_'],
          linkParams: {q: prepareQuery(this.query), from: 'search-autocomplete-fulltext'},
          display: `<em>${this.query}</em>`,
          query: null,
          direct: true,
        });
      }
    }
    return this.results_;
  }

  closeSearch() {
    this.searching = false;
    this.closeSearch_();
  }
}
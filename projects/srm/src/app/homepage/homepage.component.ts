import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ApiService } from '../api.service';
import { HomepageEntry, Preset, TaxonomyItem, prepareQuery } from '../consts';
import { PlatformService } from '../platform.service';
import { SearchConfig } from '../search/search-config';
import { Router } from '@angular/router';
import { UntilDestroy } from '@ngneat/until-destroy';
import { timer } from 'rxjs';
import { LayoutService } from '../layout.service';
import { SearchService } from '../search.service';

@UntilDestroy()
@Component({
  selector: 'app-homepage',
  templateUrl: './homepage.component.html',
  styleUrls: ['./homepage.component.less'],
  host: {
    'tabIndex': 'null',
  }
})
export class HomepageComponent implements AfterViewInit{

  public searchConfig: SearchConfig;
  groups: {
    title: string,
    query: string,
    items: HomepageEntry[]
  }[] = [];
  hovered: string | null = null;

  @ViewChild('search') search: ElementRef;
  searchVisibleObserver: IntersectionObserver;
  searchVisible = true;
  
  constructor(private api: ApiService, private platform: PlatformService, private router: Router, private layout: LayoutService, private searchSvc: SearchService) {
    this.searchConfig = new SearchConfig(this, this.router, this.api, this.platform, () => {});
    this.searchConfig.autoFocus = false;
    api.getHomepage().subscribe((homepage) => {
      const groups: any = [];
      homepage.forEach((entry: HomepageEntry) => {
        if (!entry.title && !groups[entry.group]) {
          const entries: HomepageEntry[] = [];
          groups[entry.group] = entries;
          this.groups.push({ title: entry.group, query: entry.query, items: entries});
        }
      });
      homepage.forEach((entry: HomepageEntry) => {
        if (!!entry.title && groups[entry.group]) {
          groups[entry.group].push(entry);
        }
      });
    });
  }

  ngAfterViewInit(): void {
    this.platform.browser(() => {
      const options: any = { threshold: [0.1], rootMargin: '-80px'};
      if (this.layout.mobile()) {
        options.rootMargin = '-20px';
      }
      this.searchVisibleObserver = new IntersectionObserver((entries) => {
        if (entries.length === 1) {
          this.searchVisible = entries[0].intersectionRatio > 0.1;
        }
      }, options);
      this.searchVisibleObserver.observe(this.search.nativeElement);
    });
  }

  updateFocus(focus: boolean) {
    if (focus) {
      this.search.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } else {
      timer(100).subscribe(() => {
        this.searchConfig.query_ = '';
        this.searchConfig.blur();
      });
    }
  }

  startSearch(query: string, forceSvc=false) {
    if (this.layout.desktop() && !forceSvc) {
      this.searchConfig.query_ = query;
      this.searchConfig.queries.next(query);
      this.searchConfig.focus();
    } else {
      this.searchSvc.search(query);
    }  
  }

  keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      this.updateFocus(false);
    }
  }
}

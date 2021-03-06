import { isPlatformServer } from '@angular/common';
import { AfterViewInit, Component, ElementRef, EventEmitter, OnInit, Output, ViewChild } from '@angular/core';
import { PlatformService } from '../platform.service';
import { SearchService } from '../search.service';
import { SituationsService } from '../situations.service';

@Component({
  selector: 'app-filtering',
  templateUrl: './filtering.component.html',
  styleUrls: ['./filtering.component.less'],
  'host': {
    '[class.active]': 'isActive()'
  }
})
export class FilteringComponent implements OnInit, AfterViewInit {

  @Output() activated = new EventEmitter<boolean>();
  @Output() menu = new EventEmitter<void>();

  @ViewChild('content') contentEl: ElementRef;

  activeSection: string | null = null;
  intersectionObserver: IntersectionObserver;

  constructor(public situations: SituationsService, private search: SearchService, private platform: PlatformService) {
    this.search.closeFilter.subscribe(() => this.active = null);
  }

  ngOnInit(): void {
  }

  ngAfterViewInit(): void {
    this.platform.browser(() => {
      this.intersectionObserver = new IntersectionObserver(entries => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          const kind = entry.target.getAttribute('result-type');
          if (kind) {
            this.search.queryMore(kind);
          }
        }
      }, {root: this.contentEl.nativeElement});
    });
  }

  set active(value: string | null) {
    this.activeSection = value;
    this.activated.next(!!value);
  }

  setActiveSection(current: string, next: string | null) {
    if (!!next) {
      this.activeSection = next;
      this.activated.next(true);
    } else {
      if (this.activeSection === current) {
        this.active = null;
        this.activated.next(false);
      }
    }
  }

  isActive() {
    return !!this.activeSection || this.situations.activeEditors().length > 0
  }
  
  hasSituationEditor() {
    return this.situations.activeEditors().length > 0 && this.situations.activeEditors()[0].state === 'active';
  }
}

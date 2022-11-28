import { Component, ElementRef, Input, OnChanges, OnInit } from '@angular/core';
import { timer } from 'rxjs';
import { ApiService } from '../api.service';
import { Card, SearchParams } from '../consts';

@Component({
  selector: 'app-point-result-stack',
  templateUrl: './point-result-stack.component.html',
  styleUrls: ['./point-result-stack.component.less'],
  host: {
    '[class.multiple]': '(cards?.length || 0) + (hiddenCards?.length || 0)>1',
  }
})
export class PointResultStackComponent implements OnChanges {

  @Input() searchParams: SearchParams;
  @Input() cards: Card[] = [];
  @Input() hiddenCards: Card[] = [];
  hidden_ = false;

  branches: Card[][] = [];

  constructor(private api: ApiService, private el: ElementRef) { }

  ngOnChanges(): void {
    this.hidden_ = this.hiddenCards.length > 0;;      
  }

  routerLink(card: Card): string[] {
    if (this.searchParams?.acQuery) {
      return ['/s', this.searchParams?.acQuery, 'c', card.card_id];
    } else {
      return ['/c', card.card_id];
    }
  }

  triggerClicked() {
    this.hidden_ = false;
    timer(500).subscribe(() => {
      const el = this.el.nativeElement as HTMLDivElement;
      el.querySelectorAll('.card')[this.cards.length]?.scrollIntoView({behavior: 'smooth'});
    });
  }

}

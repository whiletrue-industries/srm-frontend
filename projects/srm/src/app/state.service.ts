import { Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LngLatBounds } from 'mapbox-gl';
import { BehaviorSubject, from, merge, Observable, ReplaySubject, Subject } from 'rxjs';
import { filter, map, switchMap, delay, pairwise, tap, debounceTime } from 'rxjs/operators';
import { ApiService } from './api.service';
import { Card, Organization, Point } from './common/datatypes';
import { ResponsesService } from './responses.service';
import { Location } from '@angular/common';
import { SeoSocialShareService } from 'ngx-seo';
import { StateEncoderDecoder } from './url-encode-decode';

export type CenterZoomType = [number, number, number];
export type GeoType = CenterZoomType | [[number, number], [number, number]] | null;

export type State = {
  geo?: GeoType;                      // Where the map is centered and zoomed
  searchBoxTitle?: string,            // Title of the search box
  cardId?: string | null,             // Id of the card that is currently selected
  pointId?: string | null,            // Id of the map point that is currently selected
  placeId?: string | null,            // Id of the place that is currently selected
  responseId?: string | null,         // Id of the response that is currently selected
  orgId?: string | null,              // Id of the organization that is currently selected
  situations?: string[][] | null,     // List of situations that are currently filtered on
  diff?: string[] | null,             // List of diffs between current and previous state
};

function compareStates(a: State, b: State) {
  const states = [a, b];
  const diffs = [];
  for (const key of ['geo', 'searchBoxTitle', 'cardId', 'pointId', 'placeId', 'responseId', 'situations', 'orgId']) {
    const values = [];
    for (const state of states) {
      values.push(JSON.stringify(state.hasOwnProperty(key)? (state as any)[key] : null))
    }
    if (values[0] !== values[1]) {
      diffs.push(key);
    }
  }
  return diffs;
}

function filterDiffs(keys: string[]) {
  return (state: State) => {
    const ret = keys.some((key) => state.diff && state.diff.indexOf(key) >= 0);
    return ret;
  };
}

@Injectable({
  providedIn: 'root'
})
export class StateService {
  _state: State = {};
  incomingStateSubject = new Subject<State>();
  stateSubject = new BehaviorSubject<State>({});
  state = new Subject<State>();
  // currentState: string = '_';
  urlEncoderDecoder = new StateEncoderDecoder();

  router: Router;
  firstRoute = true;

  geoChanges: Observable<State>;
  responseChanges: Observable<State>;
  orgChanges: Observable<State>;
  situationChanges: Observable<State>;
  filterChanges: Observable<State>;
  queryChanges: Observable<State>;
  cardChanges: Observable<State>;
  pointChanges: Observable<State>;

  placeNames = new Subject<string>();

  selectedCard = new ReplaySubject<Card | null>(1);
  selectedPoint = new ReplaySubject<Point | null>(1);
  
  cardCache: {[key: string]: Card} = {};
  pointCache: {[key: string]: Point} = {};

  // savedGeo: CenterZoomType | null;
  latestBounds: LngLatBounds;
  // replaceCenterZoom: CenterZoomType | null = null;
  
  constructor(private api: ApiService, private responses: ResponsesService, private location: Location, private seo: SeoSocialShareService) {
    // State stream, collect what changed and add it to the state object
    this.stateSubject.pipe(
      pairwise(),
      map(([prev, curr]) => {
        curr.diff = compareStates(prev, curr);
        if (curr.diff.length > 0) {
          console.log('CHANGED IN STATE', curr.diff, curr);
        }
        return curr;
      }),
      filter((state) => state.diff? state.diff.length > 0 : false),
    ).subscribe((state) => {
      this._state = state;
      this.state.next(state);
    });

    // Streams for specific state changes
    this.geoChanges = this.state.pipe(
      filter(filterDiffs(['geo'])),
    );
    this.filterChanges = this.state.pipe(
      filter(filterDiffs(['responseId', 'situations', 'orgId'])),
    );
    this.responseChanges = this.state.pipe(
      filter(filterDiffs(['responseId'])),
    );
    this.orgChanges = this.state.pipe(
      filter(filterDiffs(['orgId'])),
    );
    this.situationChanges = this.state.pipe(
      filter(filterDiffs(['situations'])),
    );
    this.queryChanges = this.state.pipe(
      filter(filterDiffs(['searchBoxTitle'])),
    );
    this.cardChanges = this.state.pipe(
      filter(filterDiffs(['cardId'])),
    );
    this.pointChanges = this.state.pipe(
      filter(filterDiffs(['pointId'])),
    );
    
    // Select card/point when the cardId/pointId changes
    this.pointChanges.subscribe((state) => {
      this.selectPointById(state.pointId || null);
    });
    this.cardChanges.subscribe((state) => {
      this.selectCardById(state.cardId || null);
    });
  }

  trackRoute(router: Router, activatedRoute: ActivatedRoute) {
    this.router = router;

    // State decoding from URL
    merge(
      activatedRoute.queryParams,
      activatedRoute.url
    ).pipe(
      map(() => activatedRoute.snapshot),
      switchMap((sn) => {
        const responseId = sn.params.response || null;
        const orgId = sn.params.org || null;
        const placeId = sn.params.place || null;
        const cardId = sn.params.card || null;
        const state = sn.queryParams.v || '';
        return this.processPaths(responseId, placeId, cardId, orgId, state);
      }),
      map((state) => {
        const decoded = this.urlEncoderDecoder.decode(state);
        return decoded
      })
    ).subscribe((state: State) => {
      this.stateSubject.next(state);
    });

    // State encoding to URL
    const incomingUpdates: any[] = [];
    this.incomingStateSubject.pipe(
      tap((update) => {
        incomingUpdates.push(update);
      }),
      debounceTime(100),
    ).subscribe(() => {
      const update: any = {};
      while (incomingUpdates.length > 0) {
        Object.assign(update, incomingUpdates.shift());
      }
      this.newState(Object.assign({}, this._state, update), Object.keys(update));
    });
  }

  newState(state: State, updatedKeys: string[]) {
    if (this.router) {
      const encoded = this.urlEncoderDecoder.encode(state);
      // this.currentState = encoded;
      const queryParams = {
        v: encoded
      };
      const replaceUrl = this.firstRoute || (updatedKeys.length === 1 && updatedKeys[0] === 'geo');
      this.firstRoute = false;
      this.router.navigate(['/'], {queryParams, replaceUrl});  
    } else {
      console.log('NO ROUTER');
    }
  }

  processPaths(responseId: string, placeId: string, cardId: string, orgId: string, encoded: string): Observable<string> {
    if (!!responseId || !!placeId || !!cardId || !!orgId) {
      const decoded = this.urlEncoderDecoder.decode(encoded);
      let obs: Observable<State> = from([]);
      if (!!responseId) {
        obs = this.api.getResponse(responseId).pipe(
          map((response) => {
            decoded.responseId = responseId;
            decoded.searchBoxTitle = response.name;
            decoded.orgId = null;
            decoded.cardId = null;
            decoded.placeId = null;
            this.seo.setTitle(`???? ?????????? - ?????????? ${response.name}`);
            this.seo.setDescription(`???? ?????????? - ?????????? ?????????????? ???????? ${response.name} ???????????????? ???? ?????? ????????????, ???????????? ????????????`);
            this.seo.setUrl(`https://www.kolsherut.org.il/r/${responseId}`);
            return decoded;
          })
        );
      } else if (!!placeId) {
        obs = this.api.getPlace(placeId).pipe(
          map((place) => {
            decoded.geo = [[place.bounds[0], place.bounds[1]], [place.bounds[2], place.bounds[3]]];
            decoded.searchBoxTitle = place.name[0];
            decoded.orgId = null;
            decoded.cardId = null;
            decoded.placeId = placeId;
            decoded.responseId = null;
            const name = place.name[0];
            this.seo.setTitle(`???? ?????????? - ?????????????? ?????????????? ??${name}`);
            this.seo.setDescription(`???? ?????????? - ?????????? ?????????????? ?????????? ${name} ???????????????? ???? ?????? ????????????, ???????????? ????????????`);
            this.seo.setUrl(`https://www.kolsherut.org.il/p/${name}`);  
            this.placeName = name;
            return decoded;
          })
        );
      } else if (!!cardId) {
        decoded.responseId = null;
        decoded.cardId = cardId;
        decoded.placeId = null;
        obs = from([
          decoded          
        ]);
      } else if (!!orgId) {
        obs = this.api.getOrganization(orgId).pipe(
          map((org) => {
            decoded.orgId = orgId;
            decoded.searchBoxTitle = org.name;
            decoded.responseId = null;
            decoded.cardId = null;
            decoded.placeId = null;
            this.seo.setTitle(`???? ?????????? - ?????????? ?????????? ???? ${org.name}`);
            this.seo.setDescription(`???? ?????????? - ?????????? ?????????????? ???????????? ?????????????? ???????????????? ???? ?????? ${org.name}`);
            this.seo.setUrl(`https://www.kolsherut.org.il/o/${orgId}`);
            return decoded;
          })
        );
      }
      return obs.pipe(
        map((state) => {
          const encoded = this.urlEncoderDecoder.encode(state);
          this.router.navigate(['/'], {queryParams: {v: encoded}, replaceUrl: true});
          return encoded;
        })
      );
    } else {
      return from([encoded]);
    }
  }
  
  // Change current state by one or more fields
  updateState(update: any, kind: string='') {
    this.incomingStateSubject.next(update);
  }

  // State Update Shortcuts
  set bounds(bounds: LngLatBounds) {
    const geo = bounds.toArray();
    this.updateState({geo});
  }

  updateCenterZoom(geo: CenterZoomType) {
    geo = geo.map(x => Math.round(x * 10000) / 10000) as CenterZoomType;
    this.updateState({geo});
  }

  set centerZoom(centerZoom: CenterZoomType) {
    this.updateCenterZoom(centerZoom);
  }

  set responseFilter(responseId: string | null) {
    const searchBoxTitle = responseId ? this.responses.getResponseName(responseId) : '';
    this.updateState({responseId, searchBoxTitle});
  }

  get responseFilter() {
    return this._state.responseId ? this._state.responseId : null;
  }

  set orgFilter(org: Organization) {
    const orgId = org.id;
    const searchBoxTitle = org.name;
    this.updateState({orgId, searchBoxTitle});
  }

  set orgId(orgId: string | null) {
    this.updateState({orgId});
  }

  get orgId() {
    return this._state.orgId || null;
  }

  set situations(situations: string[][] | null) {
    this.updateState({situations});
  }

  set placeName(place: string) {
    this.placeNames.next(place);
  }

  set cardId(cardId: string | null) {
    this.updateState({cardId});
  }

  set pointId(pointId: string | null) {
    this.updateState({pointId});
  }

  set card(card: Card | null) {
    if (card) {
      console.log('SET CARD', card.card_id);
      this.cardCache[card.card_id] = card;
      this.pointId = card.point_id;
      this.cardId = card.card_id;  
    } else {
      this.cardId = null;
    }
  }

  set point(point: Point | null) {
    if (point) {
      this.pointCache[point.point_id] = point;
      this.pointId = point.point_id;
    } else {
      this.pointId = null;
    }
  }

  // Select point / cards / card 
  // (by id, fetch if needed)
  selectPointById(pointId: string | null) {
    if (pointId) {
      const point = this.pointCache[pointId];
      let source = from([point]).pipe(
        delay(0)
      );
      if (!point) {
        source = this.api.getGeoData(pointId);
      }
      source.subscribe((point) => {
        this.selectPoint(point);
      });
    } else {
      this.selectPoint(null);
    }
  }

  selectCardById(cardId: string | null) {
    if (cardId) {
      const card = this.cardCache[cardId];
      if (card) {
        this.selectCard(card);
      } else {
        this.api.getCard(cardId).subscribe((card) => {
          this.selectCard(card);
        });
      }
    } else {
      this.selectCard(null);
    }
  }
  
  // By value
  selectPoint(point: Point | null) {
    if (point) {
      this.pointCache[point.point_id] = point;
    }
    this.selectedPoint.next(point);
  }

  selectCard(card: Card | null) { // replaceCenterZoom
    if (card) {
      this.cardCache[card.card_id] = card;
      this.seo.setTitle(`???? ?????????? - ${card.service_name}`);
      this.seo.setDescription(`${card.branch_name} - ${card.service_description || card.branch_description}`);
      this.seo.setUrl(`https://www.kolsherut.org.il/c/${card.card_id}`);  
    }
    this.selectedCard.next(card);
  }

  // Apply state from url (for presets)
  applyFromUrl(urlToApply: string) {
    console.log('APPLY FROM URL', urlToApply);
    const url = new URL(urlToApply);
    const params = url.searchParams;
    if (params) {
      const encodedState = params.get('v');
      if (encodedState) {
        const decoded: State = this.urlEncoderDecoder.decode(encodedState);
        this.updateState(decoded);
      }
    }
  }
}

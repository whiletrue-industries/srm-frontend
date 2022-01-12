import { Injectable } from '@angular/core';
import { ActivatedRoute, NavigationStart, Router, Event } from '@angular/router';
import { LngLat, LngLatBounds, LngLatLike } from 'mapbox-gl';
import { BehaviorSubject, from, merge, Observable, ReplaySubject, Subject } from 'rxjs';
import { throttleTime, distinctUntilChanged, filter, first, map, switchMap, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { Card, Response } from './common/datatypes';
import { ResponsesService } from './responses.service';
import { Location } from '@angular/common';
import { SeoSocialShareService } from 'ngx-seo';

export type CenterZoomType = [number, number, number];
export type GeoType = CenterZoomType | [[number, number], [number, number]] | null;

export type State = {
  geo?: GeoType;
  searchBoxTitle?: string,
  cardId?: string | null,
  placeId?: string | null,
  responseId?: string | null,
  skipGeoUpdate?: boolean,
  situations?: string[][] | null,
};


function makeKey(obj: any, keys: string[]) {
  const ret = [];
  for (const key of keys) {
    ret.push(JSON.stringify(obj.hasOwnProperty(key)? obj[key] : null));
  }
  return ret.join(':');
}

function keyComparer(keys: string[]) {
  return (x: Object, y: Object) => makeKey(x, keys) === makeKey(y, keys);
}

@Injectable({
  providedIn: 'root'
})
export class StateService {
  _state: State = {}; 
  state = new ReplaySubject<State>(1);
  currentState: string = '_';

  geoChanges: Observable<State>;
  responseChanges: Observable<State>;
  situationChanges: Observable<State>;
  filterChanges: Observable<State>;
  queryChanges: Observable<State>;
  cardChanges: Observable<State>;

  placeNames = new Subject<string>();

  selectedCard = new ReplaySubject<{card: Card | null, preview: boolean}>(1);
  cardCache: {[key: string]: Card} = {};
  cardPreview = false;

  savedGeo: CenterZoomType | null;
  latestBounds: LngLatBounds;
  replaceCenterZoom: CenterZoomType | null = null;

  constructor(private api: ApiService, private responses: ResponsesService, private location: Location, private seo: SeoSocialShareService) {
    // State stream - only for geo view changes
    this.geoChanges = this.state.pipe(
      distinctUntilChanged<State>(keyComparer(['geo'])),
    );
    this.filterChanges = this.state.pipe(
      distinctUntilChanged<State>(keyComparer(['responseId', 'situations'])),
    );
    this.responseChanges = this.state.pipe(
      distinctUntilChanged<State>(keyComparer(['responseId'])),
    );
    this.situationChanges = this.state.pipe(
      distinctUntilChanged<State>(keyComparer(['situations'])),
    );
    this.queryChanges = this.state.pipe(
      distinctUntilChanged<State>(keyComparer(['searchBoxTitle'])),
    );
    this.cardChanges = this.state.pipe(
      distinctUntilChanged<State>(keyComparer(['cardId'])),
    );
    // // State stream - for first time item fetching
    // this.state.pipe(
    //   first(),
    //   filter((state) => !!state.cardId),
    //   switchMap((state) => this.api.getCard(state.cardId as string))
    // ).subscribe((service: Card) => {
    //   // console.log('FIRST TIME - Fetched', service);
    //   this.selectService(service);
    // });
    this.cardChanges.subscribe((state) => {
      console.log('STATE CARD CHANGED', state);
      this.selectCardById(state.cardId || null);
    });
  }

  trackRoute(router: Router, activatedRoute: ActivatedRoute) {
    // State decoding from URL
    router.events.pipe(
      filter((event: Event) =>(event instanceof NavigationStart)),
    ).subscribe((event) => {
      const ns = (event as NavigationStart);
      if (ns.navigationTrigger === 'popstate') {
        this._state.skipGeoUpdate = false;
      }
    });
    merge(
      activatedRoute.queryParams,
      activatedRoute.url
    ).pipe(
      map(() => activatedRoute.snapshot),
      switchMap((sn) => {
        const responseId = sn.params.response || null;
        const placeId = sn.params.place || null;
        const cardId = sn.params.card || null;
        const state = sn.queryParams.state || '';
        return this.processPaths(responseId, placeId, cardId, state);
      }),
      filter((state) => {
        return state !== this.currentState;          
      }),
      map((state) => {
        this.currentState = state;
        const decoded = this.decode(state);
        console.log('D:STATE', state, '->', decoded);
        return decoded
      })
    ).subscribe((state: State) => {
      this._state = Object.assign({}, this._state, state);
      this.state.next(this._state);
    });

    this.state.subscribe(state => {
      const encoded = this.encode(state);
      this.currentState = encoded;
      const queryParams = {
        state: encoded
      };
      // const qp = `?g=${encodeURIComponent(queryParams.g)}` +
      //   `&f=${encodeURIComponent(queryParams.f)}` +
      //   `&q=${encodeURIComponent(queryParams.q)}`;
      //   console.log('E:STATE', state, '->', path, queryParams);
      //   // router.navigateByUrl(path + qp);
      // const jp = path.join('/');
      // const cp = this.location.path().split('?')[0];
      // if (jp !== cp) {
      //   console.log('PUSH TO HISTORY', cp, jp + qp);
      //   this.location.go(jp + qp);
      // } else {
      //   console.log('REPLACE TO HISTORY', jp + qp);
      //   this.location.replaceState(jp + qp);
      // }
      router.navigate(['/'], {queryParams, replaceUrl: false});
    });
  }

  processPaths(responseId: string, placeId: string, cardId: string, encoded: string): Observable<string> {
    if (!!responseId || !!placeId || !!cardId) {
      const decoded = this.decode(encoded);
      let obs: Observable<State> = from([]);
      if (!!responseId) {
        obs = this.api.getResponse(responseId).pipe(
          map((response) => {
            decoded.responseId = responseId;
            decoded.searchBoxTitle = response.name;
            decoded.cardId = null;
            decoded.placeId = null;
            return decoded;
          })
        );
      } else if (!!placeId) {
        obs = this.api.getPlace(placeId).pipe(
          map((place) => {
            decoded.geo = [[place.bounds[0], place.bounds[1]], [place.bounds[2], place.bounds[3]]];
            decoded.searchBoxTitle = place.name[0];
            decoded.cardId = null;
            decoded.placeId = placeId;
            decoded.responseId = null;
            this.placeName = placeId;
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
      }
      return obs.pipe(
        map((state) => {
          return this.encode(state);
        })
      );
    } else {
      return from([encoded]);
    }
  }
  
  encode(state: State) {
    const prepared = [
      state.geo || null,
      state.searchBoxTitle || null,
      state.cardId || null,
      state.responseId || null,
      state.situations || null,
    ];
    return JSON.stringify(prepared);
  }
  
  decode(state: string): State {
    if (state) {
      try {
        const prepared = JSON.parse(state);
        return {
          geo: prepared[0] || null,
          searchBoxTitle: prepared[1] || '',
          cardId: prepared[2] || null,
          responseId: prepared[3] || null,
          situations: prepared[4] || null,
        };
      } catch (e) {
        console.log('DECODE ERROR', e);
      }
    }
    return {};
  }

  // decode(encoded: {responseId: string, placeId: string, cardId: string, queryText: string, geo: string, situations: string}): Observable<State> {
  //   let pSituations: string[][] | null = null;
  //   try {
  //     pSituations = JSON.parse(encoded.situations);
  //   } catch (e) {
  //     pSituations = null;
  //   }
  //   let pGeo: GeoType = null;
  //   try {
  //     pGeo = JSON.parse(encoded.geo);
  //   } catch (e) {
  //     pGeo = null;
  //   }

  //   if (encoded.responseId) {
  //     if (!encoded.queryText) {
  //       return this.api.getResponse(encoded.responseId).pipe(
  //         map((response) => {
  //           return {
  //             geo: pGeo,
  //             responseId: encoded.responseId,
  //             cardId: null,
  //             placeId: null,
  //             searchBoxTitle: response.name,
  //             situations: pSituations,
  //           };
  //         })
  //       );
  //     } else {
  //       return from([
  //         {
  //           geo: pGeo,
  //           responseId: encoded.responseId,
  //           cardId: null,
  //           placeId: null,
  //           searchBoxTitle: encoded.queryText,
  //           situations: pSituations,
  //         }
  //       ]);
  //     }
  //   }
  //   if (encoded.cardId) {
  //     return from([
  //       {
  //         geo: pGeo,
  //         responseId: null,
  //         cardId: encoded.cardId,
  //         placeId: null,
  //         searchBoxTitle: encoded.queryText,
  //         situations: pSituations,
  //       }
  //     ]);
  //   }
  //   if (encoded.placeId) {
  //     if (!encoded.geo) {
  //       return this.api.getPlace(encoded.placeId).pipe(
  //         map((place) => {
  //           return {
  //             geo: [[place.bounds[0], place.bounds[1]], [place.bounds[2], place.bounds[3]]],
  //             responseId: null,
  //             cardId: null,
  //             placeId: encoded.placeId,
  //             searchBoxTitle: place.name[0],
  //             situations: pSituations,
  //           };
  //         })
  //       );
  //     } else {
  //       return from([
  //         {
  //           geo: pGeo,
  //           responseId: null,
  //           cardId: null,
  //           placeId: encoded.placeId,
  //           searchBoxTitle: encoded.queryText,
  //           situations: pSituations,
  //         }
  //       ]);
  //     }
  //   }
  //   return from([{
  //     geo: pGeo,
  //     responseId: null,
  //     cardId: null,
  //     placeId: null,
  //     searchBoxTitle: encoded.queryText,
  //     situations: pSituations,
  //   }]);
  // }

  set bounds(bounds: LngLatBounds) {
    const geo = bounds.toArray();
    this._state = Object.assign({}, this._state, {geo, skipGeoUpdate: false});
    this.state.next(this._state);
  }

  updateCenterZoom(geo: CenterZoomType, skipGeoUpdate=false) {
    geo = geo.map(x => Math.round(x * 10000) / 10000) as CenterZoomType;
    this._state = Object.assign({}, this._state, {geo, skipGeoUpdate});
    this.state.next(this._state);
  }

  set centerZoom(centerZoom: CenterZoomType) {
    this.updateCenterZoom(centerZoom);
  }

  // set searchBoxTitle(searchBoxTitle: string) {
  //   this._state = Object.assign({}, this._state, {searchBoxTitle});
  //   this.state.next(this._state);
  // }

  set cardId(cardId: string | null) {
    console.log('STATE CARD ID <-', cardId);
    this._state = Object.assign({}, this._state, {cardId});
    this.state.next(this._state);
  }

  set card(card: Card | null) {
    console.log('STATE CARD <-', card);
    if (card) {
      this.cardCache[card.card_id] = card;
      this.cardId = card.card_id;  
    } else {
      this.cardId = null;
    }
  }

  set responseFilter(responseId: string | null) {
    const searchBoxTitle = responseId ? this.responses.getResponseName(responseId) : '';
    this.seo.setTitle(`כל שירות - חיפוש ${searchBoxTitle}`);
    this.seo.setDescription(`כל שירות - חיפוש שירותים מסוג ${searchBoxTitle} המסופקים על ידי הממשלה, עמותות וחברות`);
    this.seo.setUrl(`https://www.kolsherut.org.il/r/${responseId}`);
    this._state = Object.assign({}, this._state, {responseId, searchBoxTitle});
    this.state.next(this._state);
  }

  get responseFilter() {
    return this._state.responseId ? this._state.responseId : null;
  }

  set situations(situations: string[][] | null) {
    this._state = Object.assign({}, this._state, {situations});
    this.state.next(this._state);
  }

  set placeName(place: string) {
    this.seo.setTitle(`כל שירות - שירותים חברתיים ב${place}`);
    this.seo.setDescription(`כל שירות - חיפוש שירותים באזור ${place} המסופקים על ידי הממשלה, עמותות וחברות`);
    this.seo.setUrl(`https://www.kolsherut.org.il/p/${place}`);  
    this.placeNames.next(place);
  }

  selectCardById(cardId: string | null) {
    console.log('SELECT CARD BY ID', cardId);
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

  selectCardPreview(card: Card | null) {
    this.cardPreview = true;
    this.card = card;
  }

  deselectCardWithCenterZoom(centerZoom: CenterZoomType) {
    this.cardPreview = false;
    this.replaceCenterZoom = centerZoom;
    this.card = null;
  }
  
  selectCard(card: Card | null, replaceCenterZoom: CenterZoomType | null = null) {
    const cardId = card?.card_id || null;
    console.log('SELECT CARD', cardId);
    if (card) {
      this.cardCache[card.card_id] = card;
      this.seo.setTitle(`כל שירות - ${card.service_name}`);
      this.seo.setDescription(`${card.branch_name} - ${card.service_description}`);
      this.seo.setUrl(`https://www.kolsherut.org.il/c/${card.card_id}`);  
    }
    if (card && !this.savedGeo && this._state.geo && this._state.geo.length === 3) {
      this.savedGeo = this._state.geo;
      // console.log('SAVED GEO', this.savedGeo);
    }
    if (!card) {
      if (this.replaceCenterZoom) {
        this.centerZoom = (replaceCenterZoom as CenterZoomType);
        this.replaceCenterZoom = null;
      } else if (this.savedGeo) {
        this.centerZoom = this.savedGeo;
        // console.log('CLEARED GEO', this.savedGeo);
        this.savedGeo = null;  
      }
    }
    this.selectedCard.next({card, preview: this.cardPreview});
    this.cardPreview = false;
  }

  applyFromUrl(urlToApply: string) {
    console.log('APPLY FROM URL', urlToApply);
    const url = new URL(urlToApply);
    const params = url.searchParams;
    if (params) {
      const encodedState = params.get('state');
      if (encodedState) {
        const decoded: State = this.decode(encodedState);
        this._state = decoded;
        this.state.next(this._state);
      }
    }
  }
}

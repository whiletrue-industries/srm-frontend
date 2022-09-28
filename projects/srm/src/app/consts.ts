export enum DrawerState {
    Peek = 'peek',
    Half = 'half',
    Most = 'most',
    Full = 'full',
};

export class TaxonomyItem {
    id?: string;
    name?: string;
    synonyms?: string[];
    category?: string;
};


export class Card {
    service_id: string;
    service_name: string;
    service_description: string;
    service_details: string;
    service_payment_required: string;
    service_payment_details: string;
    service_urls: {href: string, title: string}[];
    organization_id: string;
    organization_name: string;
    organization_description: string;
    organization_purpose: string;
    organization_kind: string;
    organization_urls: {href: string, title: string}[];
    branch_id: string;
    branch_name: string;
    branch_description: string;
    branch_urls: {href: string, title: string}[];
    branch_phone_numbers: string;
    branch_address: string;
    branch_geometry: [number, number];
    card_id: string;
    response_categories: string[];
    situations: TaxonomyItem[];
    situation_ids: string[];
    responses: TaxonomyItem[];
    response_category: string;
    point_id: string;
};

export type Point = {
    response_categories: string[],
    point_id: string,
    card_id: string,
    response_ids: string[],
    situation_ids: string[],
    response_category: string,
    records: Card[]
};

export type Preset = {
    link: string,
    title: string,
    style: string,
};

export type AutoComplete = {
    query: string,
    response: string | null,
    situation: string | null,
    synonyms: string[],
};

export type SearchResult<T extends any> = {
    search_counts: {
        [key: string]: {
            total_overall: number,
        },
    },
    search_results: {
        score: number,
        source: T
    }[]
};

export function _h(sr: any, f: string) {
    return sr._highlights?.[f] || sr[f];
}

export type QueryPresetResult = SearchResult<Preset>;
export type QueryAutoCompleteResult = SearchResult<AutoComplete>;
export type QueryCardResult = SearchResult<Card>;

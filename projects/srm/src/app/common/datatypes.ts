export enum DrawerState {
    Hidden = 'hidden',
    Peek = 'peek',
    Card = 'card',
    Most = 'most',
    Full = 'full',
};

export enum HeaderState {
    Hidden = 'hidden',
    Visible = 'visible',
};

export enum ItemState {
    None = 'none',
    Preview = 'preview',
    Full = 'full',
};

export type Card = {
    service_id: string,
    service_name: string,
    service_description: string,
    service_details: string,
    service_payment_required: string,
    service_payment_details: string,
    service_urls: string,
    organization_id: string,
    organization_name: string,
    organization_description: string,
    organization_purpose: string,
    organization_kind: string,
    organization_urls: string,
    branch_id: string,
    branch_name: string,
    branch_description: string,
    branch_urls: string,
    branch_phone_numbers: string,
    branch_address: string,
    branch_geometry: [number, number],
    card_id: string,
    response_categories: string[],
    situations: {id: string, name: string}[],
    responses: {id: string, name: string}[],
};

export type QueryCardsResult = {
    search_counts: {
        [key: string]: {
            total_overall: number,
        },
    },
    search_results: {
        source: Card
    }[]
};

export type CategoryCountsResult = {
    category?: string,
    display?: string,
    count?: number,
    color: string,
};
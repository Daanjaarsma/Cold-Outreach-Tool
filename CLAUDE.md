<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->

# Praedix Cold Outreach Tool

## Doel
Interne tool waarmee Ruben Blommaert (sales) geautomatiseerd leads genereert voor cold outreach naar e-commerce en recruitment bedrijven in Nederland. Gebouwd voor de huidige Praedix-diensten: AI-automatiseringen (€499+) en maatwerksystemen (€1.999+).

## Stack
- **Frontend:** React 18 + Vite + TypeScript + Tailwind
- **Backend:** Vercel serverless functions (`api/scrape-leads.ts`)
- **Database:** Convex (project: `cold-outreach-tool-f2a9a`, eu-west-1)
  - Dev: `qualified-herring-111` / Prod: `academic-dog-58`
- **Scraping:** Apify (Google Maps + Shopify + custom email enricher)
- **Custom scraper source:** `/Users/daanjaarsma/Custom scraper outreach tool/`

## Architectuur — hybride scrape pipeline

### E-commerce flow
```
Shopify Store Lead Scraper (primair)
        ↓
Google Maps Scraper (fallback, met website-validatie)
        ↓
Custom Email Scraper (verrijking)
        ↓
Kwaliteitsfiltering (categorie, keten, dienstverlener, junk)
        ↓
Domein-deduplicatie (cross-bron + cross-generatie)
        ↓
Convex DB (leads tabel)
```

### Recruitment flow
```
Google Maps Scraper (primair)
        ↓
Custom Email Scraper (verrijking)
        ↓
Convex DB (leads tabel)
```

## Bestanden

### API
- `api/scrape-leads.ts` — Hoofdendpoint: hybride scrape pipeline met alle filtering
  - Gewogen website-validatie (4 punten drempel, sterke/zwakke/negatieve signalen)
  - Categorie-blacklist (30+ uitgesloten categorieën)
  - Keten-blacklist (100+ Nederlandse ketens)
  - Dienstverlener-detectie
  - Cross-bron domein-deduplicatie
  - Vercel timeout management (55s max)
  - Email fallback generatie (info@domein)

### Frontend
- `src/App.tsx` — Hoofdcomponent: zoekform + lead opslag
- `src/components/LeadZoekForm.tsx` — Sector/sub-sector/locatie/grootte selectie
- `src/components/LeadsResultaat.tsx` — Lead cards met contact popup
- `src/components/StatsOverzicht.tsx` — Dashboard statistieken
- `src/components/PasswordGate.tsx` — Authenticatie (Ruben-only)
- `src/lib/utils.ts` — Lead scoring, CSV export, sector-mappings

### Convex
- `convex/schema.ts` — leads + outreachLog tabellen
- `convex/leads.ts` — CRUD + saveBatch met triple deduplicatie (placeId + domein + naam+stad)

## Env vars (Vercel)
- `APIFY_TOKEN` — Apify API key
- `APIFY_EMAIL_SCRAPER_ID` — Actor ID custom email scraper
- `VITE_CONVEX_URL` — Convex prod deployment URL

## Kwaliteitsfiltering — hoe het werkt

### Website-validatie (e-commerce)
Elke Google Maps lead wordt gevalideerd door de homepage te fetchen en te checken op e-commerce signalen:
- **Sterke signalen (2pt):** Platform (Shopify, WooCommerce, Magento, Lightspeed, CCV Shop), Cart elementen, Structured data
- **Zwakke signalen (1pt):** prijs, kopen, bestellen, verzendkosten, voorraad
- **Negatieve signalen:** "onze diensten", "portfolio", "offerte aanvragen" → diskwalificeert bij 3+
- **Drempel:** 4 punten nodig

### Lead scoring (0-100)
- Email (scraped): +20, Email (fallback): +10, Telefoon: +10
- Website: +10, Eigen domein: +5
- Reviews ≥4.0: +12, Reviews ≥3.5: +6, >10 reviews: +8
- Relevante categorie: +15, Shopify-bron: +10
- Dienstverlener-categorie: -25

## Bekende gotchas
1. Google Maps zoekt op tekst → "e-commerce" geeft marketingbureaus. Gebruik specifieke retail-categorieën.
2. Pure online webshops staan niet op Google Maps. Shopify scraper is primaire bron.
3. Vercel serverless max 60s → pipeline moet binnen 55s. Timeout management ingebouwd.
4. `npx convex deploy` vanuit project-root, niet home dir.
5. Shopify scraper zoekt globaal → "nederland" toevoegen aan queries.
6. Cross-bron dedup: Shopify placeIds (`shopify:storename`) ≠ Google Maps placeIds → domein-normalisatie nodig.

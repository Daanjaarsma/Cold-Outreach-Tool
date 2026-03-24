# N8N Cold Outreach Workflow — Setup

## Importeren
1. Open n8n op `https://praedixautomations.app.n8n.cloud`
2. Ga naar **Workflows** → **Import from File**
3. Upload `cold-outreach-workflow.json`
4. Activeer de workflow

## Benodigde Credentials
In n8n moeten twee credentials aangemaakt worden:

### 1. Anthropic API Key
- Type: Header Auth
- Header Name: `x-api-key`
- Value: je Anthropic API key (zelfde als `ANTHROPIC_API_KEY` in Vercel)
- OF: sla op als environment variable `ANTHROPIC_API_KEY` in n8n

### 2. Resend API Key
- Type: Header Auth
- Header Name: `Authorization`
- Value: `Bearer re_...` (je Resend API key)
- OF: sla op als environment variable `RESEND_API_KEY` in n8n

## Convex Endpoint
De workflow logt naar Convex via:
```
https://qualified-herring-111.eu-west-1.convex.site/logOutreach
```
Dit is al geconfigureerd in de workflow. Als het Convex deployment verandert, update de URL in de "Log naar Convex" node.

## Testen
1. Activeer de workflow in n8n
2. Stuur een test-POST naar de webhook URL met:
```json
{
  "leads": [
    {
      "bedrijfsnaam": "Test Webshop",
      "email": "info@praedix.io",
      "website": "https://www.praedix.io",
      "stad": "Amsterdam",
      "categorie": "E-commerce",
      "subCategorie": "Webshops (D2C)"
    }
  ]
}
```
3. Check of de email aankomt op info@praedix.io

## Anti-Spam Instellingen
- **Max 50 emails per dag** (hardcoded in Filter & Dedup node)
- **60 seconden wachttijd** tussen batches van 5
- **Afmeldlink** onderaan elke email ("reply met uitschrijven")
- **Deduplicatie** op email-adres (geen dubbele emails)

## Webhook URL
Na activatie is de webhook bereikbaar op:
```
https://praedixautomations.app.n8n.cloud/webhook/ecommerce-cold-outreach
```
Dit is de URL die de Lead Outreach Tool aanroept bij "Verstuur Cold Outreach".

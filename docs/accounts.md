# Accounts and Authentication

Mathigon Studio supports users creating accounts and saving their progress, using a MongoDB
database. You can enable and configure this functionality using the `accounts` key in the
`config.yaml` file for your project. Here is a sample configuration:

```yaml
accounts:
  emabled: true

  # Minimum age allowed for users
  minAge: 13

  # Required privacy information
  privacyPolicy: https://mathigon.org/policies
  termsOfUse: https://mathigon.org/terms
  address: 1 Main Street, London, United Kingdom

  # Support email that users can contact
  supportEmail: string;

  # Email address that receives CRON job notification emails (optional)
  cronNotificationsEmail: string;

  # Sendgrid API key
  sendgridKey: 12345

  # MongoDB URL (optional)
  mongodb: mongodb://localhost:27017/mathigon

  # Federated Login Providers
  oAuth:
    facebook:
      clientId: 12345
      clientSecret: 12345
    google:
      clientId: 12345.apps.googleusercontent.com
      clientSecret: 12345
```

You also need to bind the account URL routes. This should happen *before* any other routes you
bind or create:

```ts
new MathigonStudioApp()
    .setup({sessionSecret: 'hey!'})
    .accounts()  // <==
    .get('/', (req, res) => res.render('home.pug', {}))
    .listen(8080);
```

## Federated Login Providers

Federated login allows users to sign in using existing account, and we currently support Google,
Facebook, Microsoft and IBM.

You need a `clientID` and `clientSecret` for each provider you want to support, which can be
optained on the various providers' websites. You may also have to provide some privacy information,
and whitelist all permitted callback URLs, which should be `/auth/{google|facebook|microsoft|ibm}/callback`
for each of the respective providers. Additional subdomains (e.g. `fr.mathigon.org/auth/google/callback`)
need to all be whitelisted individually, since it usually not possible to have wildcard subdomains.

## MongoDB Database

Our accounts system expects a MongoDB database, although it can fall back to an in-memory DB for
local development. Our server will automatically initialise all required collections and indices.
The access URL which needs to be in the confideration should look something like this:
`mongodb+srv://username:password@clustername.gcp.mongodb.net/dbname?retryWrites=true&w=majority`

## Secret Management

Many secrets, like the sendgrid API key, MongoDB URL or client secrets for federated login should
not be committed to the publicly visible `config.yaml` file: instead, just use placeholders for
local development.

The secrets should instead be stored in the GitHub repo secrets manager. During the deployment
progress, the `mgon-secrets` scripts allows you to write the production secrets into the project
`config.yaml` file before uploading it to the server:

```yaml
- name: Secrets
  run: mgon-secrets --mongo ${{ secrets.MONGODB }} --googleClientId ${{ secrets.GOOGLE_CLIENT_ID }} --googleClientSecret ${{ secrets.GOOGLE_CLIENT_SECRET }} --sendgrid ${{ secrets.SENDGRID_KEY }}
```

## Security

It is recommended to set up a CDN like Cloudflare, which supports rate limiting for certain
endpoints that call the database or send emails, including  `/login`, `/signup`, `/reset`, `/forgot`
and `/profile/resend`. Rate limiting is not currently built into our platform itself.
